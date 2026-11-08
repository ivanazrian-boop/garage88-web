
import { createClient } from "@supabase/supabase-js";

import {
  chromium,
  type Browser,
  type Page,
} from "playwright";

import { loadEnvFile } from "node:process";

import {
  buildPremiumCoverHtml,
} from "../src/lib/premiumCoverTemplate";

import {
  buildGarage88AutoHeroTitle,
} from "../src/lib/igCoverTemplate";

import {
  buildGarage88MetaSquareHtml,
} from "../src/lib/metaSquareTemplate";

/* =====================================================
   ENV
   ===================================================== */

function tryLoadEnv(file: string) {
  try {
    loadEnvFile(file);
  } catch {
    // File env tidak wajib tersedia.
  }
}

tryLoadEnv(".env");
tryLoadEnv(".dev.vars");

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.PUBLIC_SUPABASE_URL;

const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL) {
  throw new Error("SUPABASE_URL tidak ditemukan.");
}

if (!SUPABASE_SERVICE_KEY) {
  throw new Error("SUPABASE_SERVICE_KEY tidak ditemukan.");
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

/* =====================================================
   ARGUMENT
   ===================================================== */

const args = process.argv.slice(2);

function argNumber(name: string, fallback: number) {
  const prefix = `--${name}=`;

  const found = args.find((arg) =>
    arg.startsWith(prefix)
  );

  if (!found) return fallback;

  const value = Number(found.slice(prefix.length));

  return Number.isFinite(value) ? value : fallback;
}

const limit = Math.max(0, argNumber("limit", 0));

/* =====================================================
   TYPE
   ===================================================== */

type CarRow = {
  id: string;
  brand: string | null;
  model: string | null;
  variant: string | null;
  year: number | null;
  color: string | null;
  odometer: number | null;
  credit_price: number | null;
  cash_price: number | null;
  dp: number | null;
  status: string | null;
  cover_source_image_url: string | null;
  cover_hero_title: string | null;
  cover_needs_regenerate: boolean;
  created_at: string | null;
};

type CarImageRow = {
  image_url: string | null;
  sort_order: number | null;
};

/* =====================================================
   HELPERS
   ===================================================== */

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function carLabel(car: CarRow) {
  return [
    car.brand,
    car.model,
    car.variant,
    car.year,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

async function waitForImages(page: Page) {
  await page.waitForFunction(
    () => {
      const images = Array.from(document.images);

      return images.every(
        (img) => img.complete && img.naturalWidth > 0
      );
    },
    undefined,
    { timeout: 30_000 }
  );
}

/* =====================================================
   GET PENDING CARS
   ===================================================== */

async function getPendingCars(): Promise<CarRow[]> {
  const { data, error } = await supabase
    .from("cars")
    .select(`
      id,
      brand,
      model,
      variant,
      year,
      color,
      odometer,
      credit_price,
      cash_price,
      dp,
      status,
      cover_source_image_url,
      cover_hero_title,
      cover_needs_regenerate,
      created_at
    `)
    .eq("status", "READY")
    .eq("cover_needs_regenerate", true)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(
      `Gagal mengambil pending covers: ${error.message}`
    );
  }

  const cars = (data ?? []) as CarRow[];

  return limit > 0 ? cars.slice(0, limit) : cars;
}

/* =====================================================
   GET PREMIUM TOP PHOTOS
   Prioritas foto database #2, #4, #5
   ===================================================== */

async function getPremiumTopPhotoUrls(
  carId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from("car_images")
    .select("image_url, sort_order")
    .eq("car_id", carId)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(
      `Gagal mengambil foto tambahan: ${error.message}`
    );
  }

  const images = (data ?? []) as CarImageRow[];

  const urls = images
    .map((item) => String(item.image_url ?? "").trim())
    .filter(Boolean);

  if (urls.length === 0) {
    return [];
  }

  // Index array dimulai dari 0:
  // foto DB #2 = index 1
  // foto DB #4 = index 3
  // foto DB #5 = index 4
  const selected = [1, 3, 4]
    .map((index) => urls[index])
    .filter((url): url is string => Boolean(url));

  // Jika foto #2, #4, atau #5 tidak tersedia,
  // isi dengan foto lain yang tersedia.
  for (const url of urls) {
    if (selected.length >= 3) break;

    if (!selected.includes(url)) {
      selected.push(url);
    }
  }

  // Jika hanya tersedia satu atau dua foto,
  // gandakan foto terakhir untuk layout premium.
  while (selected.length > 0 && selected.length < 3) {
    selected.push(selected[selected.length - 1]);
  }

  return selected;
}

/* =====================================================
   RENDER COVER
   ===================================================== */

async function renderCover(
  page: Page,
  html: string,
  width: number,
  height: number,
  label: string
): Promise<Uint8Array> {
  await page.setViewportSize({ width, height });

  await page.setContent(html, {
    waitUntil: "networkidle",
    timeout: 30_000,
  });

  await waitForImages(page);

  // Tunggu font selesai dimuat jika template menggunakannya.
  await page.evaluate(async () => {
    if ("fonts" in document) {
      await document.fonts.ready;
    }
  });

  await sleep(250);

  const screenshot = await page.screenshot({
    type: "jpeg",
    quality: 92,
    animations: "disabled",
    clip: {
      x: 0,
      y: 0,
      width,
      height,
    },
  });

  console.log(
    `  ✓ ${label}: ${width}x${height}`
  );

  return new Uint8Array(screenshot);
}

/* =====================================================
   UPLOAD
   ===================================================== */

async function uploadCover(
  storagePath: string,
  bytes: Uint8Array
): Promise<string> {
  const { error } = await supabase
    .storage
    .from("cars")
    .upload(storagePath, bytes, {
      contentType: "image/jpeg",
      cacheControl: "3600",
      upsert: true,
    });

  if (error) {
    throw new Error(
      `Upload ${storagePath}: ${error.message}`
    );
  }

  const { data } = supabase
    .storage
    .from("cars")
    .getPublicUrl(storagePath);

  return data.publicUrl;
}

/* =====================================================
   PROCESS ONE CAR
   ===================================================== */

async function processCar(
  browser: Browser,
  car: CarRow,
  index: number,
  total: number
) {
  console.log("");
  console.log(
    `[${index + 1}/${total}] ${carLabel(car)}`
  );

  const sourceImageUrl = String(
    car.cover_source_image_url ?? ""
  ).trim();

  if (!sourceImageUrl) {
    console.log(
      "  ⚠️ SKIP — PhotoRoom polos belum tersedia."
    );

    // Pending tetap true agar dapat diproses ulang.
    return { status: "skipped" as const };
  }

  const existingHero = String(
    car.cover_hero_title ?? ""
  ).trim();

  const resolvedHero = (
    existingHero || buildGarage88AutoHeroTitle(car)
  )
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

  if (!resolvedHero) {
    console.log("  ⚠️ SKIP — Hero title kosong.");
    return { status: "skipped" as const };
  }

  console.log(`  Hero: ${resolvedHero}`);

  const carForCover = {
    ...car,
    cover_hero_title: resolvedHero,
  };

  // Ambil foto tambahan untuk layout premium.
  const topPhotoUrls = await getPremiumTopPhotoUrls(
    car.id
  );

  console.log(
    `  Foto tambahan premium: ${topPhotoUrls.length}`
  );

  /*
   * IG menggunakan Premium Cover.
   * Meta menggunakan template Meta Square.
   */
  const premiumHtml = buildPremiumCoverHtml(
    carForCover,
    sourceImageUrl,
    topPhotoUrls
  );

  const metaHtml = buildGarage88MetaSquareHtml(
    carForCover,
    sourceImageUrl
  );

  const context = await browser.newContext({
    viewport: {
      width: 1080,
      height: 1350,
    },
    deviceScaleFactor: 1,
  });

  try {
    const page = await context.newPage();

    console.log("  Render Premium IG Cover...");

    const premiumJpeg = await renderCover(
      page,
      premiumHtml,
      1080,
      1350,
      "Premium IG Cover"
    );

    console.log("  Render Meta Cover...");

    const metaJpeg = await renderCover(
      page,
      metaHtml,
      1080,
      1080,
      "Meta Cover"
    );

    // Pertahankan path dan field database yang sudah digunakan.
    const igPath = `${car.id}/generated/ig-cover.jpg`;
    const metaPath = `${car.id}/generated/meta-cover.jpg`;

    console.log("  Upload Premium IG Cover...");

    const igUrl = await uploadCover(
      igPath,
      premiumJpeg
    );

    console.log("  Upload Meta Cover...");

    const metaUrl = await uploadCover(
      metaPath,
      metaJpeg
    );

    // Update database hanya setelah kedua upload berhasil.
    const { error: updateError } = await supabase
      .from("cars")
      .update({
        cover_hero_title: resolvedHero,
        cover_needs_regenerate: false,
        ig_image_url: igUrl,
        meta_image_url: metaUrl,
      })
      .eq("id", car.id);

    if (updateError) {
      throw new Error(
        `Database update gagal: ${updateError.message}`
      );
    }

    console.log("  ✅ PREMIUM IG dan META berhasil.");
    console.log(`  IG URL: ${igUrl}`);
    console.log(`  META URL: ${metaUrl}`);

    return { status: "success" as const };
  } finally {
    await context.close();
  }
}

/* =====================================================
   MAIN
   ===================================================== */

async function main() {
  console.log("");
  console.log("GARAGE88 — PREMIUM IG + META COVER");
  console.log("==================================");

  const cars = await getPendingCars();

  console.log(`Pending ditemukan: ${cars.length}`);

  if (cars.length === 0) {
    console.log(
      "Tidak ada cover yang perlu di-generate."
    );
    return;
  }

  const browser = await chromium.launch({
    headless: true,
  });

  let success = 0;
  let skipped = 0;
  let failed = 0;

  try {
    for (let index = 0; index < cars.length; index++) {
      try {
        const result = await processCar(
          browser,
          cars[index],
          index,
          cars.length
        );

        if (result.status === "success") {
          success++;
        } else {
          skipped++;
        }
      } catch (error) {
        failed++;

        console.log("  ❌ FAILED");

        console.error(
          error instanceof Error
            ? error.message
            : String(error)
        );
      }
    }
  } finally {
    await browser.close();
  }

  console.log("");
  console.log("==================================");
  console.log("SELESAI");
  console.log(`✅ Berhasil : ${success}`);
  console.log(`⚠️ Skip     : ${skipped}`);
  console.log(`❌ Gagal    : ${failed}`);
  console.log(`📦 Diproses : ${cars.length}`);
  console.log("");
}

main().catch((error) => {
  console.error("");
  console.error("FATAL ERROR:");
  console.error(error);
  process.exit(1);
});

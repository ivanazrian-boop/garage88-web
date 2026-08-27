import {
  createClient,
} from "@supabase/supabase-js";

import {
  chromium,
  type Browser,
  type Page,
} from "playwright";

import {
  loadEnvFile,
} from "node:process";

import {
  buildGarage88AutoHeroTitle,
} from "../src/lib/igCoverTemplate";

import {
  buildGarage88MetaSquareHtml,
} from "../src/lib/metaSquareTemplate";


/* =====================================================
   ENV
   ===================================================== */

function tryLoadEnv(
  file: string
) {

  try {
    loadEnvFile(file);
  } catch {
    // ignore
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

  throw new Error(
    "SUPABASE_URL tidak ditemukan."
  );

}


if (!SUPABASE_SERVICE_KEY) {

  throw new Error(
    "SUPABASE_SERVICE_KEY tidak ditemukan."
  );

}


const supabase =
  createClient(
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

   --start=0
   --limit=3
   ===================================================== */

const args =
  process.argv.slice(2);


function argNumber(
  name: string,
  fallback: number
) {

  const prefix =
    `--${name}=`;


  const found =
    args.find(
      (arg) =>
        arg.startsWith(prefix)
    );


  if (!found) {
    return fallback;
  }


  const value =
    Number(
      found.slice(
        prefix.length
      )
    );


  return Number.isFinite(value)
    ? value
    : fallback;
}


const start =
  Math.max(
    0,
    argNumber(
      "start",
      0
    )
  );


const limit =
  Math.max(
    0,
    argNumber(
      "limit",
      0
    )
  );


/* =====================================================
   TYPE
   ===================================================== */

type CarRow = {

  id: string;

  brand:
    string | null;

  model:
    string | null;

  variant:
    string | null;

  year:
    number | null;

  color:
    string | null;

  odometer:
    number | null;

  credit_price:
    number | null;

  cash_price:
    number | null;

  dp:
    number | null;

  status:
    string | null;

  cover_source_image_url:
    string | null;

  cover_hero_title:
    string | null;

  meta_image_url:
    string | null;

  created_at:
    string | null;

};


/* =====================================================
   HELPERS
   ===================================================== */

function sleep(
  ms: number
) {

  return new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        ms
      )
  );

}


function carLabel(
  car: CarRow
) {

  return [
    car.brand,
    car.model,
    car.variant,
    car.year,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(
      /\s+/g,
      " "
    )
    .trim();

}


/* =====================================================
   WAIT IMAGES
   ===================================================== */

async function waitForImages(
  page: Page
) {

  await page.waitForFunction(
    () => {

      const images =
        Array.from(
          document.images
        );


      return (
        images.length === 0 ||
        images.every(
          (img) =>
            img.complete &&
            img.naturalWidth > 0
        )
      );

    },
    undefined,
    {
      timeout: 30_000,
    }
  );

}


/* =====================================================
   RENDER META
   ===================================================== */

async function renderMeta(
  page: Page,
  html: string
): Promise<Uint8Array> {

  await page.setViewportSize({
    width: 1080,
    height: 1080,
  });


  await page.setContent(
    html,
    {
      waitUntil:
        "networkidle",

      timeout:
        30_000,
    }
  );


  await waitForImages(
    page
  );


  await sleep(
    250
  );


  const screenshot =
    await page.screenshot({
      type:
        "jpeg",

      quality:
        92,

      clip: {
        x: 0,
        y: 0,
        width: 1080,
        height: 1080,
      },
    });


  return new Uint8Array(
    screenshot
  );

}


/* =====================================================
   GET READY CARS
   ===================================================== */

async function getCars():
Promise<CarRow[]> {

  const {
    data,
    error,
  } =
    await supabase
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
        meta_image_url,
        created_at
      `)
      .eq(
        "status",
        "READY"
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      );


  if (error) {

    throw new Error(
      `Gagal mengambil cars: ${error.message}`
    );

  }


  const rows =
    (data ?? []) as CarRow[];


  if (
    limit > 0
  ) {

    return rows.slice(
      start,
      start + limit
    );

  }


  return rows.slice(
    start
  );

}


/* =====================================================
   UPLOAD META
   ===================================================== */

async function uploadMeta(
  carId: string,
  bytes: Uint8Array
): Promise<string> {

  const storagePath =
    `${carId}/generated/meta-cover.jpg`;


  const {
    error,
  } =
    await supabase
      .storage
      .from("cars")
      .upload(
        storagePath,
        bytes,
        {
          contentType:
            "image/jpeg",

          cacheControl:
            "0",

          upsert:
            true,
        }
      );


  if (error) {

    throw new Error(
      `Upload META: ${error.message}`
    );

  }


  return supabase
    .storage
    .from("cars")
    .getPublicUrl(
      storagePath
    )
    .data
    .publicUrl;

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


  /* =================================
     PHOTOROOM SOURCE
     ================================= */

  const sourceImageUrl =
    String(
      car.cover_source_image_url ??
      ""
    ).trim();


  if (!sourceImageUrl) {

    console.log(
      "  ⚠️ SKIP — PhotoRoom Polos kosong"
    );


    return {
      status:
        "skipped" as const,
    };

  }


  /* =================================
     HERO

     Pakai Hero yang sudah disimpan.
     Kalau ternyata kosong, fallback auto.
     ================================= */

  const existingHero =
    String(
      car.cover_hero_title ??
      ""
    ).trim();


  const resolvedHero =
    (
      existingHero ||
      buildGarage88AutoHeroTitle(
        car
      )
    )
      .replace(
        /\s+/g,
        " "
      )
      .trim()
      .toUpperCase();


  if (!resolvedHero) {

    console.log(
      "  ⚠️ SKIP — Hero kosong"
    );


    return {
      status:
        "skipped" as const,
    };

  }


  console.log(
    `  Hero: ${resolvedHero}`
  );


  const carForCover = {
    ...car,

    cover_hero_title:
      resolvedHero,
  };


  /* =================================
     BUILD META HTML
     ================================= */

  const metaHtml =
    buildGarage88MetaSquareHtml(
      carForCover,
      sourceImageUrl
    );


  const context =
    await browser.newContext({
      viewport: {
        width: 1080,
        height: 1080,
      },

      deviceScaleFactor:
        1,
    });


  const page =
    await context.newPage();


  try {

    /* =================================
       RENDER
       ================================= */

    console.log(
      "  Render META 1080x1080..."
    );


    const metaJpeg =
      await renderMeta(
        page,
        metaHtml
      );


    /* =================================
       UPLOAD
       ================================= */

    console.log(
      "  Upload META..."
    );


    const metaUrl =
      await uploadMeta(
        car.id,
        metaJpeg
      );


    /* =================================
       UPDATE DB

       IG tidak disentuh.
       Pending status juga tidak disentuh.
       ================================= */

    const {
      error:
        updateError,
    } =
      await supabase
        .from("cars")
        .update({

          cover_hero_title:
            resolvedHero,

          meta_image_url:
            metaUrl,

        })
        .eq(
          "id",
          car.id
        );


    if (updateError) {

      throw new Error(
        `DB update: ${updateError.message}`
      );

    }


    console.log(
      "  ✅ META selesai"
    );


    return {
      status:
        "success" as const,
    };


  } finally {

    await context.close();

  }

}


/* =====================================================
   MAIN
   ===================================================== */

async function main() {

  console.log("");
  console.log(
    "GARAGE88 REGENERATE META ONLY"
  );

  console.log(
    "============================="
  );


  if (
    start > 0
  ) {

    console.log(
      `Start : ${start}`
    );

  }


  if (
    limit > 0
  ) {

    console.log(
      `Limit : ${limit}`
    );

  }


  const cars =
    await getCars();


  console.log(
    `${cars.length} mobil READY akan diproses.`
  );


  if (
    cars.length === 0
  ) {

    console.log(
      "Tidak ada mobil."
    );

    return;

  }


  const browser =
    await chromium.launch({
      headless:
        true,
    });


  let success =
    0;

  let skipped =
    0;

  let failed =
    0;


  try {

    for (
      let index = 0;
      index < cars.length;
      index++
    ) {

      try {

        const result =
          await processCar(
            browser,
            cars[index],
            index,
            cars.length
          );


        if (
          result.status ===
          "success"
        ) {

          success++;

        } else {

          skipped++;

        }


      } catch (error) {

        failed++;


        console.log(
          "  ❌ FAILED"
        );


        console.log(
          "  ",
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
  console.log(
    "============================="
  );

  console.log(
    "SELESAI"
  );


  console.log(
    `✅ Berhasil : ${success}`
  );


  console.log(
    `⚠️ Skip     : ${skipped}`
  );


  console.log(
    `❌ Gagal    : ${failed}`
  );


  console.log(
    `📦 Total    : ${cars.length}`
  );


  console.log("");

}


/* =====================================================
   RUN
   ===================================================== */

main()
  .catch(
    (error) => {

      console.error("");
      console.error(
        "FATAL ERROR:"
      );


      console.error(
        error instanceof Error
          ? error.stack ||
            error.message
          : String(error)
      );


      process.exit(1);

    }
  );
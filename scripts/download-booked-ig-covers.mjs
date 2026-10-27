import { createClient } from "@supabase/supabase-js";
import { loadEnvFile } from "node:process";
import { mkdir, writeFile } from "node:fs/promises";
import { exec } from "node:child_process";
import path from "node:path";

/* =====================================================
   ENV
   ===================================================== */

function tryLoadEnv(file) {
  try {
    loadEnvFile(file);
  } catch {}
}

tryLoadEnv(".env");
tryLoadEnv(".dev.vars");

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.PUBLIC_SUPABASE_URL;

const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL) {
  throw new Error("SUPABASE_URL tidak ditemukan");
}

if (!SUPABASE_SERVICE_KEY) {
  throw new Error("SUPABASE_SERVICE_KEY tidak ditemukan");
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
   HELPERS
   ===================================================== */

function pad(value, length = 2) {
  return String(value).padStart(length, "0");
}

function timestamp() {
  const now = new Date();

  return (
    `${now.getFullYear()}` +
    `${pad(now.getMonth() + 1)}` +
    `${pad(now.getDate())}-` +
    `${pad(now.getHours())}` +
    `${pad(now.getMinutes())}`
  );
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function safeFilename(value) {
  return cleanText(value)
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

function carName(car) {
  return cleanText(
    [
      car.brand,
      car.model,
      car.variant,
      car.year,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function csvValue(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function extensionFrom(contentType, url) {
  const type =
    String(contentType ?? "").toLowerCase();

  if (type.includes("png")) return ".png";
  if (type.includes("webp")) return ".webp";
  if (type.includes("avif")) return ".avif";

  if (
    type.includes("jpeg") ||
    type.includes("jpg")
  ) {
    return ".jpg";
  }

  try {
    const ext =
      path.extname(
        new URL(url).pathname
      ).toLowerCase();

    if (
      [
        ".jpg",
        ".jpeg",
        ".png",
        ".webp",
        ".avif",
      ].includes(ext)
    ) {
      return ext === ".jpeg"
        ? ".jpg"
        : ext;
    }
  } catch {}

  return ".jpg";
}

/* =====================================================
   SUPABASE — BOOKED ONLY
   ===================================================== */

async function getBookedCars() {
  const { data, error } =
    await supabase
      .from("cars")
      .select(`
        id,
        branch,
        brand,
        model,
        variant,
        year,
        odometer,
        status,
        ig_image_url,
        created_at
      `)
      .eq("status", "BOOKED")
      .not("ig_image_url", "is", null)
      .neq("ig_image_url", "")
      .order("created_at", {
        ascending: false,
      });

  if (error) {
    throw new Error(
      `Supabase error: ${error.message}`
    );
  }

  return (data ?? []).filter(
    (car) =>
      cleanText(car.ig_image_url)
  );
}

/* =====================================================
   DOWNLOAD ORIGINAL IG COVER
   ===================================================== */

async function downloadImage(url) {
  const response =
    await fetch(url, {
      cache: "no-store",
      headers: {
        "user-agent":
          "Garage88-BOOKED-IG-Cover-Downloader/1.0",
      },
    });

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}`
    );
  }

  return {
    buffer:
      Buffer.from(
        await response.arrayBuffer()
      ),

    extension:
      extensionFrom(
        response.headers.get(
          "content-type"
        ),
        url
      ),
  };
}

/* =====================================================
   MAIN
   ===================================================== */

async function main() {
  console.log("");

  console.log(
    "GARAGE88 — DOWNLOAD IG COVER BOOKED ONLY"
  );

  console.log(
    "=========================================="
  );

  const cars =
    await getBookedCars();

  if (!cars.length) {
    throw new Error(
      "Tidak ditemukan unit BOOKED dengan ig_image_url."
    );
  }

  const outputFolder =
    path.resolve(
      `exports/booked-ig-covers-${timestamp()}`
    );

  await mkdir(
    outputFolder,
    {
      recursive: true,
    }
  );

  console.log(
    `BOOKED dengan IG cover: ${cars.length}`
  );

  console.log("");

  const manifest = [[
    "ORDER",
    "CAR_ID",
    "MOBIL",
    "CABANG",
    "STATUS",
    "CREATED_AT",
    "IG_IMAGE_URL",
    "FILE",
    "HASIL",
  ]];

  let success = 0;
  let failed = 0;

  for (
    let index = 0;
    index < cars.length;
    index++
  ) {
    const car =
      cars[index];

    const order =
      index + 1;

    const name =
      carName(car);

    try {
      const image =
        await downloadImage(
          car.ig_image_url
        );

      const filename =
        `${pad(order, 3)}__` +
        `${safeFilename(name)}__` +
        `${safeFilename(
          car.branch || "NO_BRANCH"
        )}` +
        `${image.extension}`;

      const filePath =
        path.join(
          outputFolder,
          filename
        );

      await writeFile(
        filePath,
        image.buffer
      );

      success++;

      console.log(
        `✅ ${pad(order, 3)} — ${filename}`
      );

      manifest.push([
        order,
        car.id,
        name,
        car.branch ?? "",
        car.status ?? "",
        car.created_at ?? "",
        car.ig_image_url,
        filename,
        "BERHASIL",
      ]);
    } catch (error) {
      failed++;

      const message =
        error instanceof Error
          ? error.message
          : String(error);

      console.log(
        `❌ ${pad(order, 3)} — ${name} — ${message}`
      );

      manifest.push([
        order,
        car.id,
        name,
        car.branch ?? "",
        car.status ?? "",
        car.created_at ?? "",
        car.ig_image_url,
        "",
        `GAGAL: ${message}`,
      ]);
    }
  }

  const csv =
    manifest
      .map(
        (row) =>
          row
            .map(csvValue)
            .join(",")
      )
      .join("\n");

  await writeFile(
    path.join(
      outputFolder,
      "manifest.csv"
    ),
    csv,
    "utf8"
  );

  console.log("");

  console.log(
    "=========================================="
  );

  console.log(
    `✅ Berhasil: ${success}`
  );

  console.log(
    `❌ Gagal: ${failed}`
  );

  console.log(
    `📁 ${outputFolder}`
  );

  console.log("");

  if (
    process.platform ===
    "darwin"
  ) {
    exec(
      `open "${outputFolder}"`
    );
  }
}

main().catch(
  (error) => {
    console.error("");

    console.error(
      "FATAL ERROR:"
    );

    console.error(error);

    process.exit(1);
  }
);
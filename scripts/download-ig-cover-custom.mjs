
import { createClient } from "@supabase/supabase-js";
import { loadEnvFile } from "node:process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

// ============================================================
// 1. ENVIRONMENT
// ============================================================

for (const file of [".env", ".dev.vars"]) {
  try {
    loadEnvFile(file);
  } catch {
    // Environment file boleh tidak tersedia.
  }
}

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.PUBLIC_SUPABASE_URL;

const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error(
    "SUPABASE_URL/PUBLIC_SUPABASE_URL atau SUPABASE_SERVICE_KEY belum tersedia."
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// ============================================================
// 2. FINAL SELECTION
// 1 CAROUSEL — 4 UNIT
// ============================================================

const selectedCars = [
  {
    carousel: "CAROUSEL_1",
    order: 1,
    id: "13ce5bf6-f5dc-48cf-abdd-86188556317c",
    name: "NISSAN TERRA VL 4X4 AT 2019",
    branch: "AHA GAJAH MADA CIPONDOH",
  },
  {
    carousel: "CAROUSEL_1",
    order: 2,
    id: "cc90d929-c54f-43ac-b4c0-647b297839f2",
    name: "TOYOTA VELLFIRE G ATPM 2020",
    branch: "GARAGE88 CIATER",
  },
  {
    carousel: "CAROUSEL_1",
    order: 3,
    id: "b88b1055-4d00-425a-88c6-9869493e8446",
    name: "TOYOTA ALPHARD 2.5 G ATPM TSS 2022",
    branch: "GARAGE88 JOGLO",
  },
  {
    carousel: "CAROUSEL_1",
    order: 4,
    id: "cf227096-b114-4d91-aea3-e556cd06cfe5",
    name: "TOYOTA FORTUNER VRZ 2.4 AT SILVER 2018",
    branch: "AHA ADEX",
  },
];

// ============================================================
// 3. VALIDATION
// ============================================================

const carouselConfig = {
  CAROUSEL_1: "CAROUSEL_1_PREMIUM_SUV_LUXURY_MPV",
};

const expectedCounts = {
  CAROUSEL_1: 4,
};

for (const [carousel, expected] of Object.entries(expectedCounts)) {
  const cars = selectedCars
    .filter((car) => car.carousel === carousel)
    .sort((a, b) => a.order - b.order);

  if (
    cars.length !== expected ||
    cars.some((car, index) => car.order !== index + 1)
  ) {
    throw new Error(
      `${carousel} harus berisi ${expected} unit dengan urutan 1-${expected}.`
    );
  }
}

if (new Set(selectedCars.map((car) => car.id)).size !== selectedCars.length) {
  throw new Error("Ada ID mobil duplikat dalam pilihan carousel.");
}

// ============================================================
// 4. UTILITIES
// ============================================================

function timestamp() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + "_" + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("-");
}

function safeFilename(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

function getImageUrl(car) {
  return car.ig_image_url || car.cover_image_url || car.image_url || "";
}

function getImageExtension(url, contentType = "") {
  const type = String(contentType).toLowerCase();

  if (type.includes("png")) return ".png";
  if (type.includes("webp")) return ".webp";
  if (type.includes("avif")) return ".avif";
  if (type.includes("jpeg") || type.includes("jpg")) return ".jpg";

  try {
    const ext = path.extname(new URL(url).pathname).toLowerCase();
    if ([".jpg", ".jpeg", ".png", ".webp", ".avif"].includes(ext)) {
      return ext === ".jpeg" ? ".jpg" : ext;
    }
  } catch {
    // Default jpg.
  }

  return ".jpg";
}

async function downloadImage(url) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "user-agent": "Garage88-IG-Cover-Downloader/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") || "";

  if (!contentType.toLowerCase().startsWith("image/")) {
    throw new Error(
      `Response bukan gambar: ${contentType || "content-type kosong"}`
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  if (buffer.length === 0) {
    throw new Error("File gambar kosong");
  }

  return {
    buffer,
    extension: getImageExtension(url, contentType),
  };
}

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

// ============================================================
// 5. MAIN — DOWNLOAD 4 FOTO
// ============================================================

async function main() {
  console.log("==============================================");
  console.log(" GARAGE88 - IG COVER CUSTOM");
  console.log(" 1 CAROUSEL | 4 UNIT PREMIUM COLLECTION");
  console.log("==============================================");

  const ids = selectedCars.map((car) => car.id);

  const { data, error } = await supabase
    .from("cars")
    .select("*")
    .in("id", ids);

  if (error) {
    throw new Error(`Gagal mengambil data Supabase: ${error.message}`);
  }

  const carsById = new Map(
    (data || []).map((car) => [car.id, car])
  );

  const outputDir = path.resolve(
    "exports",
    `ig-cover-custom-4-unit-${timestamp()}`
  );

  const carouselFolder = carouselConfig.CAROUSEL_1;
  const targetDir = path.join(outputDir, carouselFolder);

  mkdirSync(targetDir, { recursive: true });

  const manifest = [];
  let successCount = 0;
  let failedCount = 0;

  console.log("");
  console.log(`Target download: ${selectedCars.length} unit`);
  console.log("");

  for (const selected of selectedCars) {
    const car = carsById.get(selected.id);

    let status = "";
    let filename = "";
    let imageUrl = "";
    let errorMessage = "";

    console.log(
      `${String(selected.order).padStart(2, "0")} | ${selected.name}`
    );

    if (!car) {
      status = "NOT_FOUND";
      errorMessage = "ID tidak ditemukan di Supabase";
      failedCount++;
    } else if (
      String(car.status || "").toUpperCase() !== "READY"
    ) {
      status = "NOT_READY";
      errorMessage = `Status unit adalah ${car.status || "kosong"}`;
      failedCount++;
    } else {
      imageUrl = String(getImageUrl(car) || "").trim();

      if (!imageUrl) {
        status = "NO_IMAGE";
        errorMessage = "URL IG cover tidak ditemukan";
        failedCount++;
      } else {
        try {
          const image = await downloadImage(imageUrl);
          const prefix = String(selected.order).padStart(2, "0");

          filename =
            `${prefix}__${safeFilename(selected.name)}` +
            `__${safeFilename(car.branch || selected.branch)}` +
            image.extension;

          writeFileSync(
            path.join(targetDir, filename),
            image.buffer
          );

          status = "DOWNLOADED";
          successCount++;

          console.log(`  OK: ${carouselFolder}/${filename}`);
        } catch (error) {
          status = "FAILED";
          errorMessage =
            error instanceof Error ? error.message : String(error);

          failedCount++;
          console.log(`  GAGAL: ${errorMessage}`);
        }
      }
    }

    if (status !== "DOWNLOADED") {
      console.log(`  GAGAL: ${errorMessage}`);
    }

    manifest.push({
      CAROUSEL: "CAROUSEL_1",
      FOLDER: carouselFolder,
      ORDER: selected.order,
      ID: selected.id,
      MOBIL: selected.name,
      CABANG: car?.branch || selected.branch,
      TAHUN: car?.year ?? "",
      STATUS_UNIT: car?.status || "",
      HARGA_CREDIT: car?.credit_price ?? "",
      KM: car?.odometer ?? "",
      HASIL: status,
      FILE: filename
        ? path.join(carouselFolder, filename)
        : "",
      IMAGE_URL: imageUrl,
      ERROR: errorMessage,
    });
  }

  // ==========================================================
  // 6. MANIFEST CSV
  // ==========================================================

  const headers = [
    "CAROUSEL",
    "FOLDER",
    "ORDER",
    "ID",
    "MOBIL",
    "CABANG",
    "TAHUN",
    "STATUS_UNIT",
    "HARGA_CREDIT",
    "KM",
    "HASIL",
    "FILE",
    "IMAGE_URL",
    "ERROR",
  ];

  const csv = [
    headers.map(csvEscape).join(","),
    ...manifest.map((row) =>
      headers.map((header) => csvEscape(row[header])).join(",")
    ),
  ].join("\n");

  writeFileSync(
    path.join(outputDir, "manifest.csv"),
    csv,
    "utf8"
  );

  // ==========================================================
  // 7. SUMMARY
  // ==========================================================

  console.log("");
  console.log("==============================================");
  console.log(" HASIL DOWNLOAD IG COVER CUSTOM");
  console.log("==============================================");

  console.log(`CAROUSEL_1: ${successCount}/4 berhasil`);
  console.log("----------------------------------------------");
  console.log(`Total target : ${selectedCars.length}`);
  console.log(`Berhasil     : ${successCount}`);
  console.log(`Gagal        : ${failedCount}`);
  console.log(`Output       : ${outputDir}`);
  console.log(`Manifest     : ${path.join(outputDir, "manifest.csv")}`);
  console.log("==============================================");

  if (failedCount > 0) {
    console.log(
      "PERHATIAN: Ada unit gagal didownload. Cek manifest.csv."
    );
  }
}

main().catch((error) => {
  console.error("\nERROR:", error.message);
  process.exitCode = 1;
});

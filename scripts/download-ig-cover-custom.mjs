
import { createClient } from "@supabase/supabase-js";
import { loadEnvFile } from "node:process";
import {
  mkdirSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

// ============================================================
// 1. ENVIRONMENT
// ============================================================

for (const file of [".env", ".dev.vars"]) {
  try {
    loadEnvFile(file);
  } catch {
    // File env boleh tidak ada jika variabel sudah tersedia.
  }
}

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.PUBLIC_SUPABASE_URL;

const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error(
    "SUPABASE_URL/PUBLIC_SUPABASE_URL atau SUPABASE_SERVICE_KEY belum tersedia."
  );
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

// ============================================================
// 2. PILIHAN 5 UNIT IG COVER
// ============================================================

const selectedCars = [
  {
    id: "4809c339-2eb3-40b3-b471-3bdf0dbc7423",
    name: "HONDA CRV 2.0 CVT FACELIFT PUTIH 2021",
    branch: "AHA GAJAH MADA CIPONDOH",
  },
  {
    id: "cca3dc69-97c3-47f0-878e-f662ad8604ad",
    name: "HONDA HRV E CVT AT MERAH 2018",
    branch: "GARAGE88 KEBAYORAN",
  },
  {
    id: "b5a228c3-b1c8-4656-865f-c006a1285e87",
    name: "HYUNDAI CRETA PRIME AT MERAH 2022",
    branch: "GARAGE88 KEBAYORAN",
  },
  {
    id: "c4774000-6746-4e9c-ab3e-d9297e827702",
    name: "MITSUBISHI XPANDER ULTIMATE 2022",
    branch: "GARAGE88 KEBAYORAN",
  },
  {
    id: "9cdc6307-9dad-4a79-ac2f-d8b200dc3066",
    name: "TOYOTA INNOVA ZENIX V BENSIN 2022",
    branch: "AHA GALLERY",
  },
];

// ============================================================
// 3. UTILITIES
// ============================================================

function timestamp() {
  const date = new Date();

  const pad = (value) =>
    String(value).padStart(2, "0");

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
  return (
    car.ig_image_url ||
    car.cover_image_url ||
    car.image_url ||
    ""
  );
}

function getImageExtension(url, contentType = "") {
  const type = contentType.toLowerCase();

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
    const ext = path
      .extname(new URL(url).pathname)
      .toLowerCase();

    if (
      [".jpg", ".jpeg", ".png", ".webp", ".avif"]
        .includes(ext)
    ) {
      return ext === ".jpeg" ? ".jpg" : ext;
    }
  } catch {
    // Gunakan ekstensi default.
  }

  return ".jpg";
}

async function downloadImage(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Garage88-IG-Cover-Downloader/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} ${response.statusText}`
    );
  }

  const contentType =
    response.headers.get("content-type") || "";

  if (!contentType.toLowerCase().startsWith("image/")) {
    throw new Error(
      `Response bukan gambar: ${contentType || "content-type kosong"}`
    );
  }

  const buffer = Buffer.from(
    await response.arrayBuffer()
  );

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
// 4. MAIN — DOWNLOAD 5 IG COVERS
// ============================================================

async function main() {
  console.log("==============================================");
  console.log(" GARAGE88 — DOWNLOAD TOP 5 IG COVERS");
  console.log("==============================================");
  console.log("");

  const ids = selectedCars.map((car) => car.id);

  const { data, error } = await supabase
    .from("cars")
    .select("*")
    .in("id", ids);

  if (error) {
    throw new Error(
      `Gagal mengambil data Supabase: ${error.message}`
    );
  }

  const carsById = new Map(
    (data || []).map((car) => [car.id, car])
  );

  const outputDir = path.resolve(
    "exports",
    `ig-cover-top-5-${timestamp()}`
  );

  mkdirSync(outputDir, { recursive: true });

  const manifest = [];
  let successCount = 0;
  let failedCount = 0;

  for (const [index, selected] of selectedCars.entries()) {
    const order = index + 1;
    const car = carsById.get(selected.id);

    let status = "";
    let filename = "";
    let imageUrl = "";
    let errorMessage = "";

    console.log(
      `${String(order).padStart(2, "0")}: ${selected.name}`
    );

    if (!car) {
      status = "NOT_FOUND";
      errorMessage = "ID tidak ditemukan";
      failedCount++;
    } else if (car.status !== "READY") {
      status = "NOT_READY";
      errorMessage =
        `Status unit adalah ${car.status || "kosong"}`;
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

          const prefix =
            String(order).padStart(2, "0");

          filename =
            `${prefix}__${safeFilename(selected.name)}` +
            `__${safeFilename(selected.branch)}` +
            image.extension;

          writeFileSync(
            path.join(outputDir, filename),
            image.buffer
          );

          status = "DOWNLOADED";
          successCount++;

          console.log(`  ✅ ${filename}`);
        } catch (error) {
          status = "FAILED";
          errorMessage =
            error instanceof Error
              ? error.message
              : String(error);

          failedCount++;
          console.log(`  ❌ ${errorMessage}`);
        }
      }
    }

    if (status !== "DOWNLOADED") {
      console.log(`  ❌ ${errorMessage}`);
    }

    manifest.push({
      ORDER: order,
      ID: selected.id,
      MOBIL: selected.name,
      CABANG: selected.branch,
      STATUS_UNIT: car?.status || "",
      HASIL: status,
      FILE: filename,
      IMAGE_URL: imageUrl,
      ERROR: errorMessage,
    });
  }

  const headers = [
    "ORDER",
    "ID",
    "MOBIL",
    "CABANG",
    "STATUS_UNIT",
    "HASIL",
    "FILE",
    "IMAGE_URL",
    "ERROR",
  ];

  const csv = [
    headers.map(csvEscape).join(","),
    ...manifest.map((row) =>
      headers
        .map((header) => csvEscape(row[header]))
        .join(",")
    ),
  ].join("\n");

  writeFileSync(
    path.join(outputDir, "manifest.csv"),
    csv,
    "utf8"
  );

  console.log("");
  console.log("==============================================");
  console.log("HASIL DOWNLOAD");
  console.log("==============================================");
  console.log(`✅ Berhasil: ${successCount}`);
  console.log(`❌ Gagal   : ${failedCount}`);
  console.log(`📁 Output  : ${outputDir}`);
  console.log(
    `📄 Manifest: ${path.join(outputDir, "manifest.csv")}`
  );
}

main().catch((error) => {
  console.error("\n❌ ERROR:", error.message);
  process.exitCode = 1;
});

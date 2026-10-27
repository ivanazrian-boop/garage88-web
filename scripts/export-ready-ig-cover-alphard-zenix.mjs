import { createClient } from "@supabase/supabase-js";
import { loadEnvFile } from "node:process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { exec } from "node:child_process";


/* =====================================================
   ENV
   ===================================================== */

function tryLoadEnv(file) {
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
   OPTIONAL ARGUMENT

   contoh:
   --start=0
   --limit=20
   ===================================================== */

const args = process.argv.slice(2);


function argNumber(name, fallback) {
  const prefix = `--${name}=`;

  const found = args.find(
    (arg) => arg.startsWith(prefix)
  );

  if (!found) {
    return fallback;
  }

  const value = Number(
    found.slice(prefix.length)
  );

  return Number.isFinite(value)
    ? value
    : fallback;
}


const start =
  Math.max(
    0,
    argNumber("start", 0)
  );


const limit =
  Math.max(
    0,
    argNumber("limit", 0)
  );


/* =====================================================
   HELPERS
   ===================================================== */

function pad(
  number,
  length = 3
) {
  return String(number)
    .padStart(length, "0");
}


function cleanFilename(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[^\w\s.-]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}


function csvValue(value) {
  return `"${String(value ?? "")
    .replaceAll('"', '""')}"`;
}


function timestamp() {
  const now = new Date();

  const y =
    now.getFullYear();

  const m =
    pad(
      now.getMonth() + 1,
      2
    );

  const d =
    pad(
      now.getDate(),
      2
    );

  const h =
    pad(
      now.getHours(),
      2
    );

  const min =
    pad(
      now.getMinutes(),
      2
    );

  return `${y}${m}${d}-${h}${min}`;
}


function normalizeText(value) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/CR-V/g, "CRV")
    .replace(/SANTA-FE/g, "SANTA FE")
    .replace(/\s+/g, " ")
    .trim();
}


/* =====================================================
   MODEL FILTER
   ===================================================== */

function getFullCarText(car) {
  return normalizeText(
    [
      car.brand,
      car.model,
      car.variant,
    ]
      .filter(Boolean)
      .join(" ")
  );
}


function isIoniq(car) {
  const text =
    getFullCarText(car);

  return text.includes("IONIQ");
}


function isKona(car) {
  const text =
    getFullCarText(car);

  return text.includes("KONA");
}


/* =====================================================
   PRIORITY

   1. IONIQ
   2. KONA
   ===================================================== */

function getPriority(car) {
  if (isIoniq(car)) {
    return 0;
  }

  if (isKona(car)) {
    return 1;
  }

  return 99;
}


/* =====================================================
   IMAGE EXTENSION
   ===================================================== */

function getExtFromUrl(url) {
  const clean =
    String(url ?? "")
      .split("?")[0]
      .toLowerCase();

  if (clean.endsWith(".png")) {
    return "png";
  }

  if (clean.endsWith(".webp")) {
    return "webp";
  }

  return "jpg";
}


/* =====================================================
   GET READY CARS
   ===================================================== */

async function getCars() {
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
        status,
        credit_price,
        ig_image_url,
        created_at
      `)
      .eq(
        "status",
        "READY"
      );


  if (error) {
    throw new Error(
      `Gagal mengambil cars: ${error.message}`
    );
  }


  let rows =
    (data ?? [])
      .filter(
        (car) => {

          const hasIg =
            String(
              car.ig_image_url ?? ""
            )
              .trim() !== "";


          return (
            hasIg &&
            (
              isIoniq(car) ||
              isKona(car)
            )
          );

        }
      );


  /* ===================================================
     SORT

     1. IONIQ
     2. KONA

     Dalam group:
     harga termurah dulu
     lalu tahun terbaru
     =================================================== */

  rows.sort(
    (a, b) => {

      const priorityA =
        getPriority(a);

      const priorityB =
        getPriority(b);


      if (
        priorityA !==
        priorityB
      ) {
        return (
          priorityA -
          priorityB
        );
      }


      const priceA =
        Number.isFinite(
          Number(
            a.credit_price
          )
        )
          ? Number(
              a.credit_price
            )
          : Number.POSITIVE_INFINITY;


      const priceB =
        Number.isFinite(
          Number(
            b.credit_price
          )
        )
          ? Number(
              b.credit_price
            )
          : Number.POSITIVE_INFINITY;


      if (
        priceA !==
        priceB
      ) {
        return (
          priceA -
          priceB
        );
      }


      const yearCompare =
        Number(
          b.year ?? 0
        )
        -
        Number(
          a.year ?? 0
        );


      if (
        yearCompare !== 0
      ) {
        return yearCompare;
      }


      return String(
        b.created_at ?? ""
      )
        .localeCompare(
          String(
            a.created_at ?? ""
          )
        );

    }
  );


  /* ===================================================
     START / LIMIT
     =================================================== */

  if (limit > 0) {
    return rows.slice(
      start,
      start + limit
    );
  }


  return rows.slice(start);
}


/* =====================================================
   MAIN
   ===================================================== */

async function main() {
  console.log("");
  console.log(
    "GARAGE88 EXPORT READY IG COVER"
  );

  console.log(
    "IONIQ + KONA"
  );

  console.log(
    "================================"
  );

  console.log("");


  if (start > 0) {
    console.log(
      `Start : ${start}`
    );
  }


  if (limit > 0) {
    console.log(
      `Limit : ${limit}`
    );
  }


  console.log("");
  console.log("URUTAN:");
  console.log("1. IONIQ");
  console.log("2. KONA");
  console.log("");


  const cars =
    await getCars();


  console.log(
    `IG Cover READY ditemukan: ${cars.length}`
  );


  if (
    cars.length === 0
  ) {
    console.log(
      "Tidak ada IG Cover READY untuk Ioniq/Kona."
    );

    return;
  }


  /* ===================================================
     OUTPUT FOLDER
     =================================================== */

  const folder =
    path.resolve(
      `exports/ig-cover-ready-ioniq-kona-${timestamp()}`
    );


  await mkdir(
    folder,
    {
      recursive: true,
    }
  );


  /* ===================================================
     MANIFEST
     =================================================== */

  const manifest = [[
    "NO",
    "CAR_ID",
    "CAR",
    "YEAR",
    "CREDIT_PRICE",
    "FILENAME",
    "IG_IMAGE_URL",
    "STATUS",
  ]];


  let success = 0;
  let failed = 0;


  /* ===================================================
     DOWNLOAD
     =================================================== */

  for (
    let index = 0;
    index < cars.length;
    index++
  ) {

    const car =
      cars[index];


    const number =
      pad(
        index + 1
      );


    const carName =
      [
        car.brand,
        car.model,
        car.variant,
      ]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();


    console.log("");
    console.log(
      `[${index + 1}/${cars.length}] ` +
      `${carName} ` +
      `${car.year ?? ""} | ` +
      `OTR: ${car.credit_price ?? "-"}`
    );


    try {

      /* -----------------------------------------------
         DOWNLOAD IG COVER
         ----------------------------------------------- */

      const response =
        await fetch(
          car.ig_image_url,
          {
            cache: "no-store",
          }
        );


      if (
        !response.ok
      ) {
        throw new Error(
          `HTTP ${response.status}`
        );
      }


      const bytes =
        new Uint8Array(
          await response.arrayBuffer()
        );


      /* -----------------------------------------------
         FILE NAME
         ----------------------------------------------- */

      const baseName =
        cleanFilename(
          [
            car.brand,
            car.model,
            car.variant,
            car.year,
          ]
            .filter(Boolean)
            .join(" ")
        );


      const ext =
        getExtFromUrl(
          car.ig_image_url
        );


      const filename =
        `${number}__` +
        `${baseName}__` +
        `IG_COVER.${ext}`;


      const outputPath =
        path.join(
          folder,
          filename
        );


      /* -----------------------------------------------
         SAVE ORIGINAL FILE
         ----------------------------------------------- */

      await writeFile(
        outputPath,
        bytes
      );


      /* -----------------------------------------------
         MANIFEST SUCCESS
         ----------------------------------------------- */

      manifest.push([
        index + 1,
        car.id,
        carName,
        car.year ?? "",
        car.credit_price ?? "",
        filename,
        car.ig_image_url,
        "SUCCESS",
      ]);


      success++;


      console.log(
        `  ✅ ${filename}`
      );

    } catch (error) {

      failed++;


      const message =
        error instanceof Error
          ? error.message
          : String(error);


      manifest.push([
        index + 1,
        car.id,
        carName,
        car.year ?? "",
        car.credit_price ?? "",
        "",
        car.ig_image_url,
        `FAILED: ${message}`,
      ]);


      console.log(
        `  ❌ ${message}`
      );

    }

  }


  /* ===================================================
     SAVE MANIFEST CSV
     =================================================== */

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
      folder,
      "manifest.csv"
    ),
    csv,
    "utf8"
  );


  /* ===================================================
     SUMMARY
     =================================================== */

  console.log("");
  console.log(
    "================================"
  );

  console.log(
    "SELESAI"
  );

  console.log(
    `✅ Download : ${success}`
  );

  console.log(
    `❌ Gagal    : ${failed}`
  );

  console.log(
    `📦 Total    : ${cars.length}`
  );

  console.log("");

  console.log(
    `Folder: ${folder}`
  );

  console.log("");


  /* ===================================================
     OPEN FINDER
     =================================================== */

  if (
    process.platform ===
    "darwin"
  ) {

    exec(
      `open "${folder}"`
    );

  }

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
        error
      );

      process.exit(1);

    }
  );
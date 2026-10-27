import { createClient } from "@supabase/supabase-js";

import {
  mkdir,
  writeFile,
} from "node:fs/promises";

import path from "node:path";

import {
  loadEnvFile,
} from "node:process";

import {
  spawn,
} from "node:child_process";


/* =====================================================
   LOAD ENV
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
  throw new Error(
    "SUPABASE_URL / PUBLIC_SUPABASE_URL tidak ditemukan."
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
   HELPERS
   ===================================================== */

function cleanFilename(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toUpperCase()
    .replace(
      /[^A-Z0-9]+/g,
      "_"
    )
    .replace(
      /^_+|_+$/g,
      ""
    )
    .slice(0, 100);
}


function pad(number) {
  return String(number)
    .padStart(3, "0");
}


function timestamp() {
  const now = new Date();

  const yyyy =
    now.getFullYear();

  const mm =
    String(
      now.getMonth() + 1
    ).padStart(2, "0");

  const dd =
    String(
      now.getDate()
    ).padStart(2, "0");

  const hh =
    String(
      now.getHours()
    ).padStart(2, "0");

  const min =
    String(
      now.getMinutes()
    ).padStart(2, "0");

  return `${yyyy}${mm}${dd}-${hh}${min}`;
}


function chunk(
  array,
  size
) {
  const result = [];

  for (
    let i = 0;
    i < array.length;
    i += size
  ) {
    result.push(
      array.slice(
        i,
        i + size
      )
    );
  }

  return result;
}


function csvCell(value) {
  return `"${String(value ?? "")
    .replaceAll('"', '""')}"`;
}


function getExtension(
  url,
  contentType
) {
  const type =
    String(contentType ?? "")
      .toLowerCase();

  if (
    type.includes("png")
  ) {
    return "png";
  }

  if (
    type.includes("webp")
  ) {
    return "webp";
  }

  try {
    const ext =
      path.extname(
        new URL(url).pathname
      )
        .replace(".", "")
        .toLowerCase();

    if (
      [
        "jpg",
        "jpeg",
        "png",
        "webp",
      ].includes(ext)
    ) {
      return ext === "jpeg"
        ? "jpg"
        : ext;
    }
  } catch {
    // ignore
  }

  return "jpg";
}


/* =====================================================
   GET READY CARS
   URUT SAMA DENGAN ADMIN
   ===================================================== */

async function getReadyCars() {
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
        created_at,
        cover_source_image_url
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


  return data ?? [];
}


/* =====================================================
   FIRST IMAGE
   ===================================================== */

async function getFirstImages(
  cars
) {
  const result =
    new Map();


  const batches =
    chunk(
      cars.map(
        (car) =>
          car.id
      ),
      40
    );


  for (
    let batchIndex = 0;
    batchIndex < batches.length;
    batchIndex++
  ) {

    const ids =
      batches[
        batchIndex
      ];


    const {
      data,
      error,
    } =
      await supabase
        .from("car_images")
        .select(`
          car_id,
          image_url,
          sort_order,
          created_at
        `)
        .in(
          "car_id",
          ids
        )
        .order(
          "sort_order",
          {
            ascending: true,
            nullsFirst: false,
          }
        )
        .order(
          "created_at",
          {
            ascending: true,
          }
        );


    if (error) {
      throw new Error(
        `Gagal mengambil car_images: ${error.message}`
      );
    }


    for (
      const image of
        data ?? []
    ) {

      if (
        !result.has(
          image.car_id
        )
      ) {
        result.set(
          image.car_id,
          image.image_url
        );
      }

    }


    console.log(
      `Image batch ${
        batchIndex + 1
      }/${batches.length} OK`
    );
  }


  return result;
}


/* =====================================================
   DOWNLOAD
   ===================================================== */

async function downloadImage(
  url,
  destinationWithoutExt
) {

  const response =
    await fetch(url);


  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}`
    );
  }


  const contentType =
    response.headers.get(
      "content-type"
    );


  const ext =
    getExtension(
      url,
      contentType
    );


  const destination =
    `${destinationWithoutExt}.${ext}`;


  const bytes =
    Buffer.from(
      await response.arrayBuffer()
    );


  await writeFile(
    destination,
    bytes
  );


  return path.basename(
    destination
  );
}


/* =====================================================
   MAIN
   ===================================================== */

async function main() {

  console.log("");
  console.log(
    "GARAGE88 - EXPORT MISSING PHOTOROOM"
  );

  console.log(
    "===================================="
  );

  console.log("");


  const allReady =
    await getReadyCars();


  console.log(
    `READY total : ${allReady.length}`
  );


  /*
   * Simpan posisi asli di Admin
   */

  const missing =
    allReady
      .map(
        (
          car,
          adminIndex
        ) => ({
          ...car,

          admin_position:
            adminIndex + 1,
        })
      )
      .filter(
        (car) => {

          const source =
            String(
              car.cover_source_image_url ??
              ""
            ).trim();

          return !source;
        }
      );


  console.log(
    `PhotoRoom kosong : ${missing.length}`
  );

  console.log("");


  if (
    missing.length === 0
  ) {
    console.log(
      "Semua mobil READY sudah punya PHOTOROOM POLOS."
    );

    return;
  }


  const firstImages =
    await getFirstImages(
      missing
    );


  const outputDir =
    path.resolve(
      "exports",
      `missing-photoroom-${timestamp()}`
    );


  await mkdir(
    outputDir,
    {
      recursive: true,
    }
  );


  const manifest = [];


  let success = 0;
  let failed = 0;


  for (
    let i = 0;
    i < missing.length;
    i++
  ) {

    const car =
      missing[i];


    const sequence =
      pad(
        i + 1
      );


    const adminPosition =
      pad(
        car.admin_position
      );


    const label =
      [
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


    const imageUrl =
      firstImages.get(
        car.id
      );


    if (!imageUrl) {

      console.log(
        `⚠️ ${sequence} ${label} — tidak ada foto`
      );


      failed++;


      manifest.push({
        sequence,
        admin_position:
          car.admin_position,

        car_id:
          car.id,

        car:
          label,

        filename:
          "",

        status:
          "NO IMAGE",
      });


      continue;
    }


    /*
     * PENTING:
     *
     * ID mobil FULL ikut di nama file.
     *
     * Jadi nanti hasil PhotoRoom
     * tetap bisa dipasangkan ke mobil
     * yang benar.
     */


    const baseName =
      [
        sequence,

        `ADMIN-${adminPosition}`,

        cleanFilename(
          label
        ),

        `ID-${car.id}`,
      ]
        .join("__");


    try {

      const filename =
        await downloadImage(
          imageUrl,
          path.join(
            outputDir,
            baseName
          )
        );


      success++;


      console.log(
        `✅ ${sequence} | Admin ${car.admin_position} | ${label}`
      );


      manifest.push({
        sequence,

        admin_position:
          car.admin_position,

        car_id:
          car.id,

        car:
          label,

        filename,

        status:
          "OK",
      });


    } catch (error) {

      failed++;


      const message =
        error instanceof Error
          ? error.message
          : String(error);


      console.log(
        `❌ ${sequence} ${label} — ${message}`
      );


      manifest.push({
        sequence,

        admin_position:
          car.admin_position,

        car_id:
          car.id,

        car:
          label,

        filename:
          "",

        status:
          `ERROR ${message}`,
      });

    }

  }


  /* ===================================================
     MANIFEST CSV
     =================================================== */

  const csv =
    [
      [
        "NO",
        "ADMIN_POSITION",
        "CAR_ID",
        "CAR",
        "FILENAME",
        "STATUS",
      ].join(","),

      ...manifest.map(
        (row) =>
          [
            row.sequence,
            row.admin_position,
            row.car_id,
            row.car,
            row.filename,
            row.status,
          ]
            .map(
              csvCell
            )
            .join(",")
      ),
    ]
      .join("\n");


  await writeFile(
    path.join(
      outputDir,
      "manifest.csv"
    ),
    csv,
    "utf8"
  );


  console.log("");
  console.log(
    "===================================="
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
    `📦 Missing  : ${missing.length}`
  );

  console.log("");

  console.log(
    outputDir
  );


  /*
   * Buka Finder otomatis
   */

  if (
    process.platform ===
    "darwin"
  ) {

    const child =
      spawn(
        "open",
        [
          outputDir,
        ],
        {
          detached: true,
          stdio: "ignore",
        }
      );


    child.unref();
  }

}


main()
  .catch(
    (error) => {

      console.error("");
      console.error(
        "EXPORT GAGAL:"
      );

      console.error(
        error
      );

      process.exit(1);

    }
  );
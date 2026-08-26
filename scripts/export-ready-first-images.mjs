import { createClient } from "@supabase/supabase-js";
import {
  mkdir,
  writeFile,
} from "node:fs/promises";

import path from "node:path";
import { loadEnvFile } from "node:process";
import { spawn } from "node:child_process";


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

function chunk(array, size) {
  const result = [];

  for (
    let i = 0;
    i < array.length;
    i += size
  ) {
    result.push(
      array.slice(i, i + size)
    );
  }

  return result;
}


function cleanFilename(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 100);
}


function shortId(id) {
  return String(id)
    .split("-")[0];
}


function padNumber(number) {
  return String(number)
    .padStart(3, "0");
}


function createTimestamp() {
  const now = new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      now.getDate()
    ).padStart(2, "0");

  const hour =
    String(
      now.getHours()
    ).padStart(2, "0");

  const minute =
    String(
      now.getMinutes()
    ).padStart(2, "0");

  return `${year}${month}${day}-${hour}${minute}`;
}


function getExtension(
  url,
  contentType
) {
  const type =
    String(contentType ?? "")
      .toLowerCase();

  if (
    type.includes("image/png")
  ) {
    return "png";
  }

  if (
    type.includes("image/webp")
  ) {
    return "webp";
  }

  if (
    type.includes("image/jpeg") ||
    type.includes("image/jpg")
  ) {
    return "jpg";
  }

  try {
    const pathname =
      new URL(url).pathname;

    const ext =
      path
        .extname(pathname)
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


function csvCell(value) {
  const text =
    String(value ?? "");

  return `"${text.replaceAll(
    '"',
    '""'
  )}"`;
}


/* =====================================================
   GET READY CARS
   SAME ORDER AS ADMIN
   ===================================================== */

async function getReadyCars() {
  const {
    data,
    error,
  } =
    await supabase
      .from("cars")
      .select(
        `
        id,
        brand,
        model,
        variant,
        year,
        created_at
        `
      )
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
      `Gagal mengambil mobil: ${error.message}`
    );
  }


  return data ?? [];
}


/* =====================================================
   GET FIRST IMAGE FOR EVERY CAR

   Batch supaya tidak perlu 200 request satu-satu.
   ===================================================== */

async function getFirstImages(cars) {
  const result =
    new Map();

  const batches =
    chunk(
      cars.map(
        (car) => car.id
      ),
      40
    );


  console.log(
    `Mengambil foto dari ${cars.length} mobil...`
  );


  for (
    let batchIndex = 0;
    batchIndex < batches.length;
    batchIndex++
  ) {
    const ids =
      batches[batchIndex];


    const {
      data,
      error,
    } =
      await supabase
        .from("car_images")
        .select(
          `
          car_id,
          image_url,
          sort_order,
          created_at
          `
        )
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
      const image of data ?? []
    ) {
      /*
       * Karena hasil sudah sort_order ASC,
       * image pertama yang ditemukan
       * adalah foto pertama mobil.
       */
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
      `Foto batch ${
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
  car,
  imageUrl,
  index,
  outputDir
) {
  const carLabel =
    [
      car.brand,
      car.model,
      car.variant,
      car.year,
    ]
      .filter(Boolean)
      .join(" ");


  const number =
    padNumber(
      index + 1
    );


  const baseName =
    [
      number,
      cleanFilename(
        carLabel
      ),
      shortId(
        car.id
      ),
    ]
      .filter(Boolean)
      .join("__");


  const response =
    await fetch(
      imageUrl
    );


  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}`
    );
  }


  const contentType =
    response.headers.get(
      "content-type"
    );


  const extension =
    getExtension(
      imageUrl,
      contentType
    );


  const filename =
    `${baseName}.${extension}`;


  const destination =
    path.join(
      outputDir,
      filename
    );


  const arrayBuffer =
    await response.arrayBuffer();


  await writeFile(
    destination,
    Buffer.from(
      arrayBuffer
    )
  );


  return {
    filename,
    carLabel,
  };
}


/* =====================================================
   DOWNLOAD POOL
   ===================================================== */

async function runDownloadPool(
  jobs,
  concurrency,
  handler
) {
  let cursor = 0;


  async function worker() {
    while (true) {
      const current =
        cursor++;

      if (
        current >= jobs.length
      ) {
        return;
      }

      await handler(
        jobs[current]
      );
    }
  }


  await Promise.all(
    Array.from(
      {
        length:
          Math.min(
            concurrency,
            jobs.length
          ),
      },
      () => worker()
    )
  );
}


/* =====================================================
   MAIN
   ===================================================== */

async function main() {
  console.log("");
  console.log(
    "GARAGE88 PHOTOROOM EXPORT"
  );
  console.log(
    "=========================="
  );
  console.log("");


  const cars =
    await getReadyCars();


  if (
    cars.length === 0
  ) {
    console.log(
      "Tidak ada mobil READY."
    );

    return;
  }


  console.log(
    `${cars.length} mobil READY ditemukan.`
  );


  const firstImages =
    await getFirstImages(
      cars
    );


  const timestamp =
    createTimestamp();


  const outputDir =
    path.resolve(
      "exports",
      `photoroom-ready-${timestamp}`
    );


  await mkdir(
    outputDir,
    {
      recursive: true,
    }
  );


  const manifest =
    new Array(
      cars.length
    );


  const jobs =
    cars.map(
      (car, index) => ({
        car,
        index,
      })
    );


  let success = 0;
  let failed = 0;


  await runDownloadPool(
    jobs,
    6,
    async ({
      car,
      index,
    }) => {

      const number =
        padNumber(
          index + 1
        );


      const imageUrl =
        firstImages.get(
          car.id
        );


      const carLabel =
        [
          car.brand,
          car.model,
          car.variant,
          car.year,
        ]
          .filter(Boolean)
          .join(" ");


      if (!imageUrl) {
        console.log(
          `❌ ${number} ${carLabel} — tidak ada foto`
        );

        failed++;


        manifest[index] = {
          number,
          car_id:
            car.id,

          name:
            carLabel,

          filename:
            "",

          image_url:
            "",

          status:
            "NO IMAGE",
        };


        return;
      }


      try {
        const result =
          await downloadImage(
            car,
            imageUrl,
            index,
            outputDir
          );


        success++;


        console.log(
          `✅ ${number} ${carLabel}`
        );


        manifest[index] = {
          number,

          car_id:
            car.id,

          name:
            carLabel,

          filename:
            result.filename,

          image_url:
            imageUrl,

          status:
            "OK",
        };

      } catch (error) {

        failed++;


        const message =
          error instanceof Error
            ? error.message
            : String(error);


        console.log(
          `❌ ${number} ${carLabel} — ${message}`
        );


        manifest[index] = {
          number,

          car_id:
            car.id,

          name:
            carLabel,

          filename:
            "",

          image_url:
            imageUrl,

          status:
            `ERROR: ${message}`,
        };
      }
    }
  );


  /* ===================================================
     MANIFEST CSV
     =================================================== */

  const csvHeader = [
    "NO",
    "CAR_ID",
    "MOBIL",
    "FILENAME",
    "ORIGINAL_IMAGE_URL",
    "STATUS",
  ];


  const csvRows =
    manifest.map(
      (row) =>
        [
          row.number,
          row.car_id,
          row.name,
          row.filename,
          row.image_url,
          row.status,
        ]
          .map(csvCell)
          .join(",")
    );


  const csv =
    [
      csvHeader.join(","),
      ...csvRows,
    ].join("\n");


  const manifestPath =
    path.join(
      outputDir,
      "manifest.csv"
    );


  await writeFile(
    manifestPath,
    csv,
    "utf8"
  );


  console.log("");
  console.log(
    "=========================="
  );

  console.log(
    `SELESAI`
  );

  console.log(
    `Berhasil : ${success}`
  );

  console.log(
    `Gagal    : ${failed}`
  );

  console.log(
    `Total    : ${cars.length}`
  );

  console.log("");

  console.log(
    `Folder:`
  );

  console.log(
    outputDir
  );

  console.log("");

  console.log(
    "manifest.csv juga sudah dibuat."
  );


  /*
   * Auto open Finder on Mac
   */
  if (
    process.platform ===
    "darwin"
  ) {
    const child =
      spawn(
        "open",
        [outputDir],
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
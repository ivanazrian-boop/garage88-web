import { createClient } from "@supabase/supabase-js";
import {
  readdir,
  readFile,
} from "node:fs/promises";

import path from "node:path";
import { loadEnvFile } from "node:process";


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
   ARGUMENT
   ===================================================== */

const args =
  process.argv.slice(2);


const folderArg =
  args.find(
    (arg) =>
      !arg.startsWith("--")
  );


const dryRun =
  args.includes("--dry-run");


if (!folderArg) {
  console.log("");
  console.log(
    "Cara pakai:"
  );

  console.log(
    'node scripts/upload-photoroom-by-id.mjs "/Users/azrian/Downloads/FOLDER-HASIL-PHOTOROOM"'
  );

  console.log("");

  process.exit(1);
}


const PHOTOROOM_FOLDER =
  path.resolve(folderArg);


/* =====================================================
   HELPERS
   ===================================================== */

function isImage(filename) {
  return /\.(jpe?g|png|webp)$/i.test(
    filename
  );
}


function getExtension(filename) {
  const ext =
    path
      .extname(filename)
      .toLowerCase();


  if (ext === ".png") {
    return "png";
  }

  if (ext === ".webp") {
    return "webp";
  }

  return "jpg";
}


function getContentType(filename) {
  const ext =
    path
      .extname(filename)
      .toLowerCase();


  if (ext === ".png") {
    return "image/png";
  }

  if (ext === ".webp") {
    return "image/webp";
  }

  return "image/jpeg";
}


/*
 * Bisa membaca:
 *
 * ID-68145487-f67f-4bc8-9d93-db0904392749
 *
 * atau UUID biasa di dalam nama file.
 */
function extractCarId(filename) {
  const explicit =
    filename.match(
      /ID-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
    );


  if (explicit) {
    return explicit[1];
  }


  const generic =
    filename.match(
      /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
    );


  return generic
    ? generic[1]
    : null;
}


/* =====================================================
   GET CAR
   ===================================================== */

async function getCar(carId) {
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
        cover_source_image_url
      `)
      .eq(
        "id",
        carId
      )
      .single();


  if (
    error ||
    !data
  ) {
    return null;
  }


  return data;
}


/* =====================================================
   UPLOAD
   ===================================================== */

async function uploadPhotoRoom(
  carId,
  filePath,
  filename
) {
  const bytes =
    await readFile(
      filePath
    );


  const ext =
    getExtension(
      filename
    );


  const contentType =
    getContentType(
      filename
    );


  const storagePath =
    `${carId}/cover-source/photoroom.${ext}`;


  const {
    error: uploadError,
  } =
    await supabase
      .storage
      .from("cars")
      .upload(
        storagePath,
        bytes,
        {
          contentType,
          cacheControl: "0",
          upsert: true,
        }
      );


  if (uploadError) {
    throw new Error(
      `Storage: ${uploadError.message}`
    );
  }


  const publicUrl =
    supabase
      .storage
      .from("cars")
      .getPublicUrl(
        storagePath
      )
      .data
      .publicUrl;


  const {
    error: updateError,
  } =
    await supabase
      .from("cars")
      .update({
        cover_source_image_url:
          publicUrl,
      })
      .eq(
        "id",
        carId
      );


  if (updateError) {
    throw new Error(
      `Database: ${updateError.message}`
    );
  }


  return publicUrl;
}


/* =====================================================
   MAIN
   ===================================================== */

async function main() {
  console.log("");
  console.log(
    "GARAGE88 PHOTOROOM UPLOAD BY CAR ID"
  );

  console.log(
    "===================================="
  );

  console.log("");

  console.log(
    `Folder : ${PHOTOROOM_FOLDER}`
  );

  console.log(
    `Mode   : ${
      dryRun
        ? "DRY RUN"
        : "UPLOAD"
    }`
  );

  console.log("");


  const files =
    await readdir(
      PHOTOROOM_FOLDER
    );


  const images =
    files
      .filter(isImage)
      .sort();


  console.log(
    `${images.length} gambar ditemukan.`
  );

  console.log("");


  let success = 0;
  let skipped = 0;
  let failed = 0;


  for (
    let index = 0;
    index < images.length;
    index++
  ) {

    const filename =
      images[index];


    const carId =
      extractCarId(
        filename
      );


    if (!carId) {
      console.log(
        `⚠️ SKIP ${filename}`
      );

      console.log(
        "   CAR ID tidak ditemukan di filename"
      );

      skipped++;

      continue;
    }


    const car =
      await getCar(
        carId
      );


    if (!car) {
      console.log(
        `❌ ${filename}`
      );

      console.log(
        `   Mobil ID ${carId} tidak ditemukan di database`
      );

      failed++;

      continue;
    }


    const label =
      [
        car.brand,
        car.model,
        car.variant,
        car.year,
      ]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();


    console.log(
      `[${index + 1}/${images.length}] ${label}`
    );

    console.log(
      `   ID   : ${carId}`
    );

    console.log(
      `   File : ${filename}`
    );


    if (
      car.status !== "READY"
    ) {
      console.log(
        `   ⚠️ Status mobil: ${car.status}`
      );
    }


    if (dryRun) {

      console.log(
        "   ✅ MATCH — belum diupload"
      );

      success++;

      console.log("");

      continue;
    }


    try {

      const filePath =
        path.join(
          PHOTOROOM_FOLDER,
          filename
        );


      await uploadPhotoRoom(
        carId,
        filePath,
        filename
      );


      console.log(
        "   ✅ PHOTOROOM POLOS uploaded"
      );

      success++;


    } catch (error) {

      failed++;


      console.log(
        "   ❌ UPLOAD GAGAL"
      );

      console.log(
        `   ${
          error instanceof Error
            ? error.message
            : String(error)
        }`
      );

    }


    console.log("");
  }


  console.log("");
  console.log(
    "===================================="
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
    `📦 Total    : ${images.length}`
  );

  console.log("");
}


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
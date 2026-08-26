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
   SETTING

   UBAH FOLDER INI SESUAI FOLDER HASIL PHOTOROOM
   ===================================================== */

const PHOTOROOM_FOLDER =
  "/Users/azrian/Downloads/photoroom-final";


const START_NUMBER = 33;
const END_NUMBER = 170;


/* =====================================================
   HELPERS
   ===================================================== */

function padNumber(number) {
  return String(number)
    .padStart(3, "0");
}


function getContentType(filename) {
  const ext =
    path.extname(filename)
      .toLowerCase();

  if (ext === ".png") {
    return "image/png";
  }

  if (ext === ".webp") {
    return "image/webp";
  }

  return "image/jpeg";
}


function getExtension(filename) {
  const ext =
    path.extname(filename)
      .toLowerCase();

  if (ext === ".png") {
    return "png";
  }

  if (ext === ".webp") {
    return "webp";
  }

  return "jpg";
}


function isImage(filename) {
  return /\.(jpe?g|png|webp)$/i.test(
    filename
  );
}


/* =====================================================
   GET READY CARS
   URUTAN SAMA DENGAN ADMIN
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
        created_at,
        cover_source_image_url
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
   FIND FILE BERDASARKAN NOMOR
   ===================================================== */

function findPhotoRoomFile(
  filenames,
  number
) {
  const prefix =
    padNumber(number);


  /*
    Contoh yang diterima:

    031__TOYOTA....jpg
    031_TOYOTA....png
    031 Toyota....jpg
    031.jpg
  */

  const match =
    filenames.find((filename) => {
      if (!isImage(filename)) {
        return false;
      }

      const base =
        path.basename(
          filename
        );

      return new RegExp(
        `^${prefix}(?:[^0-9]|$)`,
        "i"
      ).test(base);
    });


  return match ?? null;
}


/* =====================================================
   UPLOAD ONE CAR
   ===================================================== */

async function uploadPhotoRoom(
  car,
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
    `${car.id}/cover-source/photoroom.${ext}`;


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
        car.id
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
    "GARAGE88 BULK PHOTOROOM UPLOAD"
  );
  console.log(
    "==============================="
  );
  console.log("");

  console.log(
    `Folder: ${PHOTOROOM_FOLDER}`
  );

  console.log(
    `Range : ${START_NUMBER}-${END_NUMBER}`
  );

  console.log("");


  const filenames =
    await readdir(
      PHOTOROOM_FOLDER
    );


  const imageFiles =
    filenames.filter(
      isImage
    );


  console.log(
    `${imageFiles.length} file gambar ditemukan.`
  );


  const cars =
    await getReadyCars();


  console.log(
    `${cars.length} mobil READY ditemukan.`
  );

  console.log("");


  if (
    cars.length <
    END_NUMBER
  ) {
    console.log(
      `WARNING: mobil READY hanya ${cars.length}, sedangkan END_NUMBER ${END_NUMBER}.`
    );
  }


  let success = 0;
  let skipped = 0;
  let failed = 0;


  for (
    let number =
      START_NUMBER;

    number <=
      END_NUMBER;

    number++
  ) {

    /*
      Array dimulai index 0.

      Nomor 31
      berarti cars[30].
    */

    const car =
      cars[number - 1];


    if (!car) {
      console.log(
        `⚠️ ${padNumber(number)} — mobil tidak ditemukan`
      );

      skipped++;

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
        .join(" ");


    const filename =
      findPhotoRoomFile(
        imageFiles,
        number
      );


    if (!filename) {
      console.log(
        `⚠️ ${padNumber(number)} ${label}`
      );

      console.log(
        `   File PhotoRoom tidak ditemukan`
      );

      skipped++;

      continue;
    }


    const filePath =
      path.join(
        PHOTOROOM_FOLDER,
        filename
      );


    try {
      console.log(
        `⬆️ ${padNumber(number)} ${label}`
      );

      console.log(
        `   ${filename}`
      );


      await uploadPhotoRoom(
        car,
        filePath,
        filename
      );


      success++;


      console.log(
        `   ✅ Uploaded`
      );

    } catch (error) {

      failed++;


      const message =
        error instanceof Error
          ? error.message
          : String(error);


      console.log(
        `   ❌ ${message}`
      );
    }
  }


  console.log("");
  console.log(
    "==============================="
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
    `Range       : ${START_NUMBER}-${END_NUMBER}`
  );

  console.log("");
}


main()
  .catch(
    (error) => {
      console.error("");
      console.error(
        "UPLOAD GAGAL:"
      );

      console.error(
        error
      );

      process.exit(1);
    }
  );
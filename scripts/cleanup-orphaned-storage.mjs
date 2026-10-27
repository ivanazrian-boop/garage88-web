import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
  process.exit(1);
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

const BUCKET = "cars";

// ============================================================
// CONFIG
// ============================================================

// Default = DRY RUN.
// File tidak akan dihapus.
//
// Untuk benar-benar menghapus:
// DELETE_MODE=true node --env-file=.env scripts/cleanup-orphaned-storage.mjs

const DELETE_MODE =
  String(process.env.DELETE_MODE || "").toLowerCase() === "true";

const LIST_LIMIT = 1000;
const DELETE_BATCH_SIZE = 100;


// ============================================================
// HELPERS
// ============================================================

function clean(value) {
  return String(value ?? "").trim();
}


function normalizePath(value) {
  let text = clean(value);

  if (!text) {
    return "";
  }

  // Kalau URL penuh
  try {
    const url = new URL(text);

    // Public storage URL:
    // /storage/v1/object/public/cars/xxxxx
    const marker = `/storage/v1/object/public/${BUCKET}/`;

    const markerIndex = url.pathname.indexOf(marker);

    if (markerIndex !== -1) {
      const path = url.pathname.slice(
        markerIndex + marker.length
      );

      return decodeURIComponent(path);
    }

    // Fallback untuk URL storage lainnya
    const objectMarker = `/storage/v1/object/`;

    const objectIndex = url.pathname.indexOf(objectMarker);

    if (objectIndex !== -1) {
      const after = url.pathname.slice(
        objectIndex + objectMarker.length
      );

      const parts = after.split("/");

      const bucketIndex = parts.indexOf(BUCKET);

      if (bucketIndex !== -1) {
        return decodeURIComponent(
          parts
            .slice(bucketIndex + 1)
            .join("/")
        );
      }
    }
  } catch {
    // Bukan URL, lanjut sebagai path biasa
  }

  // Kalau sudah berupa path
  return text
    .replace(/^\/+/, "")
    .replace(/^cars\//, "");
}


function addReferencedUrl(set, value) {
  const path = normalizePath(value);

  if (path) {
    set.add(path);
  }
}


// ============================================================
// GET DATABASE REFERENCES
// ============================================================

async function getReferencedFiles() {
  console.log("📚 Membaca referensi file dari database...");

  const referenced = new Set();

  // ----------------------------------------------------------
  // CARS
  // ----------------------------------------------------------

  const {
    data: cars,
    error: carsError,
  } = await supabase
    .from("cars")
    .select(`
      id,
      cover_source_image_url,
      ig_image_url,
      meta_image_url
    `);

  if (carsError) {
    throw new Error(
      `cars query failed: ${carsError.message}`
    );
  }

  for (const car of cars ?? []) {
    addReferencedUrl(
      referenced,
      car.cover_source_image_url
    );

    addReferencedUrl(
      referenced,
      car.ig_image_url
    );

    addReferencedUrl(
      referenced,
      car.meta_image_url
    );
  }

  console.log(
    `   cars: ${cars?.length ?? 0} rows`
  );


  // ----------------------------------------------------------
  // CAR IMAGES
  // ----------------------------------------------------------

  const {
    data: carImages,
    error: imagesError,
  } = await supabase
    .from("car_images")
    .select(`
      id,
      image_url
    `);

  if (imagesError) {
    throw new Error(
      `car_images query failed: ${imagesError.message}`
    );
  }

  for (const image of carImages ?? []) {
    addReferencedUrl(
      referenced,
      image.image_url
    );
  }

  console.log(
    `   car_images: ${carImages?.length ?? 0} rows`
  );

  console.log(
    `   referenced files: ${referenced.size}`
  );

  return referenced;
}


// ============================================================
// LIST ALL STORAGE OBJECTS
// ============================================================

async function listFolder(
  folder = ""
) {
  const objects = [];

  let offset = 0;

  while (true) {
    const {
      data,
      error,
    } = await supabase
      .storage
      .from(BUCKET)
      .list(folder, {
        limit: LIST_LIMIT,
        offset,
        sortBy: {
          column: "name",
          order: "asc",
        },
      });

    if (error) {
      throw new Error(
        `Storage list failed at "${folder}": ${error.message}`
      );
    }

    if (!data || data.length === 0) {
      break;
    }

    for (const item of data) {
      const itemName = clean(item.name);

      if (!itemName) {
        continue;
      }

      const fullPath = folder
        ? `${folder}/${itemName}`
        : itemName;

      // Folder
      //
      // Supabase storage list returns folders
      // without a real object id.
      if (!item.id) {
        const children = await listFolder(
          fullPath
        );

        objects.push(...children);
      } else {
        objects.push({
          path: fullPath,
          id: item.id,
          name: itemName,
          metadata: item.metadata ?? null,
          created_at: item.created_at ?? null,
          updated_at: item.updated_at ?? null,
        });
      }
    }

    if (data.length < LIST_LIMIT) {
      break;
    }

    offset += LIST_LIMIT;
  }

  return objects;
}


async function getAllStorageObjects() {
  console.log(
    `\n📦 Membaca semua file Storage bucket "${BUCKET}"...`
  );

  const objects = await listFolder("");

  console.log(
    `   storage objects: ${objects.length}`
  );

  return objects;
}


// ============================================================
// SIZE
// ============================================================

function getObjectSize(object) {
  const size =
    Number(
      object?.metadata?.size ??
      object?.metadata?.contentLength ??
      0
    );

  return Number.isFinite(size)
    ? size
    : 0;
}


function formatBytes(bytes) {
  if (!bytes) {
    return "0 B";
  }

  const units = [
    "B",
    "KB",
    "MB",
    "GB",
  ];

  let value = bytes;
  let index = 0;

  while (
    value >= 1024 &&
    index < units.length - 1
  ) {
    value /= 1024;
    index++;
  }

  return `${value.toFixed(2)} ${units[index]}`;
}


// ============================================================
// FIND ORPHANS
// ============================================================

function findOrphans(
  objects,
  referenced
) {
  return objects.filter(
    (object) =>
      !referenced.has(object.path)
  );
}


// ============================================================
// DELETE
// ============================================================

async function deleteObjects(
  orphaned
) {
  if (!orphaned.length) {
    console.log(
      "\n✅ Tidak ada orphaned file."
    );

    return;
  }

  const paths = orphaned.map(
    (object) => object.path
  );

  console.log(
    `\n🗑️ Menghapus ${paths.length} file...`
  );

  let deleted = 0;

  for (
    let i = 0;
    i < paths.length;
    i += DELETE_BATCH_SIZE
  ) {
    const batch = paths.slice(
      i,
      i + DELETE_BATCH_SIZE
    );

    console.log(
      `   batch ${Math.floor(i / DELETE_BATCH_SIZE) + 1}: ${batch.length} files`
    );

    const {
      data,
      error,
    } = await supabase
      .storage
      .from(BUCKET)
      .remove(batch);

    if (error) {
      throw new Error(
        `Storage delete failed: ${error.message}`
      );
    }

    deleted += data?.length ?? batch.length;
  }

  console.log(
    `\n✅ Selesai. Deleted: ${deleted} files`
  );
}


// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log("");
  console.log(
    "============================================================"
  );
  console.log(
    " GARAGE88 - ORPHANED STORAGE CLEANUP"
  );
  console.log(
    "============================================================"
  );

  console.log(
    `Mode: ${DELETE_MODE ? "DELETE" : "DRY RUN"}`
  );

  const referenced =
    await getReferencedFiles();

  const objects =
    await getAllStorageObjects();

  const orphaned =
    findOrphans(
      objects,
      referenced
    );

  const totalBytes =
    orphaned.reduce(
      (sum, object) =>
        sum + getObjectSize(object),
      0
    );

  console.log("");
  console.log(
    "============================================================"
  );

  console.log(
    `Total Storage Objects : ${objects.length}`
  );

  console.log(
    `Referenced Objects    : ${referenced.size}`
  );

  console.log(
    `Orphaned Objects      : ${orphaned.length}`
  );

  console.log(
    `Potentially Freed     : ${formatBytes(totalBytes)}`
  );

  console.log(
    "============================================================"
  );


  if (!orphaned.length) {
    console.log(
      "\n🎉 Storage sudah bersih. Tidak ada orphaned file."
    );

    return;
  }


  // ----------------------------------------------------------
  // PRINT ORPHANS
  // ----------------------------------------------------------

  console.log(
    "\n📋 ORPHANED FILES:\n"
  );

  for (const object of orphaned) {
    console.log(
      `${formatBytes(getObjectSize(object)).padStart(12)}  ${object.path}`
    );
  }


  // ----------------------------------------------------------
  // DRY RUN
  // ----------------------------------------------------------

  if (!DELETE_MODE) {
    console.log("");
    console.log(
      "============================================================"
    );

    console.log(
      "⚠️ DRY RUN — TIDAK ADA FILE YANG DIHAPUS"
    );

    console.log(
      "============================================================"
    );

    console.log("");
    console.log(
      "Kalau daftar di atas sudah benar, jalankan:"
    );

    console.log("");

    console.log(
      "DELETE_MODE=true node --env-file=.env scripts/cleanup-orphaned-storage.mjs"
    );

    console.log("");

    return;
  }


  // ----------------------------------------------------------
  // DELETE
  // ----------------------------------------------------------

  await deleteObjects(
    orphaned
  );
}


main().catch(
  (error) => {
    console.error("");
    console.error(
      "❌ ERROR:"
    );
    console.error(
      error.message || error
    );

    process.exit(1);
  }
);

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import {
  S3Client,
  ListObjectsV2Command,
  HeadObjectCommand,
  CopyObjectCommand,
} from "@aws-sdk/client-s3";

const APPLY = process.argv.includes("--apply");
const PAGE_SIZE = 1000;

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  R2_PUBLIC_URL,
} = process.env;

for (const [name, value] of Object.entries({
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  R2_PUBLIC_URL,
})) {
  if (!value) throw new Error(`Environment variable belum tersedia: ${name}`);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const bucket = R2_BUCKET_NAME;
const publicBase = R2_PUBLIC_URL.replace(/\/+$/, "");

function decodeKeyFromUrl(url) {
  if (!url || typeof url !== "string") return null;

  try {
    const parsed = new URL(url);
    const base = new URL(publicBase);

    if (parsed.origin !== base.origin) return null;
    if (!parsed.pathname.startsWith(base.pathname.replace(/\/+$/, "") + "/")) {
      return null;
    }

    return decodeURIComponent(
      parsed.pathname.slice(base.pathname.replace(/\/+$/, "").length + 1)
    );
  } catch {
    return null;
  }
}

function publicUrl(key) {
  return `${publicBase}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

async function exists(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (error) {
    if (error?.$metadata?.httpStatusCode === 404 ||
        error?.name === "NotFound" ||
        error?.name === "NoSuchKey") {
      return false;
    }
    throw error;
  }
}

async function listAllObjects() {
  const keys = new Set();
  let token;

  do {
    const result = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: token,
        MaxKeys: PAGE_SIZE,
      })
    );

    for (const object of result.Contents ?? []) {
      if (object.Key) keys.add(object.Key);
    }

    token = result.IsTruncated ? result.NextContinuationToken : undefined;
  } while (token);

  return keys;
}

async function getAllCars() {
  const rows = [];
  const pageSize = 500;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("cars")
      .select("id,cover_source_image_url,ig_image_url,meta_image_url")
      .range(from, from + pageSize - 1);

    if (error) throw error;

    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

async function getAllImages() {
  const rows = [];
  const pageSize = 500;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("car_images")
      .select("id,car_id,image_url")
      .range(from, from + pageSize - 1);

    if (error) throw error;

    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

async function ensureTarget(oldKey, newKey, objectKeys) {
  if (objectKeys.has(newKey) || await exists(newKey)) {
    return { ok: true, action: "target-exists" };
  }

  if (!objectKeys.has(oldKey) && !(await exists(oldKey))) {
    return { ok: false, action: "source-missing" };
  }

  if (!APPLY) {
    return { ok: true, action: "would-copy" };
  }

  await s3.send(
    new CopyObjectCommand({
      Bucket: bucket,
      Key: newKey,
      CopySource: `${bucket}/${oldKey
        .split("/")
        .map(encodeURIComponent)
        .join("/")}`,
      MetadataDirective: "COPY",
    })
  );

  if (!(await exists(newKey))) {
    throw new Error(`Verifikasi gagal setelah copy: ${newKey}`);
  }

  objectKeys.add(newKey);
  return { ok: true, action: "copied" };
}

async function main() {
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}`);
  console.log(`Bucket: ${bucket}`);
  console.log(`Public URL: ${publicBase}`);

  const [objectKeys, cars, images] = await Promise.all([
    listAllObjects(),
    getAllCars(),
    getAllImages(),
  ]);

  const carIds = new Set(cars.map((car) => String(car.id)));
  let checked = 0;
  let ready = 0;
  let missing = 0;
  let updated = 0;

  async function normalizeUrl(row, column, url, carId) {
    if (!url) return;

    const key = decodeKeyFromUrl(url);
    if (!key) {
      console.log(`[SKIP URL EXTERNAL/INVALID] ${column}: ${url}`);
      return;
    }

    const legacyPrefix = `${carId}/`;
    const newPrefix = `cars/${carId}/`;

    if (key.startsWith(newPrefix)) {
      checked++;
      if (objectKeys.has(key) || await exists(key)) {
        ready++;
      } else {
        missing++;
        console.log(`[MISSING TARGET] ${key}`);
      }
      return;
    }

    if (!key.startsWith(legacyPrefix)) {
      console.log(`[SKIP PATH TIDAK DIKENALI] ${key}`);
      return;
    }

    const newKey = `cars/${key}`;
    const result = await ensureTarget(key, newKey, objectKeys);
    checked++;

    if (!result.ok) {
      missing++;
      console.log(`[SOURCE MISSING] ${key} -> ${newKey}`);
      return;
    }

    ready++;
    console.log(`[${result.action}] ${key} -> ${newKey}`);

    if (APPLY) {
      const patch = { [column]: publicUrl(newKey) };
      let query;

      if (row.table === "car_images") {
        query = supabase.from("car_images").update(patch).eq("id", row.id);
      } else {
        query = supabase.from("cars").update(patch).eq("id", row.id);
      }

      const { error } = await query;
      if (error) throw error;
      updated++;
    } else {
      updated++;
    }
  }

  for (const image of images) {
    if (!carIds.has(String(image.car_id))) continue;
    await normalizeUrl(
      { ...image, table: "car_images" },
      "image_url",
      image.image_url,
      String(image.car_id)
    );
  }

  for (const car of cars) {
    for (const column of [
      "cover_source_image_url",
      "ig_image_url",
      "meta_image_url",
    ]) {
      await normalizeUrl(
        { ...car, table: "cars" },
        column,
        car[column],
        String(car.id)
      );
    }
  }

  console.log("\n=== SUMMARY ===");
  console.log(`R2 objects found: ${objectKeys.size}`);
  console.log(`URLs checked: ${checked}`);
  console.log(`URLs ready / candidates: ${ready}`);
  console.log(`Missing source or target: ${missing}`);
  console.log(`Database updates ${APPLY ? "performed" : "planned"}: ${updated}`);

  if (!APPLY) {
    console.log("\nDRY-RUN: belum ada file atau database yang diubah.");
    console.log("Periksa output terlebih dahulu sebelum menjalankan --apply.");
  } else {
    console.log("\nSelesai. File lama sengaja tidak dihapus.");
  }
}

main().catch((error) => {
  console.error("NORMALIZATION FAILED:", error);
  process.exitCode = 1;
});

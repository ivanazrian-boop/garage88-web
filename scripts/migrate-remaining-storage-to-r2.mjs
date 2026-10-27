import 'dotenv/config';
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import {
  S3Client,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME = 'garage88-cars',
  R2_PUBLIC_URL = 'https://img.garage88.site',
} = process.env;

for (const [name, value] of Object.entries({
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_PUBLIC_URL,
})) {
  if (!value) throw new Error(`Missing environment variable: ${name}`);
}

const inventoryFile = 'storage-assets-inventory.json';
if (!fs.existsSync(inventoryFile)) {
  throw new Error(`Inventory not found: ${inventoryFile}`);
}

const inventory = JSON.parse(fs.readFileSync(inventoryFile, 'utf8'));
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const stats = { scanned: 0, copied: 0, skipped: 0, failed: 0 };
const failures = [];
const publicBase = R2_PUBLIC_URL.replace(/\/+$/, '');

function targetKey(item) {
  // Keep the existing cars key layout and separate other buckets.
  return `${item.bucket}/${item.path}`;
}

async function main() {
  console.log(`Copy-only migration: ${inventory.length} objects`);
  console.log('No database updates and no source deletions.');

  for (const item of inventory) {
    stats.scanned++;
    const key = targetKey(item);

    try {
      try {
        await s3.send(new HeadObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: key,
        }));
        stats.skipped++;
        continue;
      } catch (error) {
        const status = error?.$metadata?.httpStatusCode;
        const code = error?.name;
        if (status !== 404 && code !== 'NotFound' && code !== 'NoSuchKey') {
          throw error;
        }
      }

      const { data: blob, error } = await supabase.storage
        .from(item.bucket)
        .download(item.path);

      if (error) throw error;
      if (!blob) throw new Error('Supabase returned no file');

      const bytes = Buffer.from(await blob.arrayBuffer());
      if (!bytes.length) throw new Error('Empty file');

      const contentType =
        item.contentType ||
        blob.type ||
        'application/octet-stream';

      await s3.send(new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: bytes,
        ContentType: contentType,
      }));

      await s3.send(new HeadObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      }));

      stats.copied++;
      console.log(`[COPIED] ${item.bucket}/${item.path} (${bytes.length} bytes)`);
    } catch (error) {
      stats.failed++;
      failures.push({
        bucket: item.bucket,
        path: item.path,
        error: error.message,
      });
      console.error(`[FAILED] ${item.bucket}/${item.path}: ${error.message}`);
    }
  }

  fs.writeFileSync(
    'r2-migration-failures.json',
    JSON.stringify(failures, null, 2)
  );

  console.log('\nSummary:', stats);
  console.log(`Public base URL: ${publicBase}`);
  console.log('Failure details: r2-migration-failures.json');
  console.log('Source files and database URLs were not changed.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

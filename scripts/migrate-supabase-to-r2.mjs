
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import path from 'node:path';

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME = 'garage88-cars',
  R2_PUBLIC_URL = 'https://img.garage88.site',
} = process.env;

const APPLY = process.env.APPLY === 'true';
const BATCH_SIZE = 50;

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

const publicBase = R2_PUBLIC_URL.replace(/\/+$/, '');
const stats = { scanned: 0, copied: 0, skipped: 0, failed: 0 };

function getExtension(url) {
  try {
    const ext = path.extname(new URL(url).pathname).toLowerCase();
    return /^\.(jpg|jpeg|png|webp|gif|avif)$/i.test(ext)
      ? ext
      : '.jpg';
  } catch {
    return '.jpg';
  }
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY — upload and update DB' : 'DRY RUN — no changes'}`);

  let offset = 0;

  while (true) {
    const { data: rows, error } = await supabase
      .from('car_images')
      .select('id, car_id, image_url, sort_order')
      .order('id')
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) throw error;
    if (!rows?.length) break;

    for (const row of rows) {
      stats.scanned++;

      if (row.image_url.startsWith(`${publicBase}/`)) {
        stats.skipped++;
        continue;
      }

      let source;

      try {
        source = await fetch(row.image_url);
        if (!source.ok) {
          throw new Error(`Source HTTP ${source.status}`);
        }

        const contentType =
          source.headers.get('content-type') || 'image/jpeg';

        if (!contentType.startsWith('image/')) {
          throw new Error(`Not an image: ${contentType}`);
        }

        const bytes = Buffer.from(await source.arrayBuffer());
        if (!bytes.length) throw new Error('Empty image');

        const key = `cars/${row.car_id}/${row.id}${getExtension(row.image_url)}`;
        const targetUrl = `${publicBase}/${key}`;

        if (!APPLY) {
          console.log(`[DRY RUN] ${row.id} (${bytes.length} bytes)`);
          continue;
        }

        await s3.send(new PutObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: key,
          Body: bytes,
          ContentType: contentType,
        }));

        // Verify object exists in R2 before changing the database.
        await s3.send(new HeadObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: key,
        }));

        const { error: updateError } = await supabase
          .from('car_images')
          .update({ image_url: targetUrl })
          .eq('id', row.id)
          .eq('image_url', row.image_url);

        if (updateError) throw updateError;

        stats.copied++;
        console.log(`[COPIED] ${row.id} -> ${targetUrl}`);
      } catch (error) {
        stats.failed++;
        console.error(`[FAILED] ${row.id}: ${error.message}`);
      }
    }

    offset += rows.length;
    if (rows.length < BATCH_SIZE) break;
  }

  console.log('\nSummary:', stats);
  if (!APPLY) {
    console.log('No uploads or database updates were performed.');
    console.log('Review the results before running with APPLY=true.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

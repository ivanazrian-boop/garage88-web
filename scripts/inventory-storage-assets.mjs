import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
);

const buckets = ['cars', 'ig_covers', 'meta_covers'];
const results = [];

async function scan(bucket, folder = '') {
  let offset = 0;
  const limit = 100;

  while (true) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(folder, { limit, offset });

    if (error) {
      console.error(`ERROR ${bucket}/${folder}: ${error.message}`);
      return;
    }

    if (!data?.length) break;

    for (const item of data) {
      if (item.name === '.emptyFolderPlaceholder') continue;

      const path = folder ? `${folder}/${item.name}` : item.name;

      if (item.id == null) {
        await scan(bucket, path);
      } else {
        results.push({
          bucket,
          path,
          size: item.metadata?.size ?? null,
          contentType: item.metadata?.mimetype ?? null,
          updatedAt: item.updated_at ?? null,
        });
      }
    }

    if (data.length < limit) break;
    offset += limit;
  }
}

for (const bucket of buckets) {
  console.log(`Scanning bucket: ${bucket}`);
  await scan(bucket);
}

fs.writeFileSync(
  'storage-assets-inventory.json',
  JSON.stringify(results, null, 2)
);

for (const bucket of buckets) {
  const files = results.filter(x => x.bucket === bucket);
  const bytes = files.reduce((sum, x) => sum + (Number(x.size) || 0), 0);
  console.log(`${bucket}: ${files.length} files, ${(bytes / 1024 / 1024).toFixed(2)} MB`);
}

console.log(`Total: ${results.length} files`);
console.log('Saved: storage-assets-inventory.json');

#!/usr/bin/env node
/**
 * Bulk-generate Premium Cover for READY cars only by calling the deployed
 * Astro API route. The API route replaces cars/{id}/generated/ig-cover.jpg and
 * updates cars.ig_image_url; it does not modify Meta Cover.
 *
 * Dry run (default): node scripts/bulk-premium-cover.mjs
 * Execute:          PREMIUM_COVER_ADMIN_KEY=garage88 node scripts/bulk-premium-cover.mjs --run
 * Test a few:       PREMIUM_COVER_ADMIN_KEY=garage88 node scripts/bulk-premium-cover.mjs --run --limit=3
 * Resume from 16:    PREMIUM_COVER_ADMIN_KEY=garage88 node scripts/bulk-premium-cover.mjs --run --start=16
 * Start 16, 10 cars: PREMIUM_COVER_ADMIN_KEY=garage88 node scripts/bulk-premium-cover.mjs --run --start=16 --limit=10
 */

import { loadEnvFile } from 'node:process';
import { createClient } from '@supabase/supabase-js';

function tryLoadEnv(file) {
  try { loadEnvFile(file); } catch { /* optional env file */ }
}
tryLoadEnv('.env');
tryLoadEnv('.dev.vars');

const cliArgs = process.argv.slice(2);
const args = new Set(cliArgs.filter((arg) => !arg.startsWith('--limit=') && !arg.startsWith('--start=')));
const runMode = args.has('--run');
const limitArg = cliArgs.find((arg) => arg.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.split('=')[1]) : Infinity;
const startArg = cliArgs.find((arg) => arg.startsWith('--start='));
const startNumber = startArg ? Number(startArg.split('=')[1]) : 1;
const pageSize = 500;
const delayMs = Math.max(0, Number(process.env.PREMIUM_COVER_DELAY_MS || 3_000));
const baseUrl = (process.env.PREMIUM_COVER_BASE_URL || 'https://garage88.site').replace(/\/+$/, '');
const adminKey = process.env.PREMIUM_COVER_ADMIN_KEY;
const supabaseUrl = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl) throw new Error('SUPABASE_URL atau PUBLIC_SUPABASE_URL tidak ditemukan di .env/.dev.vars.');
if (!serviceKey) throw new Error('SUPABASE_SERVICE_KEY tidak ditemukan di .env/.dev.vars.');
if (runMode && !adminKey) {
  throw new Error('Set PREMIUM_COVER_ADMIN_KEY saat --run. Nilainya harus sama dengan key yang diterima API production.');
}
if (limitArg && (!Number.isInteger(limit) || limit < 1)) {
  throw new Error('--limit harus berupa bilangan bulat lebih besar dari 0.');
}
if (startArg && (!Number.isInteger(startNumber) || startNumber < 1)) {
  throw new Error('--start harus berupa bilangan bulat minimal 1.');
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getTargetCars() {
  const all = [];
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from('cars')
      .select('id,status,brand,model,variant,year,cover_source_image_url,ig_image_url,created_at')
      .eq('status', 'READY')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw new Error(`Gagal membaca cars dari Supabase: ${error.message}`);
    all.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return all;
}

function carLabel(car) {
  return [car.brand, car.model, car.variant, car.year]
    .filter((part) => part !== null && part !== undefined && String(part).trim())
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim() || String(car.id);
}

async function callPremiumApi(car) {
  const url = `${baseUrl}/api/generate-premium-cover/${encodeURIComponent(car.id)}?key=${encodeURIComponent(adminKey)}`;
  let lastError;

  // Retry transient network/server/rate-limit failures twice.
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // Empty body lets the API preserve an existing hero title or derive its fallback.
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(180_000),
      });
      const raw = await response.text();
      let result;
      try { result = raw ? JSON.parse(raw) : {}; } catch { result = { error: raw.slice(0, 800) }; }

      if (response.ok && result?.ok && result?.ig_image_url) {
        return { ok: true, ig_image_url: result.ig_image_url, meta_unchanged: result.meta_unchanged };
      }

      const message = result?.error || `HTTP ${response.status}: ${raw.slice(0, 500)}`;
      lastError = new Error(message);
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === 3) break;

      const retryAfter = Number(response.headers.get('retry-after') || 0) * 1000;
      await sleep(Math.max(delayMs, retryAfter));
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === 3) break;
      await sleep(delayMs);
    }
  }

  return { ok: false, error: lastError?.message || 'Unknown error' };
}

const cars = await getTargetCars();
const eligible = cars.filter((car) => String(car.cover_source_image_url || '').trim());
const skippedNoSource = cars.filter((car) => !String(car.cover_source_image_url || '').trim());
// --start is 1-based and applies to eligible READY cars with PhotoRoom,
// in the current Supabase order. --limit controls how many are processed after that.
const startIndex = startNumber - 1;
const selected = eligible.slice(startIndex, startIndex + limit);


console.log('\n=== GARAGE88 BULK PREMIUM COVER ===');
console.log(`Website              : ${baseUrl}`);
console.log(`READY cars found     : ${cars.length}`);
console.log(`Eligible w/ PhotoRoom: ${eligible.length}`);
console.log(`No PhotoRoom source  : ${skippedNoSource.length} (akan dilewati)`);
console.log(`Start position       : ${startNumber}`);
console.log(`Target this run      : ${selected.length} READY cars`);
console.log(`Mode                 : ${runMode ? 'LIVE — akan mengganti IG Cover' : 'DRY RUN — belum mengubah apa pun'}`);
console.log(`Delay                 : ${Math.round(delayMs / 1000)} detik`);
console.log('Meta Cover           : tidak disentuh oleh endpoint ini');

if (!runMode) {
  console.log('\nDry run selesai. Untuk mengeksekusi, jalankan:');
  console.log('PREMIUM_COVER_ADMIN_KEY=garage88 node scripts/bulk-premium-cover.mjs --run');
  console.log('\nUntuk uji coba 3 mobil terlebih dahulu:');
  console.log('PREMIUM_COVER_ADMIN_KEY=garage88 node scripts/bulk-premium-cover.mjs --run --limit=3');
  console.log('Untuk lanjut dari nomor 16:');
  console.log('PREMIUM_COVER_ADMIN_KEY=garage88 node scripts/bulk-premium-cover.mjs --run --start=16');
  console.log('Untuk lanjut dari nomor 16 dan proses 10 mobil:');
  console.log('PREMIUM_COVER_ADMIN_KEY=garage88 node scripts/bulk-premium-cover.mjs --run --start=16 --limit=10');
  process.exit(0);
}

if (selected.length === 0) {
  console.log('\nTidak ada mobil READY dengan cover_source_image_url untuk diproses.');
  process.exit(0);
}

let success = 0;
let failed = 0;
const failures = [];

for (let index = 0; index < selected.length; index++) {
  const car = selected[index];
  const absoluteNumber = startNumber + index;
  const number = `${absoluteNumber}/${eligible.length}`;
  console.log(`\n[${number}] ${carLabel(car)} | ${car.status} | ${car.id}`);

  const result = await callPremiumApi(car);
  if (result.ok) {
    success++;
    console.log(`  OK — ig_image_url updated; Meta Cover unchanged.`);
  } else {
    failed++;
    failures.push({ id: car.id, status: car.status, label: carLabel(car), error: result.error });
    console.error(`  FAILED — ${result.error}`);
  }

  if (index < selected.length - 1 && delayMs > 0) {
    console.log(`  Menunggu ${Math.round(delayMs / 1000)} detik sebelum mobil berikutnya...`);
    await sleep(delayMs);
  }
}

console.log('\n=== RINGKASAN ===');
console.log(`Berhasil : ${success}`);
console.log(`Gagal    : ${failed}`);
console.log(`Dilewati tanpa PhotoRoom: ${skippedNoSource.length}`);

if (failures.length) {
  console.log('\nDaftar gagal (bisa diperiksa dan dicoba ulang):');
  for (const item of failures) {
    console.log(`- ${item.label} | ${item.status} | ${item.id} | ${item.error}`);
  }
  process.exitCode = 1;
}

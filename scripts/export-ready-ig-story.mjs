import { createClient } from "@supabase/supabase-js";
import { loadEnvFile } from "node:process";
import { mkdir, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import sharp from "sharp";

// =====================================================
// CONFIG
// =====================================================

const BOOKED_LIMIT = 10;
const READY_LIMIT = 100;
const DOWNLOAD_CONCURRENCY = 6;

const STORY_WIDTH = 1080;
const STORY_HEIGHT = 1920;
const POST_HEIGHT = 1350;

const PAD_TOP = 285;
const PAD_BOTTOM = 285;

const VIGNETTE_BOTTOM_OPACITY = 0.22;
const VIGNETTE_FADE = 420;

// =====================================================
// ENV
// =====================================================

function tryLoadEnv(file) {
  try {
    loadEnvFile(file);
  } catch {}
}

tryLoadEnv(".env");
tryLoadEnv(".dev.vars");

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.PUBLIC_SUPABASE_URL;

const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL) {
  throw new Error("SUPABASE_URL tidak ditemukan");
}

if (!SUPABASE_SERVICE_KEY) {
  throw new Error("SUPABASE_SERVICE_KEY tidak ditemukan");
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

// =====================================================
// TEXT
// =====================================================

function cleanText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function carName(car) {
  return cleanText(
    [
      car.brand,
      car.model,
      car.variant,
      car.year,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

// =====================================================
// SORT
// =====================================================

function compareLatest(a, b) {
  const createdA = new Date(a.created_at ?? 0).getTime();
  const createdB = new Date(b.created_at ?? 0).getTime();

  if (createdA !== createdB) {
    return createdB - createdA;
  }

  const yearA = Number(a.year ?? 0);
  const yearB = Number(b.year ?? 0);

  if (yearA !== yearB) {
    return yearB - yearA;
  }

  const kmA = Number(
    a.odometer ?? Number.MAX_SAFE_INTEGER
  );

  const kmB = Number(
    b.odometer ?? Number.MAX_SAFE_INTEGER
  );

  if (kmA !== kmB) {
    return kmA - kmB;
  }

  return carName(a).localeCompare(carName(b), "id");
}

// =====================================================
// FILE HELPERS
// =====================================================

function pad(value, length = 3) {
  return String(value).padStart(length, "0");
}

function timestamp() {
  return new Date()
    .toISOString()
    .replaceAll(":", "-")
    .replace("T", "_")
    .replace(/\.\d{3}Z$/, "");
}

function safeFilename(value) {
  return cleanText(value)
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

function csvValue(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function openFolder(folder) {
  if (process.platform === "darwin") {
    execFile("open", [folder], () => {});
    return;
  }

  if (process.platform === "win32") {
    execFile("explorer", [folder], () => {});
    return;
  }

  execFile("xdg-open", [folder], () => {});
}

// =====================================================
// IMAGE DOWNLOAD
// =====================================================

async function downloadImage(url) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "user-agent": "Garage88-IG-Story-Downloader/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

// =====================================================
// BOTTOM VIGNETTE
// =====================================================

async function createBottomVignette() {
  const svg = `
    <svg
      width="${STORY_WIDTH}"
      height="${VIGNETTE_FADE}"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient
          id="gradient"
          x1="0"
          y1="1"
          x2="0"
          y2="0"
        >
          <stop
            offset="0%"
            stop-color="black"
            stop-opacity="${VIGNETTE_BOTTOM_OPACITY}"
          />
          <stop
            offset="45%"
            stop-color="black"
            stop-opacity="${VIGNETTE_BOTTOM_OPACITY * 0.45}"
          />
          <stop
            offset="100%"
            stop-color="black"
            stop-opacity="0"
          />
        </linearGradient>
      </defs>

      <rect
        width="${STORY_WIDTH}"
        height="${VIGNETTE_FADE}"
        fill="url(#gradient)"
      />
    </svg>
  `;

  return sharp(Buffer.from(svg))
    .png()
    .toBuffer();
}

// =====================================================
// BOOKED STAMP
// =====================================================

async function createBookedStamp() {
  const svg = `
    <svg
      width="1000"
      height="300"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g
        transform="rotate(-12 500 150)"
        fill="none"
        stroke="#D71920"
        stroke-width="16"
      >
        <rect
          x="65"
          y="55"
          width="870"
          height="190"
          rx="12"
          fill="#FFFFFF"
          fill-opacity="0.72"
        />

        <rect
          x="85"
          y="75"
          width="830"
          height="150"
          rx="5"
          stroke-width="5"
        />

        <text
          x="500"
          y="190"
          text-anchor="middle"
          font-family="Arial, Helvetica, sans-serif"
          font-size="116"
          font-weight="900"
          letter-spacing="8"
          fill="#D71920"
          stroke="none"
        >BOOKED</text>
      </g>
    </svg>
  `;

  return sharp(Buffer.from(svg))
    .png()
    .toBuffer();
}

// =====================================================
// CREATE STORY
// =====================================================

async function createStory(sourceBuffer, isBooked = false) {

  // NORMALISASI FOTO 1080 x 1350

  const normalizedPost = await sharp(sourceBuffer)
    .rotate()
    .resize(
      STORY_WIDTH,
      POST_HEIGHT,
      {
        fit: "contain",
        position: "centre",
        background: {
          r: 255,
          g: 255,
          b: 255,
          alpha: 1,
        },
      }
    )
    .flatten({
      background: "#ffffff",
    })
    .removeAlpha()
    .toColorspace("srgb")
    .jpeg({
      quality: 97,
      chromaSubsampling: "4:4:4",
    })
    .toBuffer();

  // AMBIL PIXEL PALING BAWAH FOTO

  const bottomEdge = await sharp(normalizedPost)
    .extract({
      left: 0,
      top: POST_HEIGHT - 1,
      width: STORY_WIDTH,
      height: 1,
    })
    .png()
    .toBuffer();

  // EXTEND BAGIAN BAWAH

  const bottomPad = await sharp(bottomEdge)
    .resize(
      STORY_WIDTH,
      PAD_BOTTOM,
      {
        fit: "fill",
      }
    )
    .png()
    .toBuffer();

  // BACKGROUND ATAS PUTIH SOLID

  const topPad = await sharp({
    create: {
      width: STORY_WIDTH,
      height: PAD_TOP,
      channels: 3,
      background: "#ffffff",
    },
  })
    .png()
    .toBuffer();

  // VIGNETTE BAWAH

  const bottomVignette = await createBottomVignette();

  // BOOKED STAMP

  const overlays = [];

  if (isBooked) {
    const bookedStamp = await createBookedStamp();

    overlays.push({
      input: bookedStamp,
      left: 40,
      top: PAD_TOP + Math.round(
        (POST_HEIGHT - 300) / 2
      ),
    });
  }

  // CANVAS STORY

  const composite = [
    {
      input: topPad,
      left: 0,
      top: 0,
    },
    {
      input: normalizedPost,
      left: 0,
      top: PAD_TOP,
    },
    {
      input: bottomPad,
      left: 0,
      top: PAD_TOP + POST_HEIGHT,
    },
    ...overlays,
    {
      input: bottomVignette,
      left: 0,
      top: STORY_HEIGHT - VIGNETTE_FADE,
    },
  ];

  return sharp({
    create: {
      width: STORY_WIDTH,
      height: STORY_HEIGHT,
      channels: 3,
      background: {
        r: 255,
        g: 255,
        b: 255,
      },
    },
  })
    .composite(composite)
    .jpeg({
      quality: 97,
      chromaSubsampling: "4:4:4",
    })
    .toBuffer();
}

// =====================================================
// SUPABASE QUERY
// =====================================================

async function getCarsByStatus(status, limit) {

  const {
    data,
    error,
  } = await supabase
    .from("cars")
    .select(`
      id,
      branch,
      brand,
      model,
      variant,
      year,
      transmission,
      odometer,
      credit_price,
      status,
      ig_image_url,
      created_at
    `)
    .eq("status", status)
    .not("ig_image_url", "is", null)
    .neq("ig_image_url", "")
    .limit(1000);

  if (error) {
    throw new Error(
      `Supabase ${status} error: ${error.message}`
    );
  }

  const cars = (data ?? [])
    .filter((car) => cleanText(car.ig_image_url));

  cars.sort(compareLatest);

  return cars.slice(0, limit);
}

// =====================================================
// GET BOOKED + READY
// =====================================================

async function getLatestCars() {

  console.log("Mengambil data BOOKED dan READY...");

  const [bookedCars, readyCars] = await Promise.all([
    getCarsByStatus("BOOKED", BOOKED_LIMIT),
    getCarsByStatus("READY", READY_LIMIT),
  ]);

  const booked = bookedCars.map((car) => ({
    ...car,
    export_category: "BOOKED",
  }));

  const ready = readyCars.map((car) => ({
    ...car,
    export_category: "READY",
  }));

  // BOOKED SELALU DI AWAL

  return [
    ...booked,
    ...ready,
  ];
}

// =====================================================
// PROCESS CAR
// =====================================================

async function processCar(car, index, outputFolder) {

  const order = index + 1;
  const name = carName(car);
  const category = car.export_category;

  try {

    const sourceBuffer = await downloadImage(
      car.ig_image_url
    );

    const storyBuffer = await createStory(
      sourceBuffer,
      category === "BOOKED"
    );

    const filename =
      `${pad(order)}__` +
      `${safeFilename(name)}__` +
      `${safeFilename(car.branch)}__` +
      `${category}.jpg`;

    await writeFile(
      path.join(outputFolder, filename),
      storyBuffer
    );

    console.log(
      `  ✅ ${pad(order)} [${category}]: ${filename}`
    );

    return {
      success: true,
      row: [
        order,
        car.id,
        name,
        car.branch,
        car.year,
        car.transmission,
        car.odometer,
        car.credit_price,
        car.created_at,
        car.status,
        category,
        car.ig_image_url,
        filename,
        "BERHASIL",
      ],
    };

  } catch (error) {

    console.log(
      `  ❌ ${pad(order)} [${category}]: ` +
      `${name} — ${error.message}`
    );

    return {
      success: false,
      row: [
        order,
        car.id,
        name,
        car.branch,
        car.year,
        car.transmission,
        car.odometer,
        car.credit_price,
        car.created_at,
        car.status,
        category,
        car.ig_image_url,
        "",
        `GAGAL: ${error.message}`,
      ],
    };
  }
}

// =====================================================
// CONCURRENCY
// =====================================================

async function processWithConcurrency(cars, outputFolder) {

  const results = new Array(cars.length);
  let nextIndex = 0;

  async function worker() {

    while (true) {

      const index = nextIndex;
      nextIndex += 1;

      if (index >= cars.length) {
        return;
      }

      results[index] = await processCar(
        cars[index],
        index,
        outputFolder
      );
    }
  }

  const workerCount = Math.min(
    DOWNLOAD_CONCURRENCY,
    cars.length
  );

  await Promise.all(
    Array.from(
      { length: workerCount },
      () => worker()
    )
  );

  return results;
}

// =====================================================
// MAIN
// =====================================================

async function main() {

  console.log("");
  console.log("================================================");
  console.log(" GARAGE88 — EXPORT IG STORY");
  console.log(" BOOKED 10 + READY 100");
  console.log("================================================");
  console.log("");

  const cars = await getLatestCars();

  if (cars.length === 0) {
    throw new Error(
      "Tidak ada unit BOOKED atau READY dengan IG cover."
    );
  }

  const bookedCount = cars.filter(
    (car) => car.export_category === "BOOKED"
  ).length;

  const readyCount = cars.filter(
    (car) => car.export_category === "READY"
  ).length;

  const outputFolder = path.resolve(
    `exports/ig-story-booked-ready-${timestamp()}`
  );

  await mkdir(outputFolder, {
    recursive: true,
  });

  console.log(`📦 BOOKED : ${bookedCount}`);
  console.log(`📦 READY  : ${readyCount}`);
  console.log(`📦 TOTAL  : ${cars.length}`);
  console.log("");

  // TAMPILKAN DAFTAR UNIT

  console.log("DAFTAR UNIT EXPORT:");
  console.log("");

  cars.forEach((car, index) => {

    console.log(
      `${pad(index + 1)}. [${car.export_category}] ${carName(car)}`
    );

    console.log(
      `    Branch  : ${car.branch || "-"}`
    );

    console.log(
      `    Created : ${car.created_at || "-"}`
    );

    console.log(
      `    KM      : ${car.odometer ?? "-"}`
    );

    console.log("");
  });

  // DOWNLOAD DAN GENERATE

  const results = await processWithConcurrency(
    cars,
    outputFolder
  );

  // MANIFEST CSV

  const manifest = [[
    "ORDER",
    "CAR_ID",
    "MOBIL",
    "CABANG",
    "TAHUN",
    "TRANSMISI",
    "ODOMETER",
    "HARGA_KREDIT",
    "CREATED_AT",
    "STATUS",
    "KATEGORI_EXPORT",
    "IG_IMAGE_URL",
    "FILE",
    "HASIL",
  ]];

  for (const result of results) {
    manifest.push(result.row);
  }

  const csv = manifest
    .map((row) =>
      row.map(csvValue).join(",")
    )
    .join("\n");

  await writeFile(
    path.join(outputFolder, "manifest.csv"),
    csv,
    "utf8"
  );

  // SUMMARY

  const success = results.filter(
    (result) => result.success
  ).length;

  const failed = results.length - success;

  console.log("");
  console.log("================================================");
  console.log(" SELESAI");
  console.log("================================================");

  console.log(`📦 BOOKED         : ${bookedCount}`);
  console.log(`📦 READY          : ${readyCount}`);
  console.log(`📦 TOTAL          : ${cars.length}`);
  console.log(`✅ BERHASIL       : ${success}`);
  console.log(`❌ GAGAL          : ${failed}`);
  console.log(`📁 OUTPUT         : ${outputFolder}`);

  console.log("================================================");
  console.log("");

  openFolder(outputFolder);
}

// =====================================================
// RUN
// =====================================================

main().catch((error) => {

  console.error("");
  console.error("================================================");
  console.error(" FATAL ERROR");
  console.error("================================================");

  console.error(error);

  console.error("");

  process.exit(1);
});
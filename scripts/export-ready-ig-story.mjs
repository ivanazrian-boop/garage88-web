import { createClient } from "@supabase/supabase-js";
import { loadEnvFile } from "node:process";
import { mkdir, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import sharp from "sharp";

const LIMIT = 100;
const DOWNLOAD_CONCURRENCY = 6;

const STORY_WIDTH = 1080;
const STORY_HEIGHT = 1920;
const POST_HEIGHT = 1350;

const PAD_TOP = 285;
const PAD_BOTTOM = 285;

/*
 * Kekuatan vignette hitam.
 * 0.00 = tidak ada
 * 0.10 = tipis
 * 0.20 = cukup terlihat
 * 0.30 = kuat
 */
const VIGNETTE_TOP_OPACITY = 0.22;
const VIGNETTE_BOTTOM_OPACITY = 0.22;

/*
 * Seberapa jauh vignette masuk ke area foto.
 * Semakin besar = vignette lebih panjang.
 */
const VIGNETTE_FADE = 420;

/* =====================================================
   ENV
   ===================================================== */

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
  throw new Error(
    "SUPABASE_URL tidak ditemukan"
  );
}

if (!SUPABASE_SERVICE_KEY) {
  throw new Error(
    "SUPABASE_SERVICE_KEY tidak ditemukan"
  );
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

/* =====================================================
   TEXT
   ===================================================== */

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

/* =====================================================
   SORT
   ===================================================== */

function compareLatest(a, b) {
  /*
   * 1. CREATED_AT TERBARU
   */

  const createdA =
    new Date(
      a.created_at ?? 0
    ).getTime();

  const createdB =
    new Date(
      b.created_at ?? 0
    ).getTime();

  if (
    createdA !== createdB
  ) {
    return createdB - createdA;
  }

  /*
   * 2. TAHUN TERBARU
   */

  const yearA =
    Number(a.year ?? 0);

  const yearB =
    Number(b.year ?? 0);

  if (
    yearA !== yearB
  ) {
    return yearB - yearA;
  }

  /*
   * 3. KM TERENDAH
   */

  const kmA =
    Number(
      a.odometer ??
      Number.MAX_SAFE_INTEGER
    );

  const kmB =
    Number(
      b.odometer ??
      Number.MAX_SAFE_INTEGER
    );

  if (
    kmA !== kmB
  ) {
    return kmA - kmB;
  }

  /*
   * 4. NAMA MOBIL
   */

  return carName(a).localeCompare(
    carName(b),
    "id"
  );
}

/* =====================================================
   FILE
   ===================================================== */

function pad(
  value,
  length = 3
) {
  return String(value)
    .padStart(length, "0");
}

function timestamp() {
  return new Date()
    .toISOString()
    .replaceAll(":", "-")
    .replace("T", "_")
    .replace(
      /\.\d{3}Z$/,
      ""
    );
}

function safeFilename(value) {
  return cleanText(value)
    .normalize("NFKD")
    .replace(
      /[^a-zA-Z0-9]+/g,
      "_"
    )
    .replace(
      /^_+|_+$/g,
      ""
    )
    .toUpperCase();
}

function csvValue(value) {
  return `"${String(value ?? "")
    .replaceAll('"', '""')}"`;
}

function openFolder(folder) {
  if (
    process.platform === "darwin"
  ) {
    execFile(
      "open",
      [folder],
      () => {}
    );
    return;
  }

  if (
    process.platform === "win32"
  ) {
    execFile(
      "explorer",
      [folder],
      () => {}
    );
    return;
  }

  execFile(
    "xdg-open",
    [folder],
    () => {}
  );
}

/* =====================================================
   IMAGE DOWNLOAD
   ===================================================== */

async function downloadImage(url) {
  const response =
    await fetch(
      url,
      {
        cache: "no-store",

        headers: {
          "user-agent":
            "Garage88-IG-Story-Downloader/1.0",
        },
      }
    );

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}`
    );
  }

  return Buffer.from(
    await response.arrayBuffer()
  );
}

/* =====================================================
   VIGNETTE
   ===================================================== */

/*
 * Membuat gradient hitam transparan.
 *
 * TOP:
 * hitam kuat di ujung paling atas
 * lalu semakin transparan ke bawah.
 *
 * BOTTOM:
 * hitam kuat di ujung paling bawah
 * lalu semakin transparan ke atas.
 */

async function createTopVignette() {
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
          y1="0"
          x2="0"
          y2="1"
        >
          <stop
            offset="0%"
            stop-color="black"
            stop-opacity="${VIGNETTE_TOP_OPACITY}"
          />

          <stop
            offset="45%"
            stop-color="black"
            stop-opacity="${VIGNETTE_TOP_OPACITY * 0.45}"
          />

          <stop
            offset="100%"
            stop-color="black"
            stop-opacity="0"
          />
        </linearGradient>
      </defs>

      <rect
        x="0"
        y="0"
        width="${STORY_WIDTH}"
        height="${VIGNETTE_FADE}"
        fill="url(#gradient)"
      />
    </svg>
  `;

  return sharp(
    Buffer.from(svg)
  )
    .png()
    .toBuffer();
}

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
        x="0"
        y="0"
        width="${STORY_WIDTH}"
        height="${VIGNETTE_FADE}"
        fill="url(#gradient)"
      />
    </svg>
  `;

  return sharp(
    Buffer.from(svg)
  )
    .png()
    .toBuffer();
}

/* =====================================================
   CREATE STORY
   ===================================================== */

async function createStory(
  sourceBuffer
) {
  /*
   * =================================================
   * NORMALISASI FOTO
   * =================================================
   *
   * Cover:
   * 1080 × 1350
   */

  const normalizedPost =
    await sharp(sourceBuffer)
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
        chromaSubsampling:
          "4:4:4",
      })
      .toBuffer();

  /*
   * =================================================
   * AMBIL PIXEL PALING ATAS
   * =================================================
   *
   * Bukan average.
   *
   * Kita benar-benar mengambil
   * baris pixel terakhir dari foto.
   */

  const topEdge =
    await sharp(
      normalizedPost
    )
      .extract({
        left: 0,
        top: 0,

        width:
          STORY_WIDTH,

        height: 1,
      })
      .png()
      .toBuffer();

  /*
   * =================================================
   * AMBIL PIXEL PALING BAWAH
   * =================================================
   */

  const bottomEdge =
    await sharp(
      normalizedPost
    )
      .extract({
        left: 0,

        top:
          POST_HEIGHT - 1,

        width:
          STORY_WIDTH,

        height: 1,
      })
      .png()
      .toBuffer();

  /*
   * =================================================
   * EXTEND BAGIAN ATAS
   * =================================================
   *
   * Baris pixel paling atas
   * diperpanjang sampai
   * bagian paling atas Story.
   */

  const topPad =
    await sharp(
      topEdge
    )
      .resize(
        STORY_WIDTH,
        PAD_TOP,
        {
          fit: "fill",
        }
      )
      .png()
      .toBuffer();

  /*
   * =================================================
   * EXTEND BAGIAN BAWAH
   * =================================================
   */

  const bottomPad =
    await sharp(
      bottomEdge
    )
      .resize(
        STORY_WIDTH,
        PAD_BOTTOM,
        {
          fit: "fill",
        }
      )
      .png()
      .toBuffer();

  /*
   * =================================================
   * VIGNETTE
   * =================================================
   */

  const topVignette =
    await createTopVignette();

  const bottomVignette =
    await createBottomVignette();

  /*
   * =================================================
   * CANVAS STORY
   * =================================================
   */

  return sharp({
    create: {
      width:
        STORY_WIDTH,

      height:
        STORY_HEIGHT,

      channels: 3,

      background: {
        r: 0,
        g: 0,
        b: 0,
      },
    },
  })
    .composite([
      /*
       * BACKGROUND ATAS
       */

      {
        input:
          topPad,

        left: 0,

        top: 0,
      },

      /*
       * FOTO UTAMA
       */

      {
        input:
          normalizedPost,

        left: 0,

        top:
          PAD_TOP,
      },

      /*
       * BACKGROUND BAWAH
       */

      {
        input:
          bottomPad,

        left: 0,

        top:
          PAD_TOP +
          POST_HEIGHT,
      },

      /*
       * VIGNETTE ATAS
       */

      {
        input:
          topVignette,

        left: 0,

        top: 0,
      },

      /*
       * VIGNETTE BAWAH
       */

      {
        input:
          bottomVignette,

        left: 0,

        top:
          STORY_HEIGHT -
          VIGNETTE_FADE,
      },
    ])
    .jpeg({
      quality: 97,

      chromaSubsampling:
        "4:4:4",
    })
    .toBuffer();
}

/* =====================================================
   SUPABASE
   ===================================================== */

async function getLatestCars() {
  const {
    data,
    error,
  } =
    await supabase
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

      /*
       * HANYA READY
       */

      .eq(
        "status",
        "READY"
      )

      /*
       * HARUS PUNYA IMAGE
       */

      .not(
        "ig_image_url",
        "is",
        null
      )

      .neq(
        "ig_image_url",
        ""
      )

      /*
       * Ambil cukup banyak
       * sebelum sorting lokal
       */

      .limit(1000);

  if (error) {
    throw new Error(
      `Supabase error: ${error.message}`
    );
  }

  const cars =
    (data ?? [])
      .filter(
        (car) =>
          cleanText(
            car.ig_image_url
          )
      );

  /*
   * TERBARU
   */

  cars.sort(
    compareLatest
  );

  /*
   * AMBIL 100
   */

  return cars.slice(
    0,
    LIMIT
  );
}

/* =====================================================
   PROCESS CAR
   ===================================================== */

async function processCar(
  car,
  index,
  outputFolder
) {
  const order =
    index + 1;

  const name =
    carName(car);

  try {
    const sourceBuffer =
      await downloadImage(
        car.ig_image_url
      );

    const storyBuffer =
      await createStory(
        sourceBuffer
      );

    const filename =
      `${pad(order)}__` +
      `${safeFilename(name)}__` +
      `${safeFilename(car.branch)}__` +
      `STORY.jpg`;

    await writeFile(
      path.join(
        outputFolder,
        filename
      ),
      storyBuffer
    );

    console.log(
      `  ✅ ${pad(order)}: ${filename}`
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
        car.ig_image_url,
        filename,
        "BERHASIL",
      ],
    };
  } catch (error) {
    console.log(
      `  ❌ ${pad(order)}: ` +
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
        car.ig_image_url,
        "",
        `GAGAL: ${error.message}`,
      ],
    };
  }
}

/* =====================================================
   CONCURRENCY
   ===================================================== */

async function processWithConcurrency(
  cars,
  outputFolder
) {
  const results =
    new Array(
      cars.length
    );

  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index =
        nextIndex;

      nextIndex += 1;

      if (
        index >=
        cars.length
      ) {
        return;
      }

      results[index] =
        await processCar(
          cars[index],
          index,
          outputFolder
        );
    }
  }

  const workerCount =
    Math.min(
      DOWNLOAD_CONCURRENCY,
      cars.length
    );

  await Promise.all(
    Array.from(
      {
        length:
          workerCount,
      },
      () => worker()
    )
  );

  return results;
}

/* =====================================================
   MAIN
   ===================================================== */

async function main() {
  console.log("");

  console.log(
    "==============================================="
  );

  console.log(
    " GARAGE88 — EXPORT IG STORY"
  );

  console.log(
    " UNIT READY PALING TERBARU"
  );

  console.log(
    "==============================================="
  );

  console.log("");

  const cars =
    await getLatestCars();

  if (
    cars.length === 0
  ) {
    throw new Error(
      "Tidak ada unit READY dengan IG cover."
    );
  }

  const outputFolder =
    path.resolve(
      `exports/ig-story-latest-${LIMIT}-${timestamp()}`
    );

  await mkdir(
    outputFolder,
    {
      recursive: true,
    }
  );

  console.log(
    `📦 Unit terpilih : ${cars.length}`
  );

  console.log(
    `📅 Sorting       : created_at terbaru`
  );

  console.log(
    `🎨 Background    : edge pixel`
  );

  console.log(
    `🖤 Vignette      : atas + bawah`
  );

  console.log("");

  /*
   * TAMPILKAN DAFTAR
   */

  console.log(
    "UNIT TERBARU:"
  );

  console.log("");

  cars.forEach(
    (car, index) => {
      console.log(
        `${pad(index + 1)}. ` +
        `${carName(car)}`
      );

      console.log(
        `    Branch  : ${
          car.branch || "-"
        }`
      );

      console.log(
        `    Created : ${
          car.created_at || "-"
        }`
      );

      console.log(
        `    KM      : ${
          car.odometer ?? "-"
        }`
      );

      console.log("");
    }
  );

  /*
   * DOWNLOAD
   */

  const results =
    await processWithConcurrency(
      cars,
      outputFolder
    );

  /*
   * MANIFEST
   */

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
    "IG_IMAGE_URL",
    "FILE",
    "HASIL",
  ]];

  for (
    const result
    of results
  ) {
    manifest.push(
      result.row
    );
  }

  const csv =
    manifest
      .map(
        (row) =>
          row
            .map(csvValue)
            .join(",")
      )
      .join("\n");

  await writeFile(
    path.join(
      outputFolder,
      "manifest.csv"
    ),
    csv,
    "utf8"
  );

  /*
   * SUMMARY
   */

  const success =
    results.filter(
      (result) =>
        result.success
    ).length;

  const failed =
    results.length -
    success;

  console.log("");

  console.log(
    "==============================================="
  );

  console.log(
    " SELESAI"
  );

  console.log(
    "==============================================="
  );

  console.log(
    `🎯 Mode          : UNIT TERBARU`
  );

  console.log(
    `📦 Unit          : ${cars.length}`
  );

  console.log(
    `🎨 Edge          : PIXEL TERAKHIR`
  );

  console.log(
    `🖤 Vignette      : HITAM`
  );

  console.log(
    `✅ Berhasil      : ${success}`
  );

  console.log(
    `❌ Gagal         : ${failed}`
  );

  console.log(
    `📁 Output        : ${outputFolder}`
  );

  console.log(
    "==============================================="
  );

  console.log("");

  openFolder(
    outputFolder
  );
}

/* =====================================================
   RUN
   ===================================================== */

main()
  .catch(
    (error) => {
      console.error("");

      console.error(
        "==============================================="
      );

      console.error(
        "FATAL ERROR"
      );

      console.error(
        "==============================================="
      );

      console.error(
        error
      );

      console.error("");

      process.exit(1);
    }
  );
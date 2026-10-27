import "dotenv/config";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

// ============================================================
// GARAGE88
// TIKTOK / IG STORY CAROUSEL
// KHUSUS:
// 1. SEDAN
// 2. CITY CAR
//
// VISUAL:
// - 1080 x 1920
// - Foto utama 1080 x 1350
// - Top 285 px = stretch 1 pixel paling atas
// - Bottom 285 px = stretch 1 pixel paling bawah
// - Vignette sangat tipis
// - TANPA TEXT
// - TANPA LOGO
// - TANPA COVER
// ============================================================


// ============================================================
// SUPABASE
// ============================================================

const SUPABASE_URL =
  process.env.PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL;

const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("");
  console.error("❌ Supabase environment variable belum tersedia.");
  console.error("");
  console.error("Pastikan .env memiliki:");
  console.error("PUBLIC_SUPABASE_URL=...");
  console.error("SUPABASE_SERVICE_KEY=...");
  console.error("");
  process.exit(1);
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY
);


// ============================================================
// STORY CONFIG
// ============================================================

const STORY_WIDTH = 1080;
const STORY_HEIGHT = 1920;

const PHOTO_WIDTH = 1080;
const PHOTO_HEIGHT = 1350;

const PAD_TOP = 285;
const PAD_BOTTOM = 285;

const VIGNETTE_OPACITY = 0.18;

const MAX_PER_CATEGORY = 20;


// ============================================================
// OUTPUT
// ============================================================

const OUTPUT_ROOT = path.resolve(
  "exports",
  `garage88-sedan-citycar-${formatDateTime(new Date())}`
);


// ============================================================
// CATEGORY
// ============================================================

const CATEGORIES = [
  {
    key: "01_SEDAN",
    title: "SEDAN",
    filter: isSedan,
  },
  {
    key: "02_CITY_CAR",
    title: "CITY CAR",
    filter: isCityCar,
  },
];


// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log("");
  console.log("================================================");
  console.log(" GARAGE88 — SEDAN + CITY CAR");
  console.log("================================================");
  console.log("");

  fs.mkdirSync(OUTPUT_ROOT, {
    recursive: true,
  });

  console.log("📡 Mengambil data READY dari Supabase...");
  console.log("");

  const { data: cars, error } = await supabase
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
    .eq("status", "READY");

  if (error) {
    console.error("❌ Supabase error:");
    console.error(error);
    process.exit(1);
  }

  if (!cars || cars.length === 0) {
    console.log("❌ Tidak ada unit READY.");
    process.exit(0);
  }

  console.log(`✅ Total READY: ${cars.length} unit`);
  console.log("");

  const summaryRows = [];

  // ==========================================================
  // LOOP CATEGORY
  // ==========================================================

  for (const category of CATEGORIES) {
    console.log("================================================");
    console.log(`📁 ${category.title}`);
    console.log("================================================");

    let selected = cars.filter(category.filter);

    console.log(
      `Ditemukan: ${selected.length} unit`
    );

    // Sort berdasarkan score
    selected = sortCars(selected);

    // Maksimal 20 unit
    selected = selected.slice(
      0,
      MAX_PER_CATEGORY
    );

    console.log(
      `Dipakai: ${selected.length} unit`
    );
    console.log("");

    const categoryDir = path.join(
      OUTPUT_ROOT,
      category.key
    );

    fs.mkdirSync(categoryDir, {
      recursive: true,
    });

    const manifestRows = [];

    let number = 1;

    // ========================================================
    // GENERATE FOTO
    // ========================================================

    for (const car of selected) {
      try {
        if (!car.ig_image_url) {
          console.log(
            `⚠️ SKIP — tidak ada foto: ${carName(car)}`
          );
          continue;
        }

        const filename =
          `${String(number).padStart(2, "0")}_` +
          `${slugify(car.brand)}_` +
          `${slugify(car.model)}_` +
          `${car.year || "NA"}.jpg`;

        const outputPath = path.join(
          categoryDir,
          filename
        );

        console.log(
          `🖼️ ${String(number).padStart(2, "0")} — ${carName(car)}`
        );

        await generateStoryImage(
          car.ig_image_url,
          outputPath
        );

        const row = {
          no: number,
          id: car.id,
          category: category.title,
          branch: car.branch || "",
          brand: car.brand || "",
          model: car.model || "",
          variant: car.variant || "",
          year: car.year || "",
          transmission: car.transmission || "",
          odometer: car.odometer || "",
          credit_price: car.credit_price || "",
          filename,
        };

        manifestRows.push(row);
        summaryRows.push(row);

        number++;
      } catch (error) {
        console.error(
          `❌ Gagal: ${carName(car)}`
        );

        console.error(
          error.message
        );
      }
    }

    // ========================================================
    // MANIFEST
    // ========================================================

    writeCsv(
      path.join(
        categoryDir,
        "manifest.csv"
      ),
      manifestRows
    );

    console.log("");
    console.log(
      `✅ ${category.title}: ${manifestRows.length} foto`
    );

    console.log("");
  }

  // ==========================================================
  // SUMMARY
  // ==========================================================

  writeCsv(
    path.join(
      OUTPUT_ROOT,
      "SUMMARY.csv"
    ),
    summaryRows
  );

  console.log("================================================");
  console.log(" SELESAI");
  console.log("================================================");
  console.log("");

  console.log(
    `📂 Output: ${OUTPUT_ROOT}`
  );

  console.log("");

  console.log(
    `📊 Total foto: ${summaryRows.length}`
  );

  console.log("");
}


// ============================================================
// SEDAN FILTER
// ============================================================
//
// SEMUA CIVIC MASUK SEDAN:
// - Civic Sedan
// - Civic Hatchback
// - Civic Turbo
// - Civic RS
// - Civic Type R
//
// Tidak ada pengecualian Civic Hatchback.
// ============================================================

function isSedan(car) {
  const text = normalize(
    `${car.brand || ""} ${car.model || ""} ${car.variant || ""}`
  );

  const sedanKeywords = [
    // Toyota
    "camry",
    "corolla altis",
    "corolla",
    "vios",

    // Honda
    "civic",
    "city sedan",
    "accord",

    // Mazda
    "mazda 3 sedan",
    "mazda3 sedan",
    "mazda 6",
    "mazda6",
    "mazda 2 sedan",
    "mazda2 sedan",

    // Mercedes
    "mercedes c-class",
    "mercedes c class",
    "c-class",
    "c class",

    "mercedes e-class",
    "mercedes e class",
    "e-class",
    "e class",

    "mercedes s-class",
    "mercedes s class",
    "s-class",
    "s class",

    // BMW
    "bmw 3 series",
    "bmw 5 series",
    "bmw 7 series",

    // Audi
    "audi a4",
    "audi a6",
    "audi a8",

    // Volvo
    "volvo s60",
    "volvo s90",

    // Nissan
    "nissan teana",
    "nissan sentra",
    "nissan sylphy",

    // Subaru
    "subaru wrx",

    // Tesla
    "tesla model 3",
    "tesla model s",
  ];

  return sedanKeywords.some(
    keyword => text.includes(keyword)
  );
}


// ============================================================
// CITY CAR FILTER
// ============================================================

function isCityCar(car) {
  const text = normalize(
    `${car.brand || ""} ${car.model || ""} ${car.variant || ""}`
  );

  const cityCarKeywords = [
    // Honda
    "brio",
    "jazz",

    // Toyota
    "yaris",
    "agya",

    // Daihatsu
    "ayla",

    // Nissan
    "march",
    "micra",

    // Suzuki
    "swift",
    "ignis",
    "karimun",
    "wagon r",
    "wagon-r",
    "celerio",

    // Mitsubishi
    "mirage",

    // Hyundai
    "i10",
    "i20",

    // Kia
    "picanto",

    // Daihatsu / other
    "sirion",

    // Honda
    "city hatchback",

    // Mazda
    "mazda 2 hatchback",
    "mazda2 hatchback",

    // Mini
    "mini cooper",
    "mini hatchback",
    "mini one",
    "mini 3 door",
    "mini 5 door",

    // Fiat
    "fiat 500",

    // Volkswagen
    "vw polo",
    "volkswagen polo",

    // Suzuki
    "alto",
  ];

  return cityCarKeywords.some(
    keyword => text.includes(keyword)
  );
}


// ============================================================
// SORTING
// ============================================================

function sortCars(cars) {
  return [...cars].sort(
    (a, b) => {
      const scoreA = carScore(a);
      const scoreB = carScore(b);

      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }

      // Tahun terbaru lebih tinggi
      const yearA =
        Number(a.year) || 0;

      const yearB =
        Number(b.year) || 0;

      if (yearB !== yearA) {
        return yearB - yearA;
      }

      // KM lebih rendah lebih tinggi
      const kmA =
        Number(a.odometer) || 999999;

      const kmB =
        Number(b.odometer) || 999999;

      if (kmA !== kmB) {
        return kmA - kmB;
      }

      // Created terbaru
      return (
        new Date(b.created_at || 0) -
        new Date(a.created_at || 0)
      );
    }
  );
}


// ============================================================
// CAR SCORE
// ============================================================

function carScore(car) {
  let score = 0;

  const year =
    Number(car.year) || 0;

  const km =
    Number(car.odometer) || 0;

  const price =
    Number(car.credit_price) || 0;

  // ----------------------------------------------------------
  // Tahun
  // ----------------------------------------------------------

  score += Math.max(
    0,
    year - 2015
  ) * 3;

  // ----------------------------------------------------------
  // KM rendah
  // ----------------------------------------------------------

  if (
    km > 0 &&
    km < 50000
  ) {
    score += 20;
  } else if (
    km > 0 &&
    km < 80000
  ) {
    score += 10;
  }

  // ----------------------------------------------------------
  // Harga menarik
  // ----------------------------------------------------------

  if (
    price > 0 &&
    price < 250000000
  ) {
    score += 8;
  }

  // ----------------------------------------------------------
  // LOW KM
  // ----------------------------------------------------------

  if (isLowKM(car)) {
    score += 15;
  }

  // ----------------------------------------------------------
  // Ada foto
  // ----------------------------------------------------------

  if (car.ig_image_url) {
    score += 5;
  }

  return score;
}


// ============================================================
// LOW KM
// ============================================================
//
// RULE:
// - KM > 0
// - KM < 50.000
// - Average KM/year < 10.000
//
// Average dihitung sendiri.
// Tidak menggunakan mileage_status dari database.
// ============================================================

function isLowKM(car) {
  const km =
    Number(car.odometer) || 0;

  const year =
    Number(car.year) || 0;

  // KM 0 tidak dianggap LOW KM
  if (
    km <= 0 ||
    year <= 0
  ) {
    return false;
  }

  const currentYear =
    new Date().getFullYear();

  const age =
    Math.max(
      1,
      currentYear - year
    );

  const averageKmPerYear =
    km / age;

  return (
    km < 50000 &&
    averageKmPerYear < 10000
  );
}


// ============================================================
// GENERATE STORY IMAGE
// ============================================================

async function generateStoryImage(
  imageUrl,
  outputPath
) {
  // ----------------------------------------------------------
  // DOWNLOAD IMAGE
  // ----------------------------------------------------------

  const response =
    await fetch(imageUrl);

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}`
    );
  }

  const arrayBuffer =
    await response.arrayBuffer();

  const inputBuffer =
    Buffer.from(arrayBuffer);


  // ----------------------------------------------------------
  // FOTO UTAMA
  // 1080 x 1350
  // ----------------------------------------------------------

  const photo =
    await sharp(inputBuffer)
      .rotate()
      .resize(
        PHOTO_WIDTH,
        PHOTO_HEIGHT,
        {
          fit: "cover",
          position: "centre",
        }
      )
      .jpeg({
        quality: 95,
      })
      .toBuffer();


  // ----------------------------------------------------------
  // TOP EDGE
  //
  // Ambil hanya 1 ROW pixel paling atas
  // lalu stretch secara vertikal menjadi 285 px.
  // ----------------------------------------------------------

  const topEdge =
    await sharp(photo)
      .extract({
        left: 0,
        top: 0,
        width: PHOTO_WIDTH,
        height: 1,
      })
      .resize(
        PHOTO_WIDTH,
        PAD_TOP,
        {
          fit: "fill",
        }
      )
      .toBuffer();


  // ----------------------------------------------------------
  // BOTTOM EDGE
  //
  // Ambil hanya 1 ROW pixel paling bawah
  // lalu stretch secara vertikal menjadi 285 px.
  // ----------------------------------------------------------

  const bottomEdge =
    await sharp(photo)
      .extract({
        left: 0,
        top: PHOTO_HEIGHT - 1,
        width: PHOTO_WIDTH,
        height: 1,
      })
      .resize(
        PHOTO_WIDTH,
        PAD_BOTTOM,
        {
          fit: "fill",
        }
      )
      .toBuffer();


  // ----------------------------------------------------------
  // TOP VIGNETTE
  // ----------------------------------------------------------

  const topVignette =
    Buffer.from(`
      <svg
        width="${STORY_WIDTH}"
        height="${PAD_TOP}"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient
            id="topGradient"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop
              offset="0%"
              stop-color="black"
              stop-opacity="${VIGNETTE_OPACITY}"
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
          height="${PAD_TOP}"
          fill="url(#topGradient)"
        />
      </svg>
    `);


  // ----------------------------------------------------------
  // BOTTOM VIGNETTE
  // ----------------------------------------------------------

  const bottomVignette =
    Buffer.from(`
      <svg
        width="${STORY_WIDTH}"
        height="${PAD_BOTTOM}"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient
            id="bottomGradient"
            x1="0"
            y1="1"
            x2="0"
            y2="0"
          >
            <stop
              offset="0%"
              stop-color="black"
              stop-opacity="${VIGNETTE_OPACITY}"
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
          height="${PAD_BOTTOM}"
          fill="url(#bottomGradient)"
        />
      </svg>
    `);


  // ----------------------------------------------------------
  // COMPOSITE
  // ----------------------------------------------------------

  await sharp({
    create: {
      width: STORY_WIDTH,
      height: STORY_HEIGHT,
      channels: 3,
      background: {
        r: 0,
        g: 0,
        b: 0,
      },
    },
  })
    .composite([
      // TOP STRETCHED PIXEL
      {
        input: topEdge,
        left: 0,
        top: 0,
      },

      // FOTO UTAMA
      {
        input: photo,
        left: 0,
        top: PAD_TOP,
      },

      // BOTTOM STRETCHED PIXEL
      {
        input: bottomEdge,
        left: 0,
        top:
          PAD_TOP +
          PHOTO_HEIGHT,
      },

      // TOP VIGNETTE
      {
        input: topVignette,
        left: 0,
        top: 0,
      },

      // BOTTOM VIGNETTE
      {
        input: bottomVignette,
        left: 0,
        top:
          PAD_TOP +
          PHOTO_HEIGHT,
      },
    ])
    .jpeg({
      quality: 95,
      chromaSubsampling: "4:4:4",
    })
    .toFile(outputPath);
}


// ============================================================
// CSV
// ============================================================

function writeCsv(
  filePath,
  rows
) {
  if (!rows.length) {
    fs.writeFileSync(
      filePath,
      "",
      "utf8"
    );

    return;
  }

  const headers =
    Object.keys(rows[0]);

  const lines = [];

  lines.push(
    headers.join(",")
  );

  for (const row of rows) {
    lines.push(
      headers
        .map(
          header =>
            csvEscape(row[header])
        )
        .join(",")
    );
  }

  fs.writeFileSync(
    filePath,
    lines.join("\n"),
    "utf8"
  );
}


function csvEscape(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  const text =
    String(value);

  if (
    text.includes(",") ||
    text.includes('"') ||
    text.includes("\n")
  ) {
    return (
      '"' +
      text.replaceAll(
        '"',
        '""'
      ) +
      '"'
    );
  }

  return text;
}


// ============================================================
// HELPERS
// ============================================================

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(
      /[-_/]+/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


function slugify(value) {
  return String(
    value || "unknown"
  )
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(
      /[^a-z0-9]+/g,
      "-"
    )
    .replace(
      /^-+|-+$/g,
      "");
}


function carName(car) {
  return [
    car.brand,
    car.model,
    car.variant,
    car.year,
  ]
    .filter(Boolean)
    .join(" ");
}


function formatDateTime(date) {
  const pad =
    value =>
      String(value)
        .padStart(2, "0");

  return (
    `${date.getFullYear()}` +
    `${pad(date.getMonth() + 1)}` +
    `${pad(date.getDate())}_` +
    `${pad(date.getHours())}` +
    `${pad(date.getMinutes())}` +
    `${pad(date.getSeconds())}`
  );
}


// ============================================================
// RUN
// ============================================================

main().catch(error => {
  console.error("");
  console.error("❌ ERROR:");
  console.error(error);
  console.error("");

  process.exit(1);
});
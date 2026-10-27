import { createClient } from "@supabase/supabase-js";
import { loadEnvFile } from "node:process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { exec } from "node:child_process";
import sharp from "sharp";

/* =====================================================
   ENV
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

/* =====================================================
   CONFIG
   ===================================================== */

const ITEMS_PER_GROUP = 9;

const WIDTH = 1080;
const HEIGHT = 1350;

/* =====================================================
   HELPERS
   ===================================================== */

function pad(number, length = 2) {
  return String(number).padStart(length, "0");
}

function cleanFilename(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[^\w\s.-]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

function normalizeText(value) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/CR-V/g, "CRV")
    .replace(/SANTA-FE/g, "SANTA FE")
    .replace(/IONIQ-5/g, "IONIQ 5")
    .replace(/\s+/g, " ")
    .trim();
}

function getCarText(car) {
  return normalizeText(
    [
      car.brand,
      car.model,
      car.variant,
      car.fuel,
      car.transmission,
      car.color,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function safeNumber(value, fallback = 0) {
  const num = Number(value);

  return Number.isFinite(num)
    ? num
    : fallback;
}

function safePrice(value) {
  const num = Number(value);

  return Number.isFinite(num)
    ? num
    : Number.POSITIVE_INFINITY;
}

function timestamp() {
  const now = new Date();

  return (
    `${now.getFullYear()}` +
    `${pad(now.getMonth() + 1)}` +
    `${pad(now.getDate())}-` +
    `${pad(now.getHours())}` +
    `${pad(now.getMinutes())}`
  );
}

function csvValue(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

/* =====================================================
   MODEL DETECTION
   ===================================================== */

function has(car, keyword) {
  return getCarText(car).includes(keyword);
}

function isAlphard(car) {
  return has(car, "ALPHARD");
}

function isZenix(car) {
  return has(car, "ZENIX");
}

function isEVHybrid(car) {
  const text = getCarText(car);

  return (
    text.includes("HYBRID") ||
    text.includes("IONIQ") ||
    text.includes("KONA") ||
    text.includes("EV") ||
    text.includes("ELECTRIC") ||
    text.includes("PRIUS")
  );
}

function isSUV(car) {
  const text = getCarText(car);

  const keywords = [
    "CRV",
    "HRV",
    "FORTUNER",
    "PAJERO",
    "SANTA FE",
    "ALMAZ",
    "CX-5",
    "CX5",
    "XTRAIL",
    "X-TRAIL",
    "TERRA",
    "TIGGO",
    "OUTLANDER",
    "BRV",
    "BR-V",
    "RUSH",
    "TERIOS",
    "RAIZE",
    "ROCKY",
  ];

  return keywords.some(
    (keyword) =>
      text.includes(keyword)
  );
}

function isFamilyMpV(car) {
  const text = getCarText(car);

  const keywords = [
    "VOXY",
    "SERENA",
    "INNOVA",
    "AVANZA",
    "VELOZ",
    "XPANDER",
    "LIVINA",
    "MOBILIO",
    "ELGRAND",
    "NAV1",
    "ODYSSEY",
    "FREED",
    "ERTIGA",
    "CORTEZ",
    "STARGAZER",
    "CALYA",
    "SIGRA",
    "XENIA",
  ];

  return keywords.some(
    (keyword) =>
      text.includes(keyword)
  );
}

/* =====================================================
   MARKETABILITY SCORE
   ===================================================== */

function popularityScore(car) {
  const text = getCarText(car);

  const rules = [
    ["ALPHARD", 50],
    ["ZENIX", 48],

    ["IONIQ", 42],
    ["KONA", 40],

    ["CRV", 41],
    ["FORTUNER", 40],
    ["PAJERO", 40],
    ["SANTA FE", 39],
    ["HRV", 38],

    ["VOXY", 37],
    ["INNOVA", 37],
    ["AVANZA", 35],
    ["VELOZ", 35],
    ["XPANDER", 35],

    ["BRIO", 36],
    ["JAZZ", 34],
    ["YARIS", 32],

    ["ALMAZ", 31],
    ["SERENA", 30],
    ["ELGRAND", 29],

    ["RAIZE", 32],
    ["RUSH", 31],
    ["TERIOS", 30],

    ["MOBILIO", 29],
    ["LIVINA", 29],
    ["XENIA", 30],
    ["CALYA", 30],
    ["SIGRA", 30],
  ];

  let score = 0;

  for (const [keyword, value] of rules) {
    if (text.includes(keyword)) {
      score += value;
      break;
    }
  }

  if (text.includes("HYBRID")) {
    score += 6;
  }

  if (text.includes("LOW KM")) {
    score += 4;
  }

  return score;
}

function yearScore(car) {
  const year = safeNumber(car.year);

  if (year >= 2024) return 20;
  if (year >= 2023) return 18;
  if (year >= 2022) return 16;
  if (year >= 2021) return 14;
  if (year >= 2020) return 12;
  if (year >= 2019) return 10;
  if (year >= 2017) return 7;

  return 3;
}

function mileageScore(car) {
  const km = safeNumber(
    car.odometer,
    Number.POSITIVE_INFINITY
  );

  if (!Number.isFinite(km)) {
    return 0;
  }

  if (km < 20_000) return 18;
  if (km < 40_000) return 15;
  if (km < 60_000) return 12;
  if (km < 80_000) return 8;
  if (km < 100_000) return 5;

  return 2;
}

function totalScore(car) {
  return (
    popularityScore(car) +
    yearScore(car) +
    mileageScore(car)
  );
}

/* =====================================================
   SORT BEST FIRST
   ===================================================== */

function sortBest(cars) {
  return [...cars].sort(
    (a, b) => {
      const scoreDiff =
        totalScore(b) -
        totalScore(a);

      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      const yearDiff =
        safeNumber(b.year) -
        safeNumber(a.year);

      if (yearDiff !== 0) {
        return yearDiff;
      }

      const kmDiff =
        safeNumber(
          a.odometer,
          Number.MAX_SAFE_INTEGER
        ) -
        safeNumber(
          b.odometer,
          Number.MAX_SAFE_INTEGER
        );

      if (kmDiff !== 0) {
        return kmDiff;
      }

      return (
        safePrice(a.credit_price) -
        safePrice(b.credit_price)
      );
    }
  );
}

/* =====================================================
   DATABASE
   ===================================================== */

async function getCars() {
  const {
    data,
    error,
  } = await supabase
    .from("cars")
    .select(`
      id,
      brand,
      model,
      variant,
      year,
      color,
      fuel,
      transmission,
      odometer,
      credit_price,
      branch,
      ig_image_url,
      status,
      created_at
    `)
    .eq(
      "status",
      "READY"
    );

  if (error) {
    throw new Error(
      `Gagal mengambil cars: ${error.message}`
    );
  }

  return (data ?? []).filter(
    (car) =>
      String(
        car.ig_image_url ?? ""
      ).trim() !== ""
  );
}

/* =====================================================
   GROUP PICKER

   NO DUPLICATE BETWEEN GROUPS
   ===================================================== */

function buildGroups(cars) {
  const used = new Set();

  function choose(
    candidates,
    count = ITEMS_PER_GROUP
  ) {
    const available =
      sortBest(candidates)
        .filter(
          (car) =>
            !used.has(car.id)
        );

    const selected =
      available.slice(
        0,
        count
      );

    for (
      const car
      of selected
    ) {
      used.add(car.id);
    }

    return selected;
  }

  /* ===================================================
     GROUP 1
     ALPHARD
     =================================================== */

  const group1 = choose(
    cars.filter(isAlphard)
  );

  /* ===================================================
     GROUP 2
     ZENIX
     =================================================== */

  const group2 = choose(
    cars.filter(isZenix)
  );

  /* ===================================================
     GROUP 3
     EV + HYBRID
     =================================================== */

  const group3 = choose(
    cars.filter(
      (car) =>
        isEVHybrid(car) &&
        !isAlphard(car) &&
        !isZenix(car)
    )
  );

  /* ===================================================
     GROUP 4
     SUV
     =================================================== */

  const group4 = choose(
    cars.filter(
      (car) =>
        isSUV(car)
    )
  );

  /* ===================================================
     GROUP 5
     FAMILY / MPV
     =================================================== */

  const group5 = choose(
    cars.filter(
      (car) =>
        isFamilyMpV(car)
    )
  );

  /* ===================================================
     GROUP 6
     BEST VALUE

     Harga termurah / populer dari seluruh sisa stok
     =================================================== */

  const remaining =
    cars
      .filter(
        (car) =>
          !used.has(car.id)
      )
      .sort(
        (a, b) => {
          const priceDiff =
            safePrice(a.credit_price) -
            safePrice(b.credit_price);

          if (priceDiff !== 0) {
            return priceDiff;
          }

          return (
            totalScore(b) -
            totalScore(a)
          );
        }
      );

  const group6 =
    remaining.slice(
      0,
      ITEMS_PER_GROUP
    );

  for (
    const car
    of group6
  ) {
    used.add(car.id);
  }

  return [
    {
      no: 1,
      name: "ALPHARD",
      cars: group1,
    },
    {
      no: 2,
      name: "ZENIX",
      cars: group2,
    },
    {
      no: 3,
      name: "EV_HYBRID",
      cars: group3,
    },
    {
      no: 4,
      name: "SUV_PILIHAN",
      cars: group4,
    },
    {
      no: 5,
      name: "FAMILY_MPV",
      cars: group5,
    },
    {
      no: 6,
      name: "BEST_VALUE",
      cars: group6,
    },
  ];
}

/* =====================================================
   NORMALIZE IMAGE TO IG POST
   1080 x 1350
   ===================================================== */

async function buildIgPost(bytes) {
  return await sharp(bytes)
    .resize(
      WIDTH,
      HEIGHT,
      {
        fit: "cover",
        position: "centre",
      }
    )
    .jpeg({
      quality: 95,
    })
    .toBuffer();
}

/* =====================================================
   MAIN
   ===================================================== */

async function main() {
  console.log("");
  console.log(
    "GARAGE88 IG CAROUSEL EXPORT"
  );

  console.log(
    "6 GROUP x 9 UNIT"
  );

  console.log(
    "================================"
  );

  const cars =
    await getCars();

  console.log("");
  console.log(
    `READY + IG Cover: ${cars.length}`
  );

  const groups =
    buildGroups(cars);

  console.log("");

  for (
    const group
    of groups
  ) {
    console.log(
      `GROUP ${group.no} ${group.name}: ${group.cars.length} unit`
    );
  }

  /* ===================================================
     ROOT FOLDER
     =================================================== */

  const root =
    path.resolve(
      `exports/ig-carousel-6-groups-${timestamp()}`
    );

  await mkdir(
    root,
    {
      recursive: true,
    }
  );

  const masterManifest = [[
    "GROUP",
    "NO",
    "CAR_ID",
    "CAR",
    "YEAR",
    "BRANCH",
    "KM",
    "CREDIT_PRICE",
    "SCORE",
    "FILENAME",
  ]];

  let totalSuccess = 0;
  let totalFailed = 0;

  /* ===================================================
     EXPORT GROUPS
     =================================================== */

  for (
    const group
    of groups
  ) {

    const groupFolder =
      path.join(
        root,
        `GROUP_${pad(group.no)}__${group.name}`
      );

    await mkdir(
      groupFolder,
      {
        recursive: true,
      }
    );

    console.log("");
    console.log(
      `===== GROUP ${group.no} — ${group.name} =====`
    );

    for (
      let index = 0;
      index < group.cars.length;
      index++
    ) {

      const car =
        group.cars[index];

      const carName =
        [
          car.brand,
          car.model,
          car.variant,
        ]
          .filter(Boolean)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();

      console.log(
        `[${index + 1}/${group.cars.length}] ${carName} ${car.year ?? ""}`
      );

      try {

        const response =
          await fetch(
            car.ig_image_url,
            {
              cache: "no-store",
            }
          );

        if (
          !response.ok
        ) {
          throw new Error(
            `HTTP ${response.status}`
          );
        }

        const bytes =
          new Uint8Array(
            await response.arrayBuffer()
          );

        const finalImage =
          await buildIgPost(
            bytes
          );

        const baseName =
          cleanFilename(
            [
              car.brand,
              car.model,
              car.variant,
              car.year,
            ]
              .filter(Boolean)
              .join(" ")
          );

        /*
         * Nomor 02-10 sengaja,
         * karena file 01 nantinya COVER.
         */

        const carouselNo =
          pad(
            index + 2
          );

        const filename =
          `${carouselNo}__${baseName}.jpg`;

        const outputPath =
          path.join(
            groupFolder,
            filename
          );

        await writeFile(
          outputPath,
          finalImage
        );

        masterManifest.push([
          group.name,
          index + 1,
          car.id,
          carName,
          car.year ?? "",
          car.branch ?? "",
          car.odometer ?? "",
          car.credit_price ?? "",
          totalScore(car),
          filename,
        ]);

        totalSuccess++;

        console.log(
          `  ✅ ${filename}`
        );

      } catch (error) {

        totalFailed++;

        console.log(
          `  ❌ ${
            error instanceof Error
              ? error.message
              : String(error)
          }`
        );

      }
    }

    /*
     * Placeholder supaya jelas
     * cover harus diletakkan sebagai 01.
     */

    await writeFile(
      path.join(
        groupFolder,
        "01__COVER_TARUH_DISINI.txt"
      ),
      `GROUP ${group.no} - ${group.name}\n\nTambahkan cover carousel sebagai file 01.\n`,
      "utf8"
    );
  }

  /* ===================================================
     MANIFEST
     =================================================== */

  const csv =
    masterManifest
      .map(
        (row) =>
          row
            .map(csvValue)
            .join(",")
      )
      .join("\n");

  await writeFile(
    path.join(
      root,
      "manifest.csv"
    ),
    csv,
    "utf8"
  );

  /* ===================================================
     SUMMARY
     =================================================== */

  console.log("");
  console.log(
    "================================"
  );

  console.log("SELESAI");

  console.log(
    `✅ Export berhasil : ${totalSuccess}`
  );

  console.log(
    `❌ Gagal           : ${totalFailed}`
  );

  console.log("");
  console.log(
    `Folder: ${root}`
  );

  console.log("");

  if (
    process.platform ===
    "darwin"
  ) {
    exec(
      `open "${root}"`
    );
  }
}

main().catch(
  (error) => {
    console.error("");
    console.error(
      "FATAL ERROR:"
    );
    console.error(error);
    process.exit(1);
  }
);
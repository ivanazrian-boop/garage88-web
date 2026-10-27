import { createClient } from "@supabase/supabase-js";
import { loadEnvFile } from "node:process";
import { mkdir, writeFile } from "node:fs/promises";
import { exec } from "node:child_process";
import path from "node:path";
import sharp from "sharp";

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

const WIDTH = 1080;
const HEIGHT = 1920;
const CARS_PER_PAGE = 4;

const PAGE_BG = "#080808";

const CARD_WIDTH = 500;
const CARD_HEIGHT = 625;
const CARD_RADIUS = 18;

const LEFT_X = 25;
const RIGHT_X = 555;

const FIRST_ROW_Y = 25;
const SECOND_ROW_Y = 665;

const CTA_TOP = 1315;

/* =====================================================
   HELPERS
   ===================================================== */

function pad(number, length = 2) {
  return String(number).padStart(length, "0");
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

function cleanText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalized(value) {
  return cleanText(value)
    .toUpperCase()
    .normalize("NFKD")
    .replace(/[^A-Z0-9]/g, "");
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
   KM STATUS
   ===================================================== */

function getKmStatus(car) {
  const odometer = Number(car.odometer);
  const year = Number(car.year);

  if (
    !Number.isFinite(odometer) ||
    !Number.isFinite(year)
  ) {
    return "";
  }

  const currentYear = new Date().getFullYear();
  const age = Math.max(1, currentYear - year);
  const average = odometer / age;

  if (
    average < 10_000 &&
    odometer < 100_000
  ) {
    return "LOW KM";
  }

  if (
    average < 10_000 &&
    odometer >= 100_000
  ) {
    return "LOW USAGE KM";
  }

  return "";
}

/* =====================================================
   GROUP & ORDER
   ===================================================== */

function searchableCarText(car) {
  return normalized(
    [
      car.brand,
      car.model,
      car.variant,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function isCrv(car) {
  return searchableCarText(car)
    .includes("HONDACRV");
}

function isCipondoh(car) {
  const branch = normalized(car.branch);

  return (
    branch.includes("GAJAHMADACIPONDOH") ||
    branch.includes("CIPONDOH")
  );
}

function isZenix(car) {
  return searchableCarText(car)
    .includes("ZENIX");
}

function compareWithinGroup(a, b) {
  const priceA = Number(a.credit_price);
  const priceB = Number(b.credit_price);

  if (priceA !== priceB) {
    return priceA - priceB;
  }

  const yearDifference =
    Number(b.year ?? 0) -
    Number(a.year ?? 0);

  if (yearDifference !== 0) {
    return yearDifference;
  }

  const kmA = Number.isFinite(
    Number(a.odometer)
  )
    ? Number(a.odometer)
    : Number.MAX_SAFE_INTEGER;

  const kmB = Number.isFinite(
    Number(b.odometer)
  )
    ? Number(b.odometer)
    : Number.MAX_SAFE_INTEGER;

  return kmA - kmB;
}

function buildGroups(allCars) {
  const usedIds = new Set();

  function take(predicate) {
    const cars = allCars
      .filter(
        (car) =>
          !usedIds.has(car.id) &&
          predicate(car)
      )
      .sort(compareWithinGroup);

    for (const car of cars) {
      usedIds.add(car.id);
    }

    return cars;
  }

  const groups = [
    {
      title: "PILIHAN CR-V",
      slug: "CRV",
      cars: take(isCrv),
    },
    {
      title: "GAJAH MADA CIPONDOH",
      slug: "GAJAH_MADA_CIPONDOH",
      cars: take(isCipondoh),
    },
    {
      title: "PILIHAN ZENIX",
      slug: "ZENIX",
      cars: take(isZenix),
    },
    {
      title: "PILIHAN LOW KM",
      slug: "LOW_KM",
      cars: take(
        (car) =>
          getKmStatus(car) === "LOW KM"
      ),
    },
    {
      title: "LOW USAGE PILIHAN",
      slug: "LOW_USAGE",
      cars: take(
        (car) =>
          getKmStatus(car) ===
          "LOW USAGE KM"
      ),
    },
    {
      title: "UNIT PILIHAN GARAGE88",
      slug: "UNIT_LAIN",
      cars: take(() => true),
    },
  ];

  return groups.filter(
    (group) => group.cars.length > 0
  );
}

function chunk(array, size) {
  const result = [];

  for (
    let index = 0;
    index < array.length;
    index += size
  ) {
    result.push(
      array.slice(index, index + size)
    );
  }

  return result;
}

function buildPages(groups) {
  const orderedCars = groups.flatMap(
    (group) =>
      group.cars.map((car) => ({
        car,
        groupTitle: group.title,
        groupSlug: group.slug,
      }))
  );

  return chunk(
    orderedCars,
    CARS_PER_PAGE
  ).map((items, pageIndex) => {
    const slugs = [
      ...new Set(
        items.map((item) => item.groupSlug)
      ),
    ];

    const isSingleGroup = slugs.length === 1;

    return {
      title: isSingleGroup
        ? items[0].groupTitle
        : "UNIT PILIHAN GARAGE88",

      slug: isSingleGroup
        ? items[0].groupSlug
        : "UNIT_PILIHAN",

      pageNumber: pageIndex + 1,

      cars: items.map(
        (item) => item.car
      ),
    };
  });
}

/* =====================================================
   DATABASE
   ===================================================== */

async function getCars() {
  const { data, error } = await supabase
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
      cash_price,
      dp,
      status,
      ig_image_url,
      created_at
    `)
    .eq("status", "READY")
    .not("ig_image_url", "is", null)
    .neq("ig_image_url", "");

  if (error) {
    throw new Error(
      `Supabase error: ${error.message}`
    );
  }

  return (data ?? []).filter(
    (car) =>
      cleanText(car.ig_image_url)
  );
}

/* =====================================================
   DOWNLOAD IMAGE
   ===================================================== */

async function downloadImage(url) {
  const response = await fetch(url, {
    cache: "no-store",

    headers: {
      "user-agent":
        "Garage88-IG-Story-4-Cards/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Image HTTP ${response.status}`
    );
  }

  return Buffer.from(
    await response.arrayBuffer()
  );
}

/* =====================================================
   CARD
   ===================================================== */

async function makeCard(imageUrl) {
  const source =
    await downloadImage(imageUrl);

  const resized =
    await sharp(source)
      .rotate()
      .resize(
        CARD_WIDTH,
        CARD_HEIGHT,
        {
          fit: "cover",
          position: "centre",
        }
      )
      .flatten({
        background: "#ffffff",
      })
      .removeAlpha()
      .toColorspace("srgb")
      .jpeg({
        quality: 96,
        chromaSubsampling: "4:4:4",
      })
      .toBuffer();

  const mask = Buffer.from(`
    <svg
      width="${CARD_WIDTH}"
      height="${CARD_HEIGHT}"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        width="${CARD_WIDTH}"
        height="${CARD_HEIGHT}"
        rx="${CARD_RADIUS}"
        ry="${CARD_RADIUS}"
        fill="#ffffff"
      />
    </svg>
  `);

  return sharp(resized)
    .composite([
      {
        input: mask,
        blend: "dest-in",
      },
    ])
    .png()
    .toBuffer();
}

/* =====================================================
   BACKGROUND + CTA
   ===================================================== */

function makeBackgroundSvg() {
  return Buffer.from(`
    <svg
      width="${WIDTH}"
      height="${HEIGHT}"
      xmlns="http://www.w3.org/2000/svg"
    >
      <!-- BACKGROUND -->
      <rect
        width="${WIDTH}"
        height="${HEIGHT}"
        fill="${PAGE_BG}"
      />

      <!-- GARIS PEMBATAS -->
      <rect
        x="55"
        y="${CTA_TOP}"
        width="970"
        height="2"
        fill="#262626"
      />

      <!-- CTA KECIL -->
      <text
        x="540"
        y="1415"
        text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif"
        font-size="20"
        font-weight="800"
        letter-spacing="4"
        fill="#a1a1aa"
      >
        TERTARIK SALAH SATU UNITNYA?
      </text>

      <!-- CHAT US -->
      <text
        x="540"
        y="1500"
        text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif"
        font-size="66"
        font-weight="900"
        letter-spacing="3"
        fill="#ffffff"
      >
        CHAT US
      </text>

      <!-- LINK -->
      <text
        x="540"
        y="1550"
        text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif"
        font-size="23"
        font-weight="800"
        letter-spacing="2"
        fill="#facc15"
      >
        KLIK LINK DI BAWAH
      </text>

      <!-- GARIS PANAH -->
      <path
        d="M540 1600 L540 1740"
        stroke="#ffffff"
        stroke-width="16"
        stroke-linecap="round"
      />

      <!-- UJUNG PANAH -->
      <path
        d="M495 1705 L540 1750 L585 1705"
        fill="none"
        stroke="#facc15"
        stroke-width="16"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  `);
}

/* =====================================================
   PAGE
   ===================================================== */

async function makePage(page) {
  const cards = await Promise.all(
    page.cars.map(
      (car) =>
        makeCard(car.ig_image_url)
    )
  );

  const positions = [
    {
      left: LEFT_X,
      top: FIRST_ROW_Y,
    },
    {
      left: RIGHT_X,
      top: FIRST_ROW_Y,
    },
    {
      left: LEFT_X,
      top: SECOND_ROW_Y,
    },
    {
      left: RIGHT_X,
      top: SECOND_ROW_Y,
    },
  ];

  const composites = [
    {
      input: makeBackgroundSvg(),
      left: 0,
      top: 0,
    },
  ];

  for (
    let index = 0;
    index < cards.length;
    index++
  ) {
    composites.push({
      input: cards[index],
      left: positions[index].left,
      top: positions[index].top,
    });
  }

  return sharp({
    create: {
      width: WIDTH,
      height: HEIGHT,
      channels: 3,
      background: PAGE_BG,
    },
  })
    .composite(composites)
    .jpeg({
      quality: 97,
      chromaSubsampling: "4:4:4",
    })
    .toBuffer();
}

/* =====================================================
   MAIN
   ===================================================== */

async function main() {
  console.log("");

  console.log(
    "GARAGE88 — IG STORY 4 CARDS"
  );

  console.log(
    "BLACK COVER + CHAT US CTA"
  );

  console.log(
    "================================"
  );

  const cars = await getCars();

  if (!cars.length) {
    throw new Error(
      "Tidak ditemukan unit READY dengan ig_image_url."
    );
  }

  const groups = buildGroups(cars);
  const pages = buildPages(groups);

  const outputFolder =
    path.resolve(
      `exports/ready-stock-story-4cards-${timestamp()}`
    );

  await mkdir(
    outputFolder,
    {
      recursive: true,
    }
  );

  console.log(
    `READY dengan IG cover: ${cars.length}`
  );

  console.log(
    `Total Story: ${pages.length}`
  );

  const manifest = [[
    "PAGE",
    "GROUP",
    "CARD_POSITION",
    "CAR_ID",
    "CAR",
    "CABANG",
    "OTR_CREDIT",
    "KM",
    "KM_STATUS",
    "IG_IMAGE_URL",
    "FILE",
    "HASIL",
  ]];

  for (
    let pageIndex = 0;
    pageIndex < pages.length;
    pageIndex++
  ) {
    const page = pages[pageIndex];
    const pageNumber = pageIndex + 1;

    console.log("");

    console.log(
      `Story ${pageNumber}/${pages.length}`
    );

    const filename =
      `${pad(pageNumber, 3)}__` +
      `${safeFilename(page.slug)}__` +
      `${page.cars.length}CARDS.jpg`;

    try {
      const image =
        await makePage(page);

      await writeFile(
        path.join(
          outputFolder,
          filename
        ),
        image
      );

      for (
        let cardIndex = 0;
        cardIndex < page.cars.length;
        cardIndex++
      ) {
        const car =
          page.cars[cardIndex];

        manifest.push([
          pageNumber,
          page.title,
          cardIndex + 1,
          car.id,
          carName(car),
          car.branch ?? "",
          car.credit_price ?? "",
          car.odometer ?? "",
          getKmStatus(car),
          car.ig_image_url,
          filename,
          "BERHASIL",
        ]);
      }

      console.log(
        `✅ ${filename}`
      );
    } catch (error) {
      console.log(
        `❌ Gagal: ${error.message}`
      );

      for (
        let cardIndex = 0;
        cardIndex < page.cars.length;
        cardIndex++
      ) {
        const car =
          page.cars[cardIndex];

        manifest.push([
          pageNumber,
          page.title,
          cardIndex + 1,
          car.id,
          carName(car),
          car.branch ?? "",
          car.credit_price ?? "",
          car.odometer ?? "",
          getKmStatus(car),
          car.ig_image_url,
          "",
          `GAGAL: ${error.message}`,
        ]);
      }
    }
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

  console.log("");

  console.log(
    "================================"
  );

  console.log("SELESAI");

  console.log(
    `✅ Unit: ${cars.length}`
  );

  console.log(
    `✅ Story: ${pages.length}`
  );

  console.log("");

  console.log(
    `📁 ${outputFolder}`
  );

  if (
    process.platform ===
    "darwin"
  ) {
    exec(
      `open "${outputFolder}"`
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
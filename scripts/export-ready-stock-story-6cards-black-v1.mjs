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
  try { loadEnvFile(file); } catch {}
}

tryLoadEnv(".env");
tryLoadEnv(".dev.vars");

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;

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

const CARS_PER_PAGE = 6;

const PAGE_BG = "#080808";

const CARD_WIDTH = 480;
const CARD_HEIGHT = 600;
const CARD_RADIUS = 18;

const LEFT_X = 45;
const RIGHT_X = 555;

const FIRST_ROW_Y = 15;
const SECOND_ROW_Y = 625;
const THIRD_ROW_Y = 1235;

/* =====================================================
   MODE

   all   = READY + BOOKED
   ready = READY only
===================================================== */

function getMode() {
  const raw =
    String(process.argv[2] ?? "all")
      .trim()
      .toLowerCase();

  if (
    raw === "all" ||
    raw === ""
  ) {
    return "all";
  }

  if (
    raw === "ready" ||
    raw === "ready-only" ||
    raw === "readyonly"
  ) {
    return "ready";
  }

  throw new Error(
    `Mode tidak dikenal: "${raw}"

Gunakan:

node scripts/export-ready-stock-story-6cards-black-v1.mjs all

atau:

node scripts/export-ready-stock-story-6cards-black-v1.mjs ready`
  );
}

const MODE = getMode();

/* =====================================================
   HELPERS
===================================================== */

function pad(number, length = 2) {
  return String(number)
    .padStart(length, "0");
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

function safeFilename(value) {
  return cleanText(value)
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

function csvValue(value) {
  return `"${String(value ?? "")
    .replaceAll('"', '""')}"`;
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

function carStatus(car) {
  return cleanText(
    car.status
  ).toUpperCase();
}

function isReady(car) {
  return carStatus(car) === "READY";
}

function isBooked(car) {
  return carStatus(car) === "BOOKED";
}

function getCreatedTimestamp(car) {
  if (!car.created_at) {
    return 0;
  }

  const time =
    new Date(
      car.created_at
    ).getTime();

  return Number.isFinite(time)
    ? time
    : 0;
}

/* =====================================================
   KM STATUS
===================================================== */

function getKmStatus(car) {
  const odometer =
    Number(car.odometer);

  const year =
    Number(car.year);

  if (
    !Number.isFinite(odometer) ||
    !Number.isFinite(year)
  ) {
    return "";
  }

  const currentYear =
    new Date().getFullYear();

  const age =
    Math.max(
      1,
      currentYear - year
    );

  const average =
    odometer / age;

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
   SORTING

   MODE ALL:

   READY + BOOKED dalam SATU urutan.

   created_at terbaru -> terlama.

   BOOKED TIDAK DIPINDAHKAN KE BELAKANG.

   Status hanya menentukan BOOKED STAMP.

   MODE READY:

   READY terbaru -> terlama.
===================================================== */

function compareCars(a, b) {

  const dateA =
    getCreatedTimestamp(a);

  const dateB =
    getCreatedTimestamp(b);

  /*
   * Semua status diperlakukan sebagai satu daftar.
   *
   * Tidak ada lagi:
   *
   * READY = 1
   * BOOKED = 2
   *
   * Jadi BOOKED bisa muncul di posisi
   * berapa pun sesuai created_at.
   */

  if (dateA !== dateB) {
    return dateB - dateA;
  }

  /*
   * Fallback kalau created_at sama.
   */

  return String(b.id ?? "")
    .localeCompare(
      String(a.id ?? ""),
      "id",
      {
        numeric: true,
        sensitivity: "base",
      }
    );
}

/* =====================================================
   CHUNK
===================================================== */

function chunk(array, size) {
  const result = [];

  for (
    let index = 0;
    index < array.length;
    index += size
  ) {
    result.push(
      array.slice(
        index,
        index + size
      )
    );
  }

  return result;
}

/* =====================================================
   BUILD PAGES
===================================================== */

function buildPages(allCars) {

  const sortedCars =
    [...allCars]
      .sort(compareCars);

  const pageChunks =
    chunk(
      sortedCars,
      CARS_PER_PAGE
    );

  return pageChunks.map(
    (cars, pageIndex) => {

      /*
       * Page title tetap mengikuti
       * status unit yang ada di page.
       */

      const statuses = [
        ...new Set(
          cars.map(
            (car) =>
              carStatus(car)
          )
        ),
      ];

      let pageTitle = "";
      let pageSlug = "";

      if (
        statuses.length === 1
      ) {

        pageTitle =
          statuses[0];

        pageSlug =
          statuses[0];

      } else {

        pageTitle =
          statuses.join(" → ");

        pageSlug =
          statuses.join("_TO_");

      }

      return {
        title:
          pageTitle,

        slug:
          pageSlug,

        pageNumber:
          pageIndex + 1,

        cars,
      };
    }
  );
}

/* =====================================================
   DATABASE
===================================================== */

async function getCars() {

  const statuses =
    MODE === "ready"
      ? ["READY"]
      : ["READY", "BOOKED"];

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
      cash_price,
      dp,
      status,
      ig_image_url,
      created_at
    `)
    .in(
      "status",
      statuses
    )
    .not(
      "ig_image_url",
      "is",
      null
    )
    .neq(
      "ig_image_url",
      ""
    );

  if (error) {
    throw new Error(
      `Supabase error: ${error.message}`
    );
  }

  return (data ?? [])
    .filter(
      (car) =>
        cleanText(
          car.ig_image_url
        )
    )
    .sort(compareCars);
}

/* =====================================================
   DOWNLOAD IMAGE
===================================================== */

async function downloadImage(url) {

  const response =
    await fetch(
      url,
      {
        cache:
          "no-store",

        headers: {
          "user-agent":
            "Garage88-IG-Story-6-Cards-Black/4.0",
        },
      }
    );

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
   BOOKED STAMP

   CLEAN PREMIUM VERSION
===================================================== */

function makeBookedStampSvg() {

  return Buffer.from(`

    <svg
      width="${CARD_WIDTH}"
      height="${CARD_HEIGHT}"
      xmlns="http://www.w3.org/2000/svg"
    >

      <g
        transform="
          rotate(
            -8
            ${CARD_WIDTH / 2}
            ${CARD_HEIGHT / 2}
          )
        "
      >

        <!-- SOFT SHADOW -->

        <rect
          x="80"
          y="225"
          width="320"
          height="104"
          rx="10"
          fill="#000000"
          fill-opacity="0.16"
          transform="translate(5 6)"
        />

        <!-- OUTER WHITE BORDER -->

        <rect
          x="74"
          y="219"
          width="320"
          height="104"
          rx="10"
          fill="#e31818"
          stroke="#ffffff"
          stroke-width="5"
        />

        <!-- INNER WHITE BORDER -->

        <rect
          x="86"
          y="231"
          width="296"
          height="80"
          rx="5"
          fill="none"
          stroke="#ffffff"
          stroke-width="2.4"
          stroke-opacity="0.95"
        />

        <!-- BOOKED TEXT -->

        <text
          x="234"
          y="272"
          text-anchor="middle"
          dominant-baseline="middle"
          font-family="Arial, Helvetica, sans-serif"
          font-size="52"
          font-weight="900"
          letter-spacing="3"
          fill="#ffffff"
        >
          BOOKED
        </text>

        <!-- SUBTLE STAMP TEXTURE -->

        <circle
          cx="104"
          cy="245"
          r="1.4"
          fill="#ffffff"
          fill-opacity="0.22"
        />

        <circle
          cx="138"
          cy="296"
          r="1.7"
          fill="#ffffff"
          fill-opacity="0.20"
        />

        <circle
          cx="181"
          cy="247"
          r="1.3"
          fill="#ffffff"
          fill-opacity="0.18"
        />

        <circle
          cx="220"
          cy="301"
          r="1.5"
          fill="#ffffff"
          fill-opacity="0.20"
        />

        <circle
          cx="268"
          cy="245"
          r="1.3"
          fill="#ffffff"
          fill-opacity="0.18"
        />

        <circle
          cx="311"
          cy="296"
          r="1.5"
          fill="#ffffff"
          fill-opacity="0.22"
        />

        <circle
          cx="351"
          cy="247"
          r="1.3"
          fill="#ffffff"
          fill-opacity="0.20"
        />

      </g>

    </svg>

  `);
}

/* =====================================================
   CARD
===================================================== */

async function makeCard(car) {

  const source =
    await downloadImage(
      car.ig_image_url
    );

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
      .toColorspace(
        "srgb"
      )
      .jpeg({
        quality: 96,
        chromaSubsampling:
          "4:4:4",
      })
      .toBuffer();

  /* ==========================
     ROUND CARD
  ========================== */

  const mask =
    Buffer.from(`

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

  let card =
    await sharp(resized)
      .composite([
        {
          input:
            mask,

          blend:
            "dest-in",
        },
      ])
      .png()
      .toBuffer();

  /* ==========================
     BOOKED STAMP
  ========================== */

  if (
    MODE === "all" &&
    isBooked(car)
  ) {

    card =
      await sharp(card)
        .composite([
          {
            input:
              makeBookedStampSvg(),

            left: 0,
            top: 0,
          },
        ])
        .png()
        .toBuffer();
  }

  return card;
}

/* =====================================================
   BACKGROUND
===================================================== */

function makeBackgroundSvg() {

  return Buffer.from(`

    <svg
      width="${WIDTH}"
      height="${HEIGHT}"
      xmlns="http://www.w3.org/2000/svg"
    >

      <rect
        width="${WIDTH}"
        height="${HEIGHT}"
        fill="${PAGE_BG}"
      />

      <!-- CHAT US -->

      <text
        x="540"
        y="1870"
        text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif"
        font-size="24"
        font-weight="900"
        letter-spacing="2"
        fill="#ffffff"
      >
        CHAT US
      </text>

      <!-- ARROW -->

      <path
        d="M540 1883 L540 1903"
        stroke="#facc15"
        stroke-width="5"
        stroke-linecap="round"
      />

      <path
        d="
          M530 1896
          L540 1906
          L550 1896
        "
        fill="none"
        stroke="#facc15"
        stroke-width="5"
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

  const cards =
    await Promise.all(
      page.cars.map(
        (car) =>
          makeCard(car)
      )
    );

  const positions = [

    {
      left:
        LEFT_X,

      top:
        FIRST_ROW_Y,
    },

    {
      left:
        RIGHT_X,

      top:
        FIRST_ROW_Y,
    },

    {
      left:
        LEFT_X,

      top:
        SECOND_ROW_Y,
    },

    {
      left:
        RIGHT_X,

      top:
        SECOND_ROW_Y,
    },

    {
      left:
        LEFT_X,

      top:
        THIRD_ROW_Y,
    },

    {
      left:
        RIGHT_X,

      top:
        THIRD_ROW_Y,
    },

  ];

  const composites = [

    {
      input:
        makeBackgroundSvg(),

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

      input:
        cards[index],

      left:
        positions[index]
          .left,

      top:
        positions[index]
          .top,

    });

  }

  return sharp({

    create: {

      width:
        WIDTH,

      height:
        HEIGHT,

      channels:
        3,

      background:
        PAGE_BG,

    },

  })

    .composite(
      composites
    )

    .jpeg({

      quality:
        97,

      chromaSubsampling:
        "4:4:4",

    })

    .toBuffer();
}

/* =====================================================
   MAIN
===================================================== */

async function main() {

  console.log("");

  console.log(
    "GARAGE88 — IG STORY 6 CARDS BLACK"
  );

  console.log(
    "================================"
  );

  console.log(
    `MODE: ${MODE.toUpperCase()}`
  );

  if (
    MODE === "all"
  ) {

    console.log(
      "READY + BOOKED — CREATED_AT NEWEST → OLDEST"
    );

  } else {

    console.log(
      "READY ONLY — NEWEST → OLDEST"
    );

  }

  console.log(
    "================================"
  );

  const cars =
    await getCars();

  if (!cars.length) {

    throw new Error(

      MODE === "all"

        ? "Tidak ditemukan unit READY / BOOKED dengan ig_image_url."

        : "Tidak ditemukan unit READY dengan ig_image_url."

    );

  }

  const readyCars =
    cars.filter(
      isReady
    );

  const bookedCars =
    cars.filter(
      isBooked
    );

  const pages =
    buildPages(cars);

  /* ==========================
     OUTPUT FOLDER
  ========================== */

  const outputFolder =
    path.resolve(
      `exports/ready-stock-story-6cards-black-${MODE}-${timestamp()}`
    );

  await mkdir(
    outputFolder,
    {
      recursive: true,
    }
  );

  console.log("");

  console.log(
    `TOTAL: ${cars.length}`
  );

  console.log(
    `READY: ${readyCars.length}`
  );

  console.log(
    `BOOKED: ${bookedCars.length}`
  );

  console.log(
    `STORY: ${pages.length}`
  );

  console.log("");

  /* ==========================
     TERMINAL PREVIEW
  ========================== */

  console.log(
    "URUTAN STOCK:"
  );

  console.log("");

  cars.forEach(
    (car, index) => {

      console.log(

        `${pad(index + 1, 3)}. ` +

        `[${carStatus(car)}] ` +

        `${carName(car)} ` +

        `| ${car.created_at ?? "-"}`

      );

    }
  );

  /* ==========================
     CSV
  ========================== */

  const manifest = [[

    "MODE",

    "PAGE",

    "CARD_POSITION",

    "STATUS",

    "CREATED_AT",

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

  /* ==========================
     GENERATE PAGE
  ========================== */

  for (

    let pageIndex = 0;

    pageIndex < pages.length;

    pageIndex++

  ) {

    const page =
      pages[pageIndex];

    const pageNumber =
      pageIndex + 1;

    console.log("");

    console.log(
      `Story ${pageNumber}/${pages.length}: ${page.title}`
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

        cardIndex <
          page.cars.length;

        cardIndex++

      ) {

        const car =
          page.cars[
            cardIndex
          ];

        manifest.push([

          MODE,

          pageNumber,

          cardIndex + 1,

          carStatus(car),

          car.created_at ?? "",

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

        cardIndex <
          page.cars.length;

        cardIndex++

      ) {

        const car =
          page.cars[
            cardIndex
          ];

        manifest.push([

          MODE,

          pageNumber,

          cardIndex + 1,

          carStatus(car),

          car.created_at ?? "",

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

  /* ==========================
     SAVE CSV
  ========================== */

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

  console.log(
    "SELESAI"
  );

  console.log(
    `✅ MODE: ${MODE}`
  );

  console.log(
    `✅ TOTAL: ${cars.length}`
  );

  console.log(
    `✅ READY: ${readyCars.length}`
  );

  console.log(
    `✅ BOOKED: ${bookedCars.length}`
  );

  console.log(
    `✅ STORY: ${pages.length}`
  );

  console.log("");

  console.log(
    `📁 ${outputFolder}`
  );

  /* ==========================
     OPEN FINDER
  ========================== */

  if (
    process.platform ===
    "darwin"
  ) {

    exec(
      `open "${outputFolder}"`
    );

  }

}

/* =====================================================
   RUN
===================================================== */

main().catch(
  (error) => {

    console.error("");

    console.error(
      "FATAL ERROR:"
    );

    console.error(
      error
    );

    process.exit(1);

  }
);
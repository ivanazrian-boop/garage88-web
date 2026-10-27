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
   CONFIG
   ===================================================== */

const WIDTH = 1080;
const HEIGHT = 1920;

const CARS_PER_PAGE = 6;

/*
 * BLACK V6
 *
 * 2 kolom × 3 baris
 * menggunakan IG COVER langsung.
 */

const PAGE_BG = "#050505";

/*
 * IG cover asli 1080 × 1350 = 4:5.
 *
 * 480 × 600 juga = 4:5
 *
 * Jadi dengan fit: contain,
 * seluruh cover masuk utuh.
 */

const CARD_WIDTH = 480;
const CARD_HEIGHT = 600;

const CARD_RADIUS = 18;

/*
 * Posisi kiri kanan.
 */

const LEFT_X = 45;
const RIGHT_X = 555;

/*
 * 3 row.
 *
 * Card 600px.
 * Gap 10px.
 */

const FIRST_ROW_Y = 95;
const SECOND_ROW_Y = 705;
const THIRD_ROW_Y = 1315;

/*
 * Footer mulai di bawah card.
 */

const FOOTER_START_Y = 1915;

/* =====================================================
   CLI OPTIONS
   ===================================================== */

/*
 * Run semua:
 *
 * node scripts/export-ready-stock-story-6cards-black-v6.mjs
 *
 * Hanya 60 unit terbaru:
 *
 * node scripts/export-ready-stock-story-6cards-black-v6.mjs --limit=60
 */

const limitArg = process.argv.find(
  (arg) => arg.startsWith("--limit=")
);

const LIMIT = limitArg
  ? Number(limitArg.split("=")[1])
  : null;

/* =====================================================
   HELPERS
   ===================================================== */

function pad(number, length = 2) {
  return String(number).padStart(
    length,
    "0"
  );
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

function escapeXml(value) {
  return cleanText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
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

function formatJT(value) {
  const number = Number(value);

  if (
    !Number.isFinite(number) ||
    number <= 0
  ) {
    return "-";
  }

  return `${Math.round(
    number / 1_000_000
  )}JT`;
}

function formatKm(value) {
  const km = Number(value);

  if (!Number.isFinite(km)) {
    return "-";
  }

  return new Intl.NumberFormat(
    "id-ID"
  ).format(km);
}

function formatDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date
    .toLocaleDateString(
      "id-ID",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }
    )
    .replaceAll("/", "-");
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

  const age = Math.max(
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
   DATABASE
   ===================================================== */

async function getCars() {
  const rows = [];

  const pageSize = 500;

  /*
   * LISTING TERBARU PALING ATAS.
   *
   * created_at DESC
   */

  for (
    let start = 0;
    ;
    start += pageSize
  ) {
    const { data, error } =
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
          cash_price,
          dp,
          status,
          ig_image_url,
          created_at
        `)
        .eq("status", "READY")
        .not(
          "ig_image_url",
          "is",
          null
        )
        .neq(
          "ig_image_url",
          ""
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        )
        .range(
          start,
          start + pageSize - 1
        );

    if (error) {
      throw new Error(
        `Supabase error: ${error.message}`
      );
    }

    const batch =
      data ?? [];

    rows.push(...batch);

    if (
      batch.length <
      pageSize
    ) {
      break;
    }
  }

  let cars = rows.filter(
    (car) =>
      cleanText(
        car.ig_image_url
      )
  );

  /*
   * Safety sort sekali lagi.
   */

  cars.sort(
    (a, b) =>
      new Date(
        b.created_at ?? 0
      ).getTime() -
      new Date(
        a.created_at ?? 0
      ).getTime()
  );

  if (
    Number.isFinite(LIMIT) &&
    LIMIT > 0
  ) {
    cars = cars.slice(
      0,
      LIMIT
    );
  }

  return cars;
}

/* =====================================================
   DOWNLOAD IMAGE
   ===================================================== */

async function downloadImage(url) {
  let lastError;

  for (
    let attempt = 1;
    attempt <= 3;
    attempt++
  ) {
    try {
      const response =
        await fetch(url, {
          cache: "no-store",

          headers: {
            "user-agent":
              "Garage88-IG-Story-6-Cards-Black-V6/1.0",
          },

          signal:
            AbortSignal.timeout(
              60000
            ),
        });

      if (!response.ok) {
        await response.body?.cancel();

        throw new Error(
          `Image HTTP ${response.status}`
        );
      }

      return Buffer.from(
        await response.arrayBuffer()
      );
    } catch (error) {
      lastError = error;

      if (attempt < 3) {
        console.log(
          `   ↻ Retry image ${attempt}/3`
        );
      }
    }
  }

  throw lastError;
}

/* =====================================================
   CARD IMAGE
   ===================================================== */

async function makeCard(
  imageUrl
) {
  const source =
    await downloadImage(
      imageUrl
    );

  /*
   * PENTING:
   *
   * fit: contain
   *
   * supaya seluruh IG cover 4:5
   * masuk utuh.
   *
   * Logo atas tidak kepotong.
   * Footer cover juga tidak kepotong.
   */

  const resized =
    await sharp(source)
      .rotate()
      .resize(
        CARD_WIDTH,
        CARD_HEIGHT,
        {
          fit: "contain",
          position: "centre",
          background: "#ffffff",
        }
      )
      .flatten({
        background:
          "#ffffff",
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
   * Rounded corners.
   */

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
   BACKGROUND
   ===================================================== */

function makeBackgroundSvg(
  pageNumber,
  totalPages
) {
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

      <!-- TOP LINE -->

      <rect
        x="25"
        y="28"
        width="1030"
        height="2"
        fill="#222222"
      />

      <!-- HEADER -->

      <text
        x="50"
        y="68"
        font-family="Arial, Helvetica, sans-serif"
        font-size="29"
        font-weight="900"
        fill="#ffffff"
        letter-spacing="1"
      >
        GARAGE88
      </text>

      <text
        x="1030"
        y="68"
        text-anchor="end"
        font-family="Arial, Helvetica, sans-serif"
        font-size="19"
        font-weight="700"
        fill="#8b8b8b"
        letter-spacing="1"
      >
        STOCK TERBARU
      </text>

      <!-- BOTTOM DARK GRADIENT EFFECT -->

      <defs>
        <linearGradient
          id="bottomGradient"
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop
            offset="0%"
            stop-color="#050505"
            stop-opacity="0"
          />
          <stop
            offset="100%"
            stop-color="#050505"
            stop-opacity="1"
          />
        </linearGradient>
      </defs>

      <rect
        x="0"
        y="1810"
        width="${WIDTH}"
        height="110"
        fill="url(#bottomGradient)"
      />

      <!-- FOOTER LINE -->

      <rect
        x="25"
        y="1817"
        width="1030"
        height="1"
        fill="#272727"
      />

      <!-- INSTAGRAM -->

      <text
        x="50"
        y="1865"
        font-family="Arial, Helvetica, sans-serif"
        font-size="22"
        font-weight="800"
        fill="#ffffff"
      >
        @garage88jakarta
      </text>

      <!-- PAGE -->

      <text
        x="540"
        y="1865"
        text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif"
        font-size="18"
        font-weight="700"
        fill="#777777"
        letter-spacing="2"
      >
        ${pad(pageNumber)} / ${pad(totalPages)}
      </text>

      <!-- CHAT US -->

      <text
        x="1030"
        y="1860"
        text-anchor="end"
        font-family="Arial, Helvetica, sans-serif"
        font-size="22"
        font-weight="900"
        fill="#ffffff"
      >
        CHAT US
      </text>

      <!-- ARROW -->

      <path
        d="
          M1015 1875
          L1030 1890
          L1045 1875
        "
        fill="none"
        stroke="#ffffff"
        stroke-width="4"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

    </svg>
  `);
}

/* =====================================================
   CARD BORDER
   ===================================================== */

function makeCardBorderSvg() {
  return Buffer.from(`
    <svg
      width="${CARD_WIDTH}"
      height="${CARD_HEIGHT}"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="1"
        y="1"
        width="${CARD_WIDTH - 2}"
        height="${CARD_HEIGHT - 2}"
        rx="${CARD_RADIUS}"
        ry="${CARD_RADIUS}"
        fill="none"
        stroke="#333333"
        stroke-width="2"
      />
    </svg>
  `);
}

/* =====================================================
   PAGE
   ===================================================== */

async function makePage(
  cars,
  pageNumber,
  totalPages
) {
  /*
   * Layout:
   *
   * 1    2
   *
   * 3    4
   *
   * 5    6
   */

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
    {
      left: LEFT_X,
      top: THIRD_ROW_Y,
    },
    {
      left: RIGHT_X,
      top: THIRD_ROW_Y,
    },
  ];

  /*
   * Download semua image
   * paralel.
   */

  const cards =
    await Promise.all(
      cars.map(
        async (car) => {
          try {
            return await makeCard(
              car.ig_image_url
            );
          } catch (error) {
            console.log(
              `⚠️ Gagal image: ${carName(car)}`
            );

            console.log(
              `   ${error.message}`
            );

            return null;
          }
        }
      )
    );

  const composites = [
    {
      input:
        makeBackgroundSvg(
          pageNumber,
          totalPages
        ),

      left: 0,
      top: 0,
    },
  ];

  for (
    let index = 0;
    index < cards.length;
    index++
  ) {
    if (!cards[index]) {
      continue;
    }

    const position =
      positions[index];

    /*
     * CARD IMAGE
     */

    composites.push({
      input: cards[index],

      left:
        position.left,

      top:
        position.top,
    });

    /*
     * BORDER
     */

    composites.push({
      input:
        makeCardBorderSvg(),

      left:
        position.left,

      top:
        position.top,
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
    .composite(
      composites
    )
    .jpeg({
      quality: 98,
      chromaSubsampling:
        "4:4:4",
    })
    .toBuffer();
}

/* =====================================================
   CHUNK
   ===================================================== */

function chunk(
  array,
  size
) {
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
   MAIN
   ===================================================== */

async function main() {
  console.log("");

  console.log(
    "GARAGE88 — IG STORY BLACK V6"
  );

  console.log(
    "6 CARDS / PAGE"
  );

  console.log(
    "FULL IG COVER — NO CROP"
  );

  console.log(
    "ORDER: LISTING TERBARU"
  );

  console.log(
    "CREATED_AT DESC"
  );

  console.log(
    "================================"
  );

  const cars =
    await getCars();

  if (!cars.length) {
    throw new Error(
      "Tidak ditemukan unit READY dengan ig_image_url."
    );
  }

  /*
   * cars sudah:
   *
   * TERBARU
   * ↓
   * TERLAMA
   */

  const pages =
    chunk(
      cars,
      CARS_PER_PAGE
    );

  const outputFolder =
    path.resolve(
      `exports/ready-stock-story-6cards-black-v6-${timestamp()}`
    );

  await mkdir(
    outputFolder,
    {
      recursive: true,
    }
  );

  console.log("");

  console.log(
    `READY dengan IG cover : ${cars.length}`
  );

  console.log(
    `Total Story          : ${pages.length}`
  );

  console.log("");

  console.log(
    "6 UNIT TERBARU:"
  );

  for (
    let i = 0;
    i <
    Math.min(
      6,
      cars.length
    );
    i++
  ) {
    console.log(
      `${i + 1}. ` +
      `${carName(cars[i])} ` +
      `— ${cars[i].branch} ` +
      `— ${formatDate(cars[i].created_at)}`
    );
  }

  /* =====================================================
     MANIFEST
     ===================================================== */

  const manifest = [[
    "PAGE",
    "CARD_POSITION",
    "CAR_ID",
    "CAR",
    "YEAR",
    "CABANG",
    "OTR_CREDIT",
    "CASH",
    "DP",
    "KM",
    "KM_STATUS",
    "CREATED_AT",
    "IG_IMAGE_URL",
    "FILE",
    "HASIL",
  ]];

  /* =====================================================
     GENERATE STORY
     ===================================================== */

  for (
    let pageIndex = 0;
    pageIndex <
    pages.length;
    pageIndex++
  ) {
    const pageCars =
      pages[pageIndex];

    const pageNumber =
      pageIndex + 1;

    console.log("");

    console.log(
      `Story ${pageNumber}/${pages.length}`
    );

    const firstCar =
      pageCars[0];

    const lastCar =
      pageCars[
        pageCars.length - 1
      ];

    const filename =
      `${pad(
        pageNumber,
        3
      )}__NEWEST__` +
      `${safeFilename(
        carName(firstCar)
      ).slice(0, 35)}__TO__` +
      `${safeFilename(
        carName(lastCar)
      ).slice(0, 35)}__` +
      `${pageCars.length}CARDS.jpg`;

    try {
      const image =
        await makePage(
          pageCars,
          pageNumber,
          pages.length
        );

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
        pageCars.length;
        cardIndex++
      ) {
        const car =
          pageCars[cardIndex];

        manifest.push([
          pageNumber,
          cardIndex + 1,
          car.id,
          carName(car),
          car.year ?? "",
          car.branch ?? "",
          car.credit_price ?? "",
          car.cash_price ?? "",
          car.dp ?? "",
          car.odometer ?? "",
          getKmStatus(car),
          car.created_at ?? "",
          car.ig_image_url ?? "",
          filename,
          "BERHASIL",
        ]);
      }

      console.log(
        `✅ ${filename}`
      );

      console.log(
        `   ${carName(
          firstCar
        )}`
      );

      console.log(
        "   ↓"
      );

      console.log(
        `   ${carName(
          lastCar
        )}`
      );
    } catch (error) {
      console.error(
        `❌ Page ${pageNumber}: ${error.message}`
      );

      for (
        let cardIndex = 0;
        cardIndex <
        pageCars.length;
        cardIndex++
      ) {
        const car =
          pageCars[cardIndex];

        manifest.push([
          pageNumber,
          cardIndex + 1,
          car.id,
          carName(car),
          car.year ?? "",
          car.branch ?? "",
          car.credit_price ?? "",
          car.cash_price ?? "",
          car.dp ?? "",
          car.odometer ?? "",
          getKmStatus(car),
          car.created_at ?? "",
          car.ig_image_url ?? "",
          "",
          `GAGAL: ${error.message}`,
        ]);
      }
    }
  }

  /* =====================================================
     SAVE MANIFEST
     ===================================================== */

  const csv =
    manifest
      .map(
        (row) =>
          row
            .map(csvValue)
            .join(",")
      )
      .join("\r\n");

  await writeFile(
    path.join(
      outputFolder,
      "manifest.csv"
    ),
    "\uFEFF" + csv,
    "utf8"
  );

  /* =====================================================
     DONE
     ===================================================== */

  console.log("");

  console.log(
    "================================"
  );

  console.log(
    "SELESAI"
  );

  console.log(
    `✅ Unit  : ${cars.length}`
  );

  console.log(
    `✅ Story : ${pages.length}`
  );

  console.log("");

  console.log(
    `📁 ${outputFolder}`
  );

  /*
   * Mac:
   * otomatis buka Finder.
   */

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

    console.error(
      error
    );

    process.exit(1);
  }
);
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

const CARS_PER_PAGE = 8;

const PHONE = "081385226049";
const INSTAGRAM = "@garage88jakarta";

const HEADER_IMAGE_PATH =
  path.resolve(
    "public/assets/story-header.png"
  );

/*
 * Header dinaikkan jadi 285px
 * dan tidak di-crop.
 */
const HEADER_HEIGHT = 285;

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

function escapeXml(value) {
  return cleanText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
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

function formatPlainJT(value) {
  const number = Number(value);

  if (
    !Number.isFinite(number) ||
    number <= 0
  ) {
    return "-";
  }

  return `${Math.round(
    number / 1_000_000
  )}`;
}

function formatKM(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "-";
  }

  return number.toLocaleString("id-ID");
}

function carName(car) {
  return cleanText(
    [
      car.brand,
      car.model,
      car.variant,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function normalizeTransmission(value) {
  const text =
    cleanText(value)
      .toUpperCase();

  if (!text) {
    return "";
  }

  if (text.includes("CVT")) {
    return "CVT";
  }

  if (text.includes("IVT")) {
    return "IVT";
  }

  if (text.includes("DCT")) {
    return "DCT";
  }

  if (text.includes("AT")) {
    return "AT";
  }

  if (text.includes("MT")) {
    return "MT";
  }

  return text;
}

/* =====================================================
   TEXT WRAP
   ===================================================== */

function wrapText(
  text,
  maxChars = 19
) {
  const words =
    cleanText(text)
      .split(" ");

  const lines = [];

  let current = "";

  for (const word of words) {
    const next =
      current
        ? `${current} ${word}`
        : word;

    if (
      next.length >
      maxChars
    ) {
      if (current) {
        lines.push(current);
      }

      current = word;
    } else {
      current = next;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.slice(0, 2);
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
      transmission,
      odometer,
      credit_price,
      cash_price,
      dp,
      status,
      created_at,
      cover_source_image_url
    `)
    .eq(
      "status",
      "READY"
    );

  if (error) {
    throw new Error(
      `Supabase error: ${error.message}`
    );
  }

  const cars =
    (data ?? [])
      .map((car) => ({
        ...car,

        photoroom_url:
          String(
            car.cover_source_image_url ??
              ""
          ).trim(),
      }))
      .filter((car) => {
        const credit =
          Number(
            car.credit_price
          );

        return (
          car.photoroom_url &&
          Number.isFinite(credit) &&
          credit > 0
        );
      });

  /*
   * SORT:
   * 1. OTR Kredit termurah
   * 2. Tahun terbaru
   * 3. KM terendah
   */

  cars.sort((a, b) => {
    const priceA =
      Number(a.credit_price);

    const priceB =
      Number(b.credit_price);

    if (
      priceA !== priceB
    ) {
      return priceA - priceB;
    }

    const yearA =
      Number(a.year ?? 0);

    const yearB =
      Number(b.year ?? 0);

    if (
      yearA !== yearB
    ) {
      return yearB - yearA;
    }

    const kmA =
      Number.isFinite(
        Number(a.odometer)
      )
        ? Number(a.odometer)
        : Number.MAX_SAFE_INTEGER;

    const kmB =
      Number.isFinite(
        Number(b.odometer)
      )
        ? Number(b.odometer)
        : Number.MAX_SAFE_INTEGER;

    return kmA - kmB;
  });

  return cars;
}

/* =====================================================
   PHOTOROOM CROP
   ===================================================== */

async function downloadPhotoRoom(url) {
  const response =
    await fetch(
      url,
      {
        cache: "no-store",
      }
    );

  if (!response.ok) {
    throw new Error(
      `Image HTTP ${response.status}`
    );
  }

  const bytes =
    Buffer.from(
      await response.arrayBuffer()
    );

  const metadata =
    await sharp(bytes)
      .metadata();

  const sourceWidth =
    metadata.width ?? 1080;

  const sourceHeight =
    metadata.height ?? 1350;

  /*
   * Crop landscape
   * supaya mobil lebih besar
   * dan ruang atas/bawah berkurang.
   */

  const cropWidth =
    sourceWidth;

  const cropHeight =
    Math.min(
      sourceHeight,
      Math.round(
        sourceWidth * 0.72
      )
    );

  const idealTop =
    Math.round(
      sourceHeight * 0.22
    );

  const maxTop =
    Math.max(
      0,
      sourceHeight -
        cropHeight
    );

  const cropTop =
    Math.min(
      idealTop,
      maxTop
    );

  return await sharp(bytes)
    .extract({
      left: 0,
      top: cropTop,
      width: cropWidth,
      height: cropHeight,
    })
    .resize(
      250,
      175,
      {
        fit: "cover",
        position: "centre",
      }
    )
    .flatten({
      background: "#ffffff",
    })
    .jpeg({
      quality: 95,
      chromaSubsampling:
        "4:4:4",
    })
    .toBuffer();
}

/* =====================================================
   STATIC HEADER IMAGE
   ===================================================== */

async function buildHeaderBuffer() {
  return await sharp(
    HEADER_IMAGE_PATH
  )
    .resize(
      WIDTH,
      HEADER_HEIGHT,
      {
        /*
         * IMPORTANT:
         * contain = header utuh,
         * tidak ada bagian yang terpotong.
         */
        fit: "contain",
        position: "center",
        background: "#000000",
      }
    )
    .jpeg({
      quality: 96,
      chromaSubsampling:
        "4:4:4",
    })
    .toBuffer();
}

/* =====================================================
   CARD SVG
   ===================================================== */

function makeCardSvg(
  car,
  x,
  y,
  width,
  height,
  index
) {
  const titleLines =
    wrapText(
      carName(car),
      19
    );

  const title1 =
    escapeXml(
      titleLines[0] ??
        ""
    );

  const title2 =
    escapeXml(
      titleLines[1] ??
        ""
    );

  const year =
    escapeXml(
      car.year ??
        ""
    );

  const km =
    escapeXml(
      formatKM(
        car.odometer
      )
    );

  const credit =
    escapeXml(
      formatJT(
        car.credit_price
      )
    );

  const cash =
    escapeXml(
      formatJT(
        car.cash_price
      )
    );

  const dp =
    escapeXml(
      formatJT(
        car.dp
      )
    );

  const transmission =
    escapeXml(
      normalizeTransmission(
        car.transmission
      )
    );

  return `
    <rect
      x="${x}"
      y="${y}"
      width="${width}"
      height="${height}"
      rx="24"
      fill="#ffffff"
      stroke="#d9dde2"
      stroke-width="2"
    />

    <!-- NUMBER -->

    <rect
      x="${x + 14}"
      y="${y + 14}"
      width="48"
      height="48"
      rx="10"
      fill="#0b0b0b"
    />

    <text
      x="${x + 38}"
      y="${y + 47}"
      text-anchor="middle"
      font-family="Arial"
      font-size="24"
      font-weight="900"
      fill="#ffcc00"
    >
      ${index}
    </text>

    <!-- NAME -->

    <text
      x="${x + 76}"
      y="${y + 38}"
      font-family="Arial"
      font-size="25"
      font-weight="900"
      fill="#111111"
    >
      ${title1}
    </text>

    ${
      title2
        ? `
          <text
            x="${x + 76}"
            y="${y + 64}"
            font-family="Arial"
            font-size="21"
            font-weight="900"
            fill="#111111"
          >
            ${title2}
          </text>
        `
        : ""
    }

    <!-- YEAR -->

    <rect
      x="${x + width - 98}"
      y="${y + 13}"
      width="80"
      height="40"
      rx="11"
      fill="#ffcc00"
    />

    <text
      x="${x + width - 58}"
      y="${y + 41}"
      text-anchor="middle"
      font-family="Arial"
      font-size="19"
      font-weight="900"
      fill="#111111"
    >
      ${year}
    </text>

    <!-- OTR -->

    <rect
      x="${x + 290}"
      y="${y + 84}"
      width="${width - 308}"
      height="61"
      rx="14"
      fill="#ffcc00"
    />

    <text
      x="${x + 305}"
      y="${y + 104}"
      font-family="Arial"
      font-size="12"
      font-weight="900"
      fill="#111111"
    >
      OTR / KREDIT
    </text>

    <text
      x="${x + 305}"
      y="${y + 134}"
      font-family="Arial"
      font-size="29"
      font-weight="900"
      fill="#111111"
    >
      ${credit}
    </text>

    <!-- CASH -->

    <rect
      x="${x + 290}"
      y="${y + 153}"
      width="${width - 308}"
      height="58"
      rx="14"
      fill="#eef0f2"
    />

    <text
      x="${x + 305}"
      y="${y + 173}"
      font-family="Arial"
      font-size="12"
      font-weight="800"
      fill="#555d66"
    >
      CASH
    </text>

    <text
      x="${x + 305}"
      y="${y + 201}"
      font-family="Arial"
      font-size="25"
      font-weight="900"
      fill="#111111"
    >
      ${cash}
    </text>

    <!-- DP -->

    <rect
      x="${x + 290}"
      y="${y + 219}"
      width="${width - 308}"
      height="58"
      rx="14"
      fill="#0b0b0b"
    />

    <text
      x="${x + 305}"
      y="${y + 239}"
      font-family="Arial"
      font-size="12"
      font-weight="800"
      fill="#ffffff"
    >
      DP MULAI
    </text>

    <text
      x="${x + 305}"
      y="${y + 267}"
      font-family="Arial"
      font-size="25"
      font-weight="900"
      fill="#ffcc00"
    >
      ${dp}
    </text>

    <!-- KM -->

    <text
      x="${x + 18}"
      y="${y + height - 18}"
      font-family="Arial"
      font-size="14"
      font-weight="800"
      fill="#646b73"
    >
      KM
    </text>

    <text
      x="${x + 50}"
      y="${y + height - 18}"
      font-family="Arial"
      font-size="19"
      font-weight="900"
      fill="#111111"
    >
      ${km}
    </text>

    <!-- TRANSMISSION -->

    ${
      transmission
        ? `
          <text
            x="${x + 195}"
            y="${y + height - 18}"
            font-family="Arial"
            font-size="15"
            font-weight="900"
            fill="#111111"
          >
            ${transmission}
          </text>
        `
        : ""
    }
  `;
}

/* =====================================================
   FOOTER
   ===================================================== */

function makeFooterSvg() {
  return `
    <rect
      x="0"
      y="1740"
      width="1080"
      height="180"
      fill="#080808"
    />

    <rect
      x="0"
      y="1740"
      width="1080"
      height="7"
      fill="#ffcc00"
    />

    <!-- LEFT YELLOW AREA -->

    <polygon
      points="0,1747 335,1747 290,1920 0,1920"
      fill="#ffcc00"
    />

    <text
      x="38"
      y="1790"
      font-family="Arial"
      font-size="15"
      font-weight="900"
      fill="#111111"
      letter-spacing="1"
    >
      FAST RESPONSE
    </text>

    <text
      x="38"
      y="1837"
      font-family="Arial"
      font-size="32"
      font-weight="900"
      fill="#111111"
    >
      ${PHONE}
    </text>

    <text
      x="38"
      y="1873"
      font-family="Arial"
      font-size="14"
      font-weight="900"
      fill="#111111"
    >
      PILIH UNIT • CHAT SEKARANG
    </text>

    <!-- CENTER -->

    <text
      x="545"
      y="1790"
      text-anchor="middle"
      font-family="Arial"
      font-size="15"
      font-weight="900"
      fill="#ffcc00"
      letter-spacing="2"
    >
      READY STOCK GARAGE88
    </text>

    <text
      x="545"
      y="1827"
      text-anchor="middle"
      font-family="Arial"
      font-size="21"
      font-weight="900"
      fill="#ffffff"
    >
      CASH • CREDIT • TRADE IN
    </text>

    <!-- IG -->

    <text
      x="1035"
      y="1790"
      text-anchor="end"
      font-family="Arial"
      font-size="15"
      font-weight="900"
      fill="#ffcc00"
      letter-spacing="1"
    >
      INSTAGRAM
    </text>

    <text
      x="1035"
      y="1837"
      text-anchor="end"
      font-family="Arial"
      font-size="31"
      font-weight="900"
      fill="#ffffff"
    >
      ${INSTAGRAM}
    </text>

    <text
      x="675"
      y="1890"
      text-anchor="middle"
      font-family="Arial"
      font-size="14"
      font-weight="800"
      letter-spacing="4"
      fill="#8b929a"
    >
      TRUSTED • QUALITY • READY STOCK • BEST DEAL
    </text>
  `;
}

/* =====================================================
   PAGE
   ===================================================== */

async function makePage(
  cars,
  pageNumber,
  totalPages,
  headerBuffer
) {
  /*
   * Header sekarang lebih tinggi,
   * jadi card dipadatkan.
   */

  const cardWidth =
    500;

  const cardHeight =
    315;

  const leftX =
    25;

  const rightX =
    555;

  const startY =
    305;

  const gapY =
    18;

  let cardsSvg =
    "";

  const composites =
    [];

  for (
    let i = 0;
    i < cars.length;
    i++
  ) {
    const car =
      cars[i];

    const column =
      i % 2;

    const row =
      Math.floor(
        i / 2
      );

    const x =
      column === 0
        ? leftX
        : rightX;

    const y =
      startY +
      row *
        (
          cardHeight +
          gapY
        );

    cardsSvg +=
      makeCardSvg(
        car,
        x,
        y,
        cardWidth,
        cardHeight,
        i + 1
      );

    try {
      const image =
        await downloadPhotoRoom(
          car.photoroom_url
        );

      composites.push({
        input: image,
        left:
          x + 20,
        top:
          y + 92,
      });

    } catch (error) {
      console.log(
        `⚠️ Gagal foto: ${carName(
          car
        )}`
      );
    }
  }

  const svg = `
  <svg
    width="${WIDTH}"
    height="${HEIGHT}"
    xmlns="http://www.w3.org/2000/svg"
  >

    <!-- BACKGROUND -->

    <rect
      width="${WIDTH}"
      height="${HEIGHT}"
      fill="#f5f6f7"
    />

    <!-- CARDS -->

    ${cardsSvg}

    <!-- FOOTER -->

    ${makeFooterSvg()}

  </svg>
  `;

  return await sharp(
    Buffer.from(svg)
  )
    .composite([
      /*
       * Header statis di atas.
       */
      {
        input: headerBuffer,
        left: 0,
        top: 0,
      },

      /*
       * Foto mobil.
       */
      ...composites,
    ])
    .jpeg({
      quality: 95,
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
  const result =
    [];

  for (
    let i = 0;
    i < array.length;
    i += size
  ) {
    result.push(
      array.slice(
        i,
        i + size
      )
    );
  }

  return result;
}

/* =====================================================
   CSV MANIFEST
   ===================================================== */

function csvValue(
  value
) {
  return `"${String(
    value ?? ""
  ).replaceAll(
    '"',
    '""'
  )}"`;
}

/* =====================================================
   MAIN
   ===================================================== */

async function main() {
  console.log("");

  console.log(
    "GARAGE88 STORY CATALOG"
  );

  console.log(
    "STATIC HEADER 285PX"
  );

  console.log(
    "SUPABASE + PHOTOROOM"
  );

  console.log(
    "SORT BY OTR CREDIT"
  );

  console.log(
    "================================"
  );

  /*
   * Load header sekali saja.
   */
  const headerBuffer =
    await buildHeaderBuffer();

  console.log(
    `✅ Header: ${HEADER_IMAGE_PATH}`
  );

  const cars =
    await getCars();

  console.log("");

  console.log(
    `READY dengan PhotoRoom: ${cars.length}`
  );

  if (!cars.length) {
    throw new Error(
      "Tidak ditemukan unit READY dengan cover_source_image_url."
    );
  }

  const pages =
    chunk(
      cars,
      CARS_PER_PAGE
    );

  console.log(
    `Total halaman: ${pages.length}`
  );

  const outputFolder =
    path.resolve(
      `exports/ready-stock-story-static-header-${timestamp()}`
    );

  await mkdir(
    outputFolder,
    {
      recursive: true,
    }
  );

  const manifest =
    [[
      "PAGE",
      "ORDER",
      "CAR_ID",
      "CAR",
      "YEAR",
      "KM",
      "OTR_CREDIT",
      "CASH",
      "DP",
      "PHOTOROOM_URL",
    ]];

  for (
    let pageIndex = 0;
    pageIndex <
    pages.length;
    pageIndex++
  ) {
    const pageCars =
      pages[
        pageIndex
      ];

    const pageNumber =
      pageIndex + 1;

    console.log("");

    console.log(
      `Page ${pageNumber}/${pages.length}`
    );

    const image =
      await makePage(
        pageCars,
        pageNumber,
        pages.length,
        headerBuffer
      );

    const firstPrice =
      formatPlainJT(
        pageCars[0]
          .credit_price
      );

    const lastPrice =
      formatPlainJT(
        pageCars[
          pageCars.length -
            1
        ]
          .credit_price
      );

    const filename =
      `${pad(
        pageNumber,
        3
      )}__OTR_${firstPrice}-${lastPrice}JT.jpg`;

    await writeFile(
      path.join(
        outputFolder,
        filename
      ),
      image
    );

    for (
      let i = 0;
      i <
      pageCars.length;
      i++
    ) {
      const car =
        pageCars[i];

      manifest.push([
        pageNumber,
        i + 1,
        car.id,
        carName(car),
        car.year ?? "",
        car.odometer ?? "",
        car.credit_price ?? "",
        car.cash_price ?? "",
        car.dp ?? "",
        car.photoroom_url ?? "",
      ]);
    }

    console.log(
      `✅ ${filename}`
    );
  }

  const csv =
    manifest
      .map(
        (row) =>
          row
            .map(
              csvValue
            )
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
    `✅ Unit: ${cars.length}`
  );

  console.log(
    `✅ Halaman: ${pages.length}`
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

    console.error(
      error
    );

    process.exit(1);
  }
);
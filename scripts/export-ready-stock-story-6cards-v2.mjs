import { createClient } from "@supabase/supabase-js";
import { loadEnvFile } from "node:process";
import { mkdir, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import sharp from "sharp";

/* ================= ENV ================= */

for (const file of [".env", ".dev.vars"]) {
  try {
    loadEnvFile(file);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.PUBLIC_SUPABASE_URL;

const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error(
    "SUPABASE_URL / SUPABASE_SERVICE_KEY belum tersedia."
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

/* ================= CONFIG ================= */

const WIDTH = 1080;
const HEIGHT = 1920;
const CARS_PER_PAGE = 6;

const PHONE = "081385226049";
const INSTAGRAM = "@garage88jakarta";

const HEADER_IMAGE_PATH = path.resolve(
  "public/assets/story-header2.png"
);

let HEADER_HEIGHT = 0;

const PAGE_BG = "#f3f5f6";

const CARD_WIDTH = 500;
const CARD_HEIGHT = 450;

const LEFT_X = 25;
const RIGHT_X = 555;

const GAP_Y = 18;
const HEADER_CARD_GAP = 15;

const FOOTER_HEIGHT = 135;
const FOOTER_Y = HEIGHT - FOOTER_HEIGHT;

/* ================= HELPERS ================= */

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

function numberOrNull(value) {
  if (
    value == null ||
    cleanText(value) === ""
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function formatJT(value) {
  const number =
    numberOrNull(value);

  return number != null &&
    number > 0
    ? `${Math.round(
        number / 1_000_000
      )}JT`
    : "-";
}

function formatKMShort(value) {
  const number =
    numberOrNull(value);

  if (
    number == null ||
    number < 0
  ) {
    return "-";
  }

  if (number >= 1000) {
    return (
      String(
        Math.round(
          number / 100
        ) / 10
      ).replace(".", ",") +
      " rb KM"
    );
  }

  return `${Math.round(
    number
  )} KM`;
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

function normalizeTransmission(
  value
) {
  const text =
    cleanText(value).toUpperCase();

  if (!text) return "-";

  if (text.includes("CVT"))
    return "CVT";

  if (text.includes("IVT"))
    return "IVT";

  if (text.includes("DCT"))
    return "DCT";

  if (
    text.includes("AUTOMATIC") ||
    text.includes("AT")
  ) {
    return "AT";
  }

  if (
    text.includes("MANUAL") ||
    text.includes("MT")
  ) {
    return "MT";
  }

  return text;
}

function getKmStatus(car) {
  const odometer =
    numberOrNull(car.odometer);

  const year =
    numberOrNull(car.year);

  const currentYear =
    new Date().getFullYear();

  if (
    odometer == null ||
    odometer < 0 ||
    year == null ||
    year < 1900 ||
    year > currentYear
  ) {
    return "";
  }

  const average =
    odometer /
    Math.max(
      1,
      currentYear - year
    );

  if (average < 10000) {
    return odometer < 100000
      ? "LOW KM"
      : "LOW USAGE KM";
  }

  return "";
}

function wrapText(
  text,
  maxChars = 25
) {
  const words =
    cleanText(text).split(" ");

  let first = "";

  while (words.length) {
    const next =
      first
        ? `${first} ${words[0]}`
        : words[0];

    if (
      first &&
      next.length > maxChars
    ) {
      break;
    }

    first = next;
    words.shift();
  }

  let second =
    words.join(" ");

  if (second.length > 34) {
    second =
      second
        .slice(0, 33)
        .trimEnd() +
      "…";
  }

  return [
    first,
    second,
  ];
}

function csvCell(value) {
  return `"${String(
    value ?? ""
  ).replaceAll(
    '"',
    '""'
  )}"`;
}

function chunk(
  array,
  size
) {
  const result = [];

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

function getStartY() {
  return (
    HEADER_HEIGHT +
    HEADER_CARD_GAP
  );
}

function formatDateTime(
  value
) {
  if (!value) return "";

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date
    .toLocaleString(
      "id-ID",
      {
        timeZone:
          "Asia/Jakarta",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    );
}

/* =====================================================
   DATABASE

   PENTING:
   created_at DESC

   LISTING TERBARU
   ↓
   LISTING TERLAMA
   ===================================================== */

async function getCars() {
  const all = [];

  const pageSize = 500;

  for (
    let start = 0;
    ;
    start += pageSize
  ) {
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
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        )
        .range(
          start,
          start +
            pageSize -
            1
        );

    if (error) {
      throw new Error(
        `Supabase error: ${error.message}`
      );
    }

    const batch =
      data ?? [];

    all.push(
      ...batch
    );

    if (
      batch.length <
      pageSize
    ) {
      break;
    }
  }

  const eligible = [];

  for (const car of all) {
    const url =
      cleanText(
        car.cover_source_image_url
      );

    if (
      !(
        numberOrNull(
          car.credit_price
        ) > 0
      )
    ) {
      console.log(
        `⚠️ OTR kosong: ${carName(
          car
        )}`
      );

      continue;
    }

    try {
      const parsed =
        new URL(url);

      if (
        ![
          "http:",
          "https:",
        ].includes(
          parsed.protocol
        )
      ) {
        throw new Error(
          "Invalid URL"
        );
      }

      eligible.push({
        ...car,
        photoroom_url:
          url,
      });
    } catch {
      console.log(
        `⚠️ Foto kosong/tidak valid: ${carName(
          car
        )}`
      );
    }
  }

  /*
   * SAFETY SORT
   *
   * Supabase sudah DESC,
   * tapi kita sort lagi
   * untuk memastikan.
   */

  eligible.sort(
    (a, b) => {
      const timeA =
        new Date(
          a.created_at ?? 0
        ).getTime();

      const timeB =
        new Date(
          b.created_at ?? 0
        ).getTime();

      if (
        timeA !== timeB
      ) {
        return (
          timeB -
          timeA
        );
      }

      /*
       * Jika created_at
       * kebetulan sama,
       * pakai ID sebagai
       * tie breaker.
       */

      return String(
        b.id
      ).localeCompare(
        String(a.id)
      );
    }
  );

  return eligible;
}

/* ================= HEADER ================= */

async function buildHeaderBuffer() {
  const metadata =
    await sharp(
      HEADER_IMAGE_PATH
    ).metadata();

  if (
    !metadata.width ||
    !metadata.height
  ) {
    throw new Error(
      "Ukuran story-header2.png tidak terbaca."
    );
  }

  const naturalHeight =
    Math.round(
      metadata.height *
        WIDTH /
        metadata.width
    );

  const maxHeaderHeight =
    Math.floor(
      FOOTER_Y -
        HEADER_CARD_GAP -
        CARD_HEIGHT * 3 -
        GAP_Y * 2 -
        5
    );

  if (
    maxHeaderHeight <= 0
  ) {
    throw new Error(
      "Tidak ada ruang untuk header."
    );
  }

  HEADER_HEIGHT =
    Math.min(
      naturalHeight,
      maxHeaderHeight
    );

  console.log(
    `Header render: ${WIDTH} × ${HEADER_HEIGHT}px`
  );

  return await sharp(
    HEADER_IMAGE_PATH
  )
    .resize(
      WIDTH,
      HEADER_HEIGHT,
      {
        fit: "contain",
        position:
          "centre",
        background:
          PAGE_BG,
      }
    )
    .flatten({
      background:
        PAGE_BG,
    })
    .jpeg({
      quality: 98,
      chromaSubsampling:
        "4:4:4",
    })
    .toBuffer();
}

/* ================= PHOTO CROP ================= */

async function downloadPhotoRoom(
  url
) {
  let lastError;

  for (
    let attempt = 1;
    attempt <= 3;
    attempt++
  ) {
    try {
      const response =
        await fetch(
          url,
          {
            cache:
              "no-store",

            signal:
              AbortSignal.timeout(
                60000
              ),
          }
        );

      if (
        !response.ok
      ) {
        await response
          .body
          ?.cancel();

        throw new Error(
          `Image HTTP ${response.status}`
        );
      }

      const bytes =
        Buffer.from(
          await response.arrayBuffer()
        );

      const metadata =
        await sharp(
          bytes
        ).metadata();

      if (
        !metadata.width ||
        !metadata.height
      ) {
        throw new Error(
          "Dimensi foto tidak terbaca."
        );
      }

      const cropHeight =
        Math.min(
          metadata.height,
          Math.round(
            metadata.width *
              0.69
          )
        );

      const cropTop =
        Math.min(
          Math.round(
            metadata.height *
              0.235
          ),
          metadata.height -
            cropHeight
        );

      return await sharp(
        bytes
      )
        .extract({
          left: 0,
          top: cropTop,
          width:
            metadata.width,
          height:
            cropHeight,
        })
        .resize(
          310,
          215,
          {
            fit: "cover",
            position:
              "centre",
          }
        )
        .flatten({
          background:
            "#ffffff",
        })
        .jpeg({
          quality: 96,
          chromaSubsampling:
            "4:4:4",
        })
        .toBuffer();
    } catch (error) {
      lastError =
        error;

      if (
        attempt < 3
      ) {
        console.log(
          `   Ulang foto ${attempt}/3`
        );
      }
    }
  }

  throw lastError;
}

/* ================= SVG HELPERS ================= */

function rect(
  x,
  y,
  width,
  height,
  fill,
  radius = 0
) {
  return `
    <rect
      x="${x}"
      y="${y}"
      width="${width}"
      height="${height}"
      rx="${radius}"
      fill="${fill}"
    />
  `;
}

function text(
  x,
  y,
  value,
  size,
  color,
  weight = 900,
  anchor = "start"
) {
  return `
    <text
      x="${x}"
      y="${y}"
      font-family="Arial"
      font-size="${size}"
      font-weight="${weight}"
      text-anchor="${anchor}"
      fill="${color}"
    >
      ${escapeXml(
        value
      )}
    </text>
  `;
}

/* ================= KM BADGE ================= */

function makeKmBadge(
  car,
  x,
  y
) {
  const status =
    getKmStatus(car);

  if (!status) {
    return "";
  }

  const low =
    status ===
    "LOW KM";

  const width =
    low ? 145 : 190;

  const height =
    low ? 38 : 42;

  const centerY =
    y +
    height / 2;

  return `
    <rect
      x="${x}"
      y="${y}"
      width="${width}"
      height="${height}"
      rx="${height / 2}"
      fill="#111111"
      stroke="#ffca00"
      stroke-width="2"
    />

    <circle
      cx="${x + 20}"
      cy="${centerY}"
      r="10"
      fill="#ffca00"
    />

    ${text(
      x + 20,
      centerY + 5,
      "★",
      12,
      "#111111",
      900,
      "middle"
    )}

    ${
      low
        ? text(
            x + 38,
            y + 25,
            "LOW KM",
            16,
            "#ffffff"
          )
        : text(
            x + 39,
            y + 18,
            "LOW USAGE KM",
            13,
            "#ffffff"
          ) +
          text(
            x + 39,
            y + 33,
            "under 10.000 KM / Tahun",
            8.5,
            "#ffca00",
            700
          )
    }
  `;
}

/* ================= CARD ================= */

function makeCardSvg(
  car,
  x,
  y
) {
  const [
    title1,
    title2,
  ] =
    wrapText(
      carName(car)
    );

  const cash =
    formatJT(
      car.cash_price
    );

  const titleSize =
    Math.min(
      27,
      365 /
        Math.max(
          1,
          title1.length *
            0.62
        )
    );

  return `
    <rect
      x="${x + 4}"
      y="${y + 5}"
      width="500"
      height="450"
      rx="25"
      fill="#000000"
      opacity="0.06"
    />

    <rect
      x="${x}"
      y="${y}"
      width="500"
      height="450"
      rx="25"
      fill="#ffffff"
      stroke="#d7dade"
      stroke-width="2"
    />

    ${text(
      x + 20,
      y + 39,
      title1,
      titleSize,
      "#111111"
    )}

    ${
      title2
        ? text(
            x + 20,
            y + 69,
            title2,
            22,
            "#111111"
          )
        : ""
    }

    ${rect(
      x + 405,
      y + 16,
      76,
      42,
      "#ffca00",
      10
    )}

    ${text(
      x + 443,
      y + 45,
      car.year,
      19,
      "#111111",
      900,
      "middle"
    )}

    ${makeKmBadge(
      car,
      x + 22,
      y + 82
    )}

    ${rect(
      x + 330,
      y + 120,
      148,
      112,
      "#ffca00",
      16
    )}

    ${text(
      x + 346,
      y + 147,
      "OTR / KREDIT",
      12,
      "#111111"
    )}

    ${text(
      x + 346,
      y + 190,
      formatJT(
        car.credit_price
      ),
      37,
      "#111111"
    )}

    ${
      cash !== "-"
        ? text(
            x + 346,
            y + 217,
            `Cash ${cash}`,
            14,
            "#202020",
            800
          )
        : ""
    }

    ${rect(
      x + 330,
      y + 244,
      148,
      92,
      "#111111",
      16
    )}

    ${text(
      x + 346,
      y + 271,
      "DP MULAI",
      12,
      "#ffffff"
    )}

    ${text(
      x + 346,
      y + 316,
      formatJT(
        car.dp
      ),
      32,
      "#ffca00"
    )}

    ${rect(
      x + 20,
      y + 381,
      218,
      49,
      "#111111",
      13
    )}

    <circle
      cx="${x + 46}"
      cy="${y + 406}"
      r="15"
      fill="#ffca00"
    />

    ${text(
      x + 46,
      y + 411,
      "KM",
      13,
      "#111111",
      900,
      "middle"
    )}

    ${text(
      x + 68,
      y + 412,
      formatKMShort(
        car.odometer
      ),
      19,
      "#ffffff"
    )}

    ${rect(
      x + 246,
      y + 381,
      232,
      49,
      "#111111",
      13
    )}

    ${text(
      x + 265,
      y + 400,
      "TRANSMISI",
      10,
      "#aeb4ba",
      700
    )}

    ${text(
      x + 265,
      y + 421,
      normalizeTransmission(
        car.transmission
      ),
      19,
      "#ffffff"
    )}
  `;
}

/* ================= FOOTER ================= */

function makeFooterSvg() {
  return `
    ${rect(
      0,
      FOOTER_Y,
      WIDTH,
      FOOTER_HEIGHT,
      "#0b0b0b"
    )}

    ${rect(
      0,
      FOOTER_Y,
      WIDTH,
      6,
      "#ffca00"
    )}

    <circle
      cx="55"
      cy="${FOOTER_Y + 70}"
      r="22"
      fill="#ffca00"
    />

    ${text(
      55,
      FOOTER_Y + 78,
      "☎",
      20,
      "#111111",
      900,
      "middle"
    )}

    ${text(
      88,
      FOOTER_Y + 74,
      PHONE,
      27,
      "#ffffff"
    )}

    <text
      x="540"
      y="${FOOTER_Y + 52}"
      text-anchor="middle"
      font-family="Arial"
      font-size="14"
      font-weight="800"
      fill="#ffca00"
      letter-spacing="2"
    >
      READY STOCK GARAGE88
    </text>

    ${text(
      540,
      FOOTER_Y + 86,
      "PILIH UNIT • CHAT SEKARANG",
      20,
      "#ffffff",
      900,
      "middle"
    )}

    ${text(
      1030,
      FOOTER_Y + 74,
      INSTAGRAM,
      27,
      "#ffffff",
      900,
      "end"
    )}

    <text
      x="540"
      y="${FOOTER_Y + 115}"
      text-anchor="middle"
      font-family="Arial"
      font-size="11"
      font-weight="700"
      fill="#858c93"
      letter-spacing="3"
    >
      CASH • CREDIT • TRADE IN
    </text>
  `;
}

/* ================= PAGE ================= */

async function makePage(
  items,
  headerBuffer
) {
  let cardsSvg = "";

  const composites = [
    {
      input:
        headerBuffer,
      left: 0,
      top: 0,
    },
  ];

  for (
    let i = 0;
    i < items.length;
    i++
  ) {
    const x =
      i % 2 === 0
        ? LEFT_X
        : RIGHT_X;

    const y =
      getStartY() +
      Math.floor(
        i / 2
      ) *
        (
          CARD_HEIGHT +
          GAP_Y
        );

    cardsSvg +=
      makeCardSvg(
        items[i].car,
        x,
        y
      );

    composites.push({
      input:
        items[i]
          .photoPath,

      left:
        x + 18,

      top:
        y + 130,
    });
  }

  const svg = `
    <svg
      width="${WIDTH}"
      height="${HEIGHT}"
      xmlns="http://www.w3.org/2000/svg"
    >
      ${rect(
        0,
        0,
        WIDTH,
        HEIGHT,
        PAGE_BG
      )}

      ${cardsSvg}

      ${makeFooterSvg()}
    </svg>
  `;

  return sharp(
    Buffer.from(svg)
  )
    .composite(
      composites
    )
    .jpeg({
      quality: 96,
      chromaSubsampling:
        "4:4:4",
    })
    .toBuffer();
}

/* ================= MAIN ================= */

async function main() {
  console.log("");

  console.log(
    "GARAGE88 STORY — HEADER + 6 CARDS"
  );

  console.log(
    "ORDER: LISTING TERBARU → TERLAMA"
  );

  console.log(
    "AUTO UPDATE DARI SUPABASE"
  );

  console.log(
    "================================"
  );

  /*
   * Header tetap sama.
   */

  const headerBuffer =
    await buildHeaderBuffer();

  /*
   * Tidak ada lagi:
   * - priority
   * - grouping cabang
   * - urut harga
   *
   * getCars() sudah mengembalikan:
   *
   * terbaru
   * ↓
   * terlama
   */

  const cars =
    await getCars();

  if (!cars.length) {
    throw new Error(
      "Tidak ada unit READY dengan foto dan OTR."
    );
  }

  console.log("");
  console.log(
    `READY eligible: ${cars.length}`
  );

  console.log("");
  console.log(
    "6 LISTING TERBARU:"
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
    const car =
      cars[i];

    console.log(
      `${i + 1}. ` +
        `${carName(car)} ${car.year} ` +
        `| ${car.branch} ` +
        `| ${formatDateTime(
          car.created_at
        )}`
    );
  }

  const stamp =
    new Date()
      .toISOString()
      .replace(
        /[:.]/g,
        "-"
      );

  const outputFolder =
    path.resolve(
      `exports/ready-stock-story-newest-first-${stamp}`
    );

  const cacheFolder =
    path.join(
      outputFolder,
      "_cache"
    );

  await mkdir(
    cacheFolder,
    {
      recursive: true,
    }
  );

  const prepared = [];
  const failures = [];

  /*
   * Foto disiapkan mengikuti
   * urutan created_at DESC.
   *
   * Kalau satu foto gagal,
   * unit dilewati dan unit berikutnya
   * naik mengisi slot.
   */

  for (
    let i = 0;
    i < cars.length;
    i++
  ) {
    const car =
      cars[i];

    console.log(
      `[${i + 1}/${cars.length}] ` +
        `${carName(car)} ${car.year} ` +
        `| ${car.branch}`
    );

    try {
      const photo =
        await downloadPhotoRoom(
          car.photoroom_url
        );

      const photoPath =
        path.join(
          cacheFolder,
          `${String(
            i + 1
          ).padStart(
            4,
            "0"
          )}__${car.id}.jpg`
        );

      await writeFile(
        photoPath,
        photo
      );

      prepared.push({
        car,
        photoPath,
      });
    } catch (error) {
      const message =
        `${car.id} | ` +
        `${carName(car)} | ` +
        `${error.message}`;

      failures.push(
        message
      );

      console.error(
        `⚠️ ${message}`
      );
    }
  }

  if (
    failures.length
  ) {
    await writeFile(
      path.join(
        outputFolder,
        "foto-gagal.txt"
      ),
      failures.join(
        "\n"
      ),
      "utf8"
    );
  }

  if (
    !prepared.length
  ) {
    throw new Error(
      "Semua foto gagal."
    );
  }

  /*
   * PREPARED masih urut:
   *
   * listing terbaru
   * ↓
   * listing terlama
   *
   * Baru setelah itu dipotong
   * per 6 unit.
   */

  const pages =
    chunk(
      prepared,
      CARS_PER_PAGE
    );

  const manifest = [[
    "GLOBAL_ORDER",
    "PAGE",
    "POSITION",
    "CAR_ID",
    "CAR",
    "YEAR",
    "BRANCH",
    "KM",
    "KM_STATUS",
    "OTR_CREDIT",
    "CASH",
    "DP",
    "TRANSMISSION",
    "CREATED_AT",
    "CREATED_AT_JAKARTA",
    "FILE",
  ]];

  let globalOrder = 0;

  for (
    let p = 0;
    p < pages.length;
    p++
  ) {
    const pageNumber =
      p + 1;

    const filename =
      `${String(
        pageNumber
      ).padStart(
        3,
        "0"
      )}__IG_STORY__NEWEST_FIRST.jpg`;

    const image =
      await makePage(
        pages[p],
        headerBuffer
      );

    await writeFile(
      path.join(
        outputFolder,
        filename
      ),
      image
    );

    pages[p].forEach(
      (
        { car },
        index
      ) => {
        globalOrder++;

        manifest.push([
          globalOrder,
          pageNumber,
          index + 1,
          car.id,
          carName(car),
          car.year,
          car.branch,
          car.odometer,
          getKmStatus(
            car
          ),
          car.credit_price,
          car.cash_price,
          car.dp,
          normalizeTransmission(
            car.transmission
          ),
          car.created_at,
          formatDateTime(
            car.created_at
          ),
          filename,
        ]);
      }
    );

    const firstCar =
      pages[p][0].car;

    const lastCar =
      pages[p][
        pages[p].length -
          1
      ].car;

    console.log("");

    console.log(
      `✅ ${filename}`
    );

    console.log(
      `   #${p * 6 + 1} ` +
        `${carName(
          firstCar
        )}`
    );

    console.log(
      "   ↓"
    );

    console.log(
      `   #${
        p * 6 +
        pages[p].length
      } ` +
        `${carName(
          lastCar
        )}`
    );
  }

  await writeFile(
    path.join(
      outputFolder,
      "manifest.csv"
    ),
    "\uFEFF" +
      manifest
        .map(
          (row) =>
            row
              .map(
                csvCell
              )
              .join(",")
        )
        .join("\r\n"),
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
    `Unit READY      : ${cars.length}`
  );

  console.log(
    `Unit tergenerate : ${prepared.length}`
  );

  console.log(
    `Foto gagal       : ${failures.length}`
  );

  console.log(
    `Total Story      : ${pages.length}`
  );

  console.log("");
  console.log(
    "URUTAN:"
  );

  console.log(
    "TERBARU → TERLAMA"
  );

  console.log("");

  console.log(
    `Folder: ${outputFolder}`
  );

  if (
    process.platform ===
    "darwin"
  ) {
    execFile(
      "open",
      [outputFolder],
      (error) => {
        if (error) {
          console.log(
            "Buka folder hasil secara manual."
          );
        }
      }
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
      error.message
    );

    process.exitCode = 1;
  }
);
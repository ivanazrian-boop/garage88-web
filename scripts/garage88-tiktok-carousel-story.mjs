import { createClient } from "@supabase/supabase-js";
import { loadEnvFile } from "node:process";
import { mkdir, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import sharp from "sharp";


// ============================================================
// CONFIG
// ============================================================

const MAX_PER_CATEGORY = 20;
const DOWNLOAD_CONCURRENCY = 6;

const STORY_WIDTH = 1080;
const STORY_HEIGHT = 1920;

const PHOTO_WIDTH = 1080;
const PHOTO_HEIGHT = 1350;

const PAD_TOP = 285;
const PAD_BOTTOM = 285;

const ROOT_OUTPUT_DIR = path.resolve(
  process.cwd(),
  "exports"
);


// ============================================================
// CATEGORY
// ============================================================

const CATEGORIES = [

  {
    key: "01_BELOW_150JT",
    title: "MOBIL DI BAWAH 150 JT",

    match: function (car) {
      const price = priceJT(car.credit_price);

      return price > 0 && price < 150;
    }
  },


  {
    key: "02_150_200JT",
    title: "MOBIL 150 - 200 JT",

    match: function (car) {
      const price = priceJT(car.credit_price);

      return price >= 150 && price <= 200;
    }
  },


  {
    key: "03_200_250JT",
    title: "MOBIL 200 - 250 JT",

    match: function (car) {
      const price = priceJT(car.credit_price);

      return price > 200 && price <= 250;
    }
  },


  {
    key: "04_250_350JT",
    title: "MOBIL 250 - 350 JT",

    match: function (car) {
      const price = priceJT(car.credit_price);

      return price > 250 && price <= 350;
    }
  },


  {
    key: "05_350JT_PLUS",
    title: "MOBIL 350 JT+",

    match: function (car) {
      const price = priceJT(car.credit_price);

      return price > 350;
    }
  },


  {
    key: "06_SUV_CROSSOVER",
    title: "SUV & CROSSOVER",

    match: function (car) {
      return isSUV(car);
    }
  },


  {
    key: "07_MPV_KELUARGA",
    title: "MPV & MOBIL KELUARGA",

    match: function (car) {
      return isMPV(car);
    }
  },


  {
    key: "08_LOW_KM",
    title: "LOW KM",

    match: function (car) {
      return isLowKM(car);
    }
  },


  {
    key: "09_BEST_BUY_BELOW_250JT",
    title: "BEST BUY DI BAWAH 250 JT",

    match: function (car) {
      const price = priceJT(car.credit_price);

      return price > 0 && price < 250;
    }
  }

];


// ============================================================
// MODEL CLASSIFICATION
// ============================================================

const SUV_MODELS = [

  "crv",
  "cr-v",
  "hrv",
  "hr-v",
  "wr-v",

  "fortuner",

  "pajero",

  "x-trail",
  "xtrail",

  "terra",

  "creta",

  "santa fe",

  "kona",

  "chr",
  "c-hr",

  "outlander",

  "evoque",
  "range rover",

  "tiguan",

  "cx-5",
  "cx5",

  "cx-3",
  "cx3",

  "rush",

  "br-v",
  "brv",

  "s-cross",
  "scross",

  "corolla cross",
  "yaris cross",

  "raize",
  "rocky",

  "terios",

  "jimny",

  "palisade",

  "ioniq 5",
  "ioniq5"

];


const MPV_MODELS = [

  "alphard",
  "vellfire",

  "voxy",

  "innova",
  "zenix",

  "veloz",

  "avanza",

  "sienta",

  "serena",

  "elgrand",

  "freed",

  "xpander",

  "stargazer",

  "cortez",

  "biante",

  "nav1",
  "nav 1",

  "mobilio",

  "ertiga",

  "carens",

  "livina",
  "grand livina",

  "calya",
  "sigra",

  "apv",

  "hiace",

  "luxio"

];


// ============================================================
// ENVIRONMENT
// ============================================================

try {
  loadEnvFile(".env");
} catch (error) {
  // .env optional
}


try {
  loadEnvFile(".dev.vars");
} catch (error) {
  // .dev.vars optional
}


const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.PUBLIC_SUPABASE_URL;


const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;


if (!SUPABASE_URL) {

  console.error(
    "SUPABASE_URL atau PUBLIC_SUPABASE_URL tidak ditemukan."
  );

  process.exit(1);
}


if (!SUPABASE_SERVICE_KEY) {

  console.error(
    "SUPABASE_SERVICE_KEY tidak ditemukan."
  );

  process.exit(1);
}


const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);


// ============================================================
// BASIC HELPERS
// ============================================================

function cleanText(value) {

  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }


  return String(value)
    .replace(/\s+/g, " ")
    .trim();
}


function numberValue(value) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }


  if (
    typeof value === "number"
  ) {

    if (
      Number.isFinite(value)
    ) {
      return value;
    }

    return 0;
  }


  const text =
    String(value)
      .trim()
      .replace(
        /[^0-9.-]/g,
        ""
      );


  const number =
    Number(text);


  if (
    Number.isFinite(number)
  ) {
    return number;
  }


  return 0;
}


function carYear(car) {

  const year =
    Math.round(
      numberValue(car.year)
    );


  return year > 0
    ? year
    : 0;
}


function priceJT(value) {

  const price =
    numberValue(value);


  if (!price) {
    return 0;
  }


  /*
   * Database normal:
   *
   * 247000000 = 247 JT
   *
   * Kalau sudah berupa JT:
   *
   * 247 = 247 JT
   */

  if (price < 10000) {
    return price;
  }


  return price / 1000000;
}


// ============================================================
// LOW KM
// ============================================================

function calculateAverageKMPerYear(car) {

  const km =
    numberValue(
      car.odometer
    );


  const year =
    carYear(car);


  if (
    km <= 0 ||
    year <= 0
  ) {
    return 0;
  }


  const currentYear =
    new Date().getFullYear();


  const age =
    Math.max(
      1,
      currentYear - year
    );


  return km / age;
}


function isLowKM(car) {

  const km =
    numberValue(
      car.odometer
    );


  const average =
    calculateAverageKMPerYear(
      car
    );


  /*
   * FINAL RULE:
   *
   * KM < 50.000
   * DAN
   * average KM/year < 10.000
   */

  return (
    km > 0 &&
    km < 50000 &&
    average > 0 &&
    average < 10000
  );
}


// ============================================================
// MODEL
// ============================================================

function normalizedModel(car) {

  return cleanText(

    [
      car.brand,
      car.model,
      car.variant
    ]
      .filter(Boolean)
      .join(" ")

  ).toLowerCase();
}


function containsModel(
  text,
  models
) {

  for (
    const model of models
  ) {

    if (
      text.includes(model)
    ) {
      return true;
    }

  }


  return false;
}


function isSUV(car) {

  return containsModel(
    normalizedModel(car),
    SUV_MODELS
  );
}


function isMPV(car) {

  return containsModel(
    normalizedModel(car),
    MPV_MODELS
  );
}


// ============================================================
// CAR NAME
// ============================================================

function carName(car) {

  const parts = [

    cleanText(
      car.brand
    ),

    cleanText(
      car.model
    ),

    cleanText(
      car.variant
    )

  ].filter(Boolean);


  if (
    !parts.length
  ) {
    return "MOBIL GARAGE88";
  }


  return parts.join(" ");
}


function branchName(car) {

  const branch =
    cleanText(
      car.branch
    );


  if (!branch) {
    return "Garage88";
  }


  return branch;
}


// ============================================================
// SCORE
// ============================================================

function scoreCar(car) {

  let score = 0;


  const year =
    carYear(car);


  const km =
    numberValue(
      car.odometer
    );


  const price =
    priceJT(
      car.credit_price
    );


  // YEAR

  if (year >= 2025) {
    score += 30;
  }

  else if (year >= 2023) {
    score += 26;
  }

  else if (year >= 2021) {
    score += 22;
  }

  else if (year >= 2019) {
    score += 18;
  }

  else if (year >= 2017) {
    score += 12;
  }

  else if (year >= 2015) {
    score += 6;
  }


  // KM

  if (
    km > 0 &&
    km < 50000
  ) {
    score += 30;
  }

  else if (
    km > 0 &&
    km < 70000
  ) {
    score += 22;
  }

  else if (
    km > 0 &&
    km < 100000
  ) {
    score += 14;
  }

  else if (
    km > 0 &&
    km < 130000
  ) {
    score += 6;
  }


  // LOW KM

  if (
    isLowKM(car)
  ) {
    score += 35;
  }


  // PRICE

  if (
    price > 0 &&
    price < 150
  ) {
    score += 12;
  }

  else if (
    price >= 150 &&
    price <= 200
  ) {
    score += 10;
  }

  else if (
    price > 200 &&
    price <= 250
  ) {
    score += 8;
  }

  else if (
    price > 250 &&
    price <= 350
  ) {
    score += 5;
  }


  // RECENT STOCK

  if (
    car.created_at
  ) {

    const created =
      new Date(
        car.created_at
      ).getTime();


    if (
      Number.isFinite(created)
    ) {

      const daysOld =
        Math.max(
          0,
          (
            Date.now() -
            created
          ) / 86400000
        );


      score += Math.max(
        0,
        15 - daysOld
      );

    }

  }


  return score;
}


function sortBestCars(
  a,
  b
) {

  const scoreA =
    scoreCar(a);


  const scoreB =
    scoreCar(b);


  if (
    scoreA !== scoreB
  ) {

    return (
      scoreB -
      scoreA
    );

  }


  const yearA =
    carYear(a);


  const yearB =
    carYear(b);


  if (
    yearA !== yearB
  ) {

    return (
      yearB -
      yearA
    );

  }


  const kmA =
    numberValue(
      a.odometer
    ) ||
    Number.MAX_SAFE_INTEGER;


  const kmB =
    numberValue(
      b.odometer
    ) ||
    Number.MAX_SAFE_INTEGER;


  if (
    kmA !== kmB
  ) {

    return (
      kmA -
      kmB
    );

  }


  const priceA =
    priceJT(
      a.credit_price
    ) ||
    Number.MAX_SAFE_INTEGER;


  const priceB =
    priceJT(
      b.credit_price
    ) ||
    Number.MAX_SAFE_INTEGER;


  return (
    priceA -
    priceB
  );
}


// ============================================================
// FILE NAME
// ============================================================

function safeFilename(value) {

  const result =
    cleanText(value)
      .replace(
        /[^a-zA-Z0-9._-]+/g,
        "_"
      )
      .replace(
        /^_+|_+$/g,
        ""
      )
      .slice(
        0,
        120
      );


  if (!result) {
    return "MOBIL";
  }


  return result;
}


// ============================================================
// CSV
// ============================================================

function csvValue(value) {

  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }


  const text =
    String(value)
      .replaceAll(
        '"',
        '""'
      )
      .replaceAll(
        "\n",
        " "
      )
      .replaceAll(
        "\r",
        " "
      );


  return '"' + text + '"';
}


// ============================================================
// TIMESTAMP
// ============================================================

function getTimestamp() {

  const d =
    new Date();


  const yyyy =
    d.getFullYear();


  const mm =
    String(
      d.getMonth() + 1
    ).padStart(
      2,
      "0"
    );


  const dd =
    String(
      d.getDate()
    ).padStart(
      2,
      "0"
    );


  const hh =
    String(
      d.getHours()
    ).padStart(
      2,
      "0"
    );


  const mi =
    String(
      d.getMinutes()
    ).padStart(
      2,
      "0"
    );


  const ss =
    String(
      d.getSeconds()
    ).padStart(
      2,
      "0"
    );


  return (
    yyyy +
    mm +
    dd +
    "_" +
    hh +
    mi +
    ss
  );
}


// ============================================================
// DOWNLOAD
// ============================================================

async function downloadImage(
  url
) {

  const response =
    await fetch(url);


  if (
    !response.ok
  ) {

    throw new Error(
      "HTTP " +
      response.status +
      " saat download image"
    );

  }


  const buffer =
    await response.arrayBuffer();


  return Buffer.from(
    buffer
  );
}


// ============================================================
// CREATE STORY
// ============================================================

async function createStory(
  car,
  outputPath
) {

  if (
    !car.ig_image_url
  ) {

    throw new Error(
      "ig_image_url kosong"
    );

  }


  const input =
    await downloadImage(
      car.ig_image_url
    );


  /*
   * ========================================================
   * FOTO UTAMA
   * ========================================================
   *
   * 1080 x 1350
   */

  const photo =
    await sharp(input)

      .rotate()

      .resize(
        PHOTO_WIDTH,
        PHOTO_HEIGHT,
        {
          fit: "cover",
          position: "centre"
        }
      )

      .jpeg({
        quality: 95,
        chromaSubsampling: "4:4:4"
      })

      .toBuffer();


  /*
   * ========================================================
   * TOP EDGE
   * ========================================================
   *
   * Ambil HANYA BARIS PALING ATAS
   * dari foto.
   *
   * Baris tersebut diregangkan
   * menjadi 285 px.
   *
   * TIDAK ADA BLUR.
   */

  const topEdge =
    await sharp(photo)

      .extract({
        left: 0,
        top: 0,
        width: PHOTO_WIDTH,
        height: 1
      })

      .resize(
        STORY_WIDTH,
        PAD_TOP,
        {
          fit: "fill"
        }
      )

      .png()

      .toBuffer();


  /*
   * ========================================================
   * BOTTOM EDGE
   * ========================================================
   *
   * Ambil HANYA BARIS PALING BAWAH
   * dari foto.
   */

  const bottomEdge =
    await sharp(photo)

      .extract({
        left: 0,
        top:
          PHOTO_HEIGHT - 1,
        width: PHOTO_WIDTH,
        height: 1
      })

      .resize(
        STORY_WIDTH,
        PAD_BOTTOM,
        {
          fit: "fill"
        }
      )

      .png()

      .toBuffer();


  /*
   * ========================================================
   * TOP VIGNETTE
   * ========================================================
   *
   * Sangat tipis.
   *
   * Hanya bagian ujung paling atas
   * yang sedikit lebih gelap.
   */

  const topVignette =
    Buffer.from(

      [

        '<svg width="1080" height="285" xmlns="http://www.w3.org/2000/svg">',

        "<defs>",

        '<linearGradient id="topVignette" x1="0" y1="0" x2="0" y2="1">',

        '<stop offset="0%" stop-color="black" stop-opacity="0.18"/>',

        '<stop offset="20%" stop-color="black" stop-opacity="0.10"/>',

        '<stop offset="45%" stop-color="black" stop-opacity="0.04"/>',

        '<stop offset="75%" stop-color="black" stop-opacity="0.01"/>',

        '<stop offset="100%" stop-color="black" stop-opacity="0"/>',

        "</linearGradient>",

        "</defs>",

        '<rect width="1080" height="285" fill="url(#topVignette)"/>',

        "</svg>"

      ].join("")

    );


  /*
   * ========================================================
   * BOTTOM VIGNETTE
   * ========================================================
   */

  const bottomVignette =
    Buffer.from(

      [

        '<svg width="1080" height="285" xmlns="http://www.w3.org/2000/svg">',

        "<defs>",

        '<linearGradient id="bottomVignette" x1="0" y1="0" x2="0" y2="1">',

        '<stop offset="0%" stop-color="black" stop-opacity="0"/>',

        '<stop offset="25%" stop-color="black" stop-opacity="0.01"/>',

        '<stop offset="55%" stop-color="black" stop-opacity="0.04"/>',

        '<stop offset="80%" stop-color="black" stop-opacity="0.10"/>',

        '<stop offset="100%" stop-color="black" stop-opacity="0.18"/>',

        "</linearGradient>",

        "</defs>",

        '<rect width="1080" height="285" fill="url(#bottomVignette)"/>',

        "</svg>"

      ].join("")

    );


  /*
   * ========================================================
   * FINAL CANVAS
   * ========================================================
   *
   * TIDAK ADA:
   *
   * - text
   * - logo
   * - category
   * - cover
   * - blur
   * - black overlay berat
   */

  await sharp({

    create: {

      width:
        STORY_WIDTH,

      height:
        STORY_HEIGHT,

      channels: 3,

      background: {
        r: 0,
        g: 0,
        b: 0
      }

    }

  })

    .composite([

      /*
       * TOP EDGE
       */

      {
        input:
          topEdge,

        top: 0,

        left: 0
      },


      /*
       * FOTO UTAMA
       */

      {
        input:
          photo,

        top:
          PAD_TOP,

        left: 0
      },


      /*
       * BOTTOM EDGE
       */

      {
        input:
          bottomEdge,

        top:
          PAD_TOP +
          PHOTO_HEIGHT,

        left: 0
      },


      /*
       * TOP VIGNETTE
       */

      {
        input:
          topVignette,

        top: 0,

        left: 0
      },


      /*
       * BOTTOM VIGNETTE
       */

      {
        input:
          bottomVignette,

        top:
          PAD_TOP +
          PHOTO_HEIGHT,

        left: 0
      }

    ])

    .jpeg({

      quality: 95,

      chromaSubsampling:
        "4:4:4"

    })

    .toFile(
      outputPath
    );
}


// ============================================================
// GET STOCK FROM SUPABASE
// ============================================================

async function getCars() {

  const fields = [

    "id",
    "branch",
    "brand",
    "model",
    "variant",
    "year",
    "transmission",
    "odometer",
    "credit_price",
    "status",
    "ig_image_url",
    "created_at"

  ];


  const result =
    await supabase

      .from("cars")

      .select(
        fields.join(", ")
      )

      .eq(
        "status",
        "READY"
      )

      .not(
        "ig_image_url",
        "is",
        null
      )

      .neq(
        "ig_image_url",
        ""
      )

      .limit(1000);


  if (
    result.error
  ) {

    throw new Error(

      "Supabase error: " +
      result.error.message

    );

  }


  return result.data || [];
}


// ============================================================
// CATEGORY SELECTION
// ============================================================

function getCategoryCars(
  cars,
  category
) {

  const matched =
    cars.filter(
      function (car) {

        return category.match(
          car
        );

      }
    );


  matched.sort(
    sortBestCars
  );


  return matched.slice(
    0,
    MAX_PER_CATEGORY
  );
}


// ============================================================
// CONCURRENCY
// ============================================================

async function processWithConcurrency(
  items,
  worker,
  concurrency
) {

  const results =
    new Array(
      items.length
    );


  let nextIndex = 0;


  async function runner() {

    while (true) {

      const index =
        nextIndex;


      nextIndex += 1;


      if (
        index >=
        items.length
      ) {
        return;
      }


      try {

        results[index] =
          await worker(
            items[index],
            index
          );

      }

      catch (error) {

        results[index] = {

          ok: false,

          error:

            error instanceof Error
              ? error.message
              : String(error)

        };

      }

    }

  }


  const workers = [];


  const workerCount =
    Math.min(
      concurrency,
      Math.max(
        1,
        items.length
      )
    );


  for (
    let i = 0;
    i < workerCount;
    i += 1
  ) {

    workers.push(
      runner()
    );

  }


  await Promise.all(
    workers
  );


  return results;
}


// ============================================================
// MANIFEST
// ============================================================

async function writeManifest(
  categoryDir,
  rows
) {

  const header = [

    "ORDER",
    "CAR_ID",
    "MOBIL",
    "CABANG",
    "TAHUN",
    "TRANSMISI",
    "ODOMETER",
    "AVERAGE_KM_PER_YEAR",
    "LOW_KM",
    "HARGA_KREDIT_JT",
    "SCORE",
    "CREATED_AT",
    "STATUS",
    "IG_IMAGE_URL",
    "FILE",
    "HASIL"

  ];


  const lines = [];


  lines.push(

    header
      .map(csvValue)
      .join(",")

  );


  for (
    const row of rows
  ) {

    const car =
      row.car;


    const average =
      calculateAverageKMPerYear(
        car
      );


    lines.push(

      [

        row.order,

        car.id,

        carName(car),

        branchName(car),

        carYear(car),

        cleanText(
          car.transmission
        ),

        numberValue(
          car.odometer
        ),

        Math.round(
          average
        ),

        isLowKM(car)
          ? "LOW KM"
          : "",

        priceJT(
          car.credit_price
        ).toFixed(1),

        scoreCar(car)
          .toFixed(1),

        cleanText(
          car.created_at
        ),

        cleanText(
          car.status
        ),

        cleanText(
          car.ig_image_url
        ),

        row.file,

        row.ok
          ? "OK"
          : "FAILED: " +
            row.error

      ]

        .map(csvValue)

        .join(",")

    );

  }


  await writeFile(

    path.join(
      categoryDir,
      "manifest.csv"
    ),

    lines.join("\n") +
      "\n",

    "utf8"

  );
}


// ============================================================
// SUMMARY
// ============================================================

async function writeSummary(
  outputDir,
  rows
) {

  const header = [

    "CATEGORY",
    "FOLDER",
    "SELECTED",
    "SUCCESS",
    "FAILED"

  ];


  const lines = [];


  lines.push(

    header
      .map(csvValue)
      .join(",")

  );


  for (
    const row of rows
  ) {

    lines.push(

      [

        row.category,

        row.folder,

        row.selected,

        row.success,

        row.failed

      ]

        .map(csvValue)

        .join(",")

    );

  }


  await writeFile(

    path.join(
      outputDir,
      "SUMMARY.csv"
    ),

    lines.join("\n") +
      "\n",

    "utf8"

  );
}


// ============================================================
// PROCESS CATEGORY
// ============================================================

async function processCategory(
  outputDir,
  category,
  cars
) {

  const categoryCars =
    getCategoryCars(
      cars,
      category
    );


  const categoryDir =
    path.join(
      outputDir,
      category.key
    );


  await mkdir(
    categoryDir,
    {
      recursive: true
    }
  );


  console.log("");

  console.log(
    "============================================"
  );

  console.log(
    category.key
  );

  console.log(
    category.title
  );

  console.log(
    "Selected: " +
    categoryCars.length
  );

  console.log(
    "============================================"
  );


  const results =
    await processWithConcurrency(

      categoryCars,

      async function (
        car,
        index
      ) {

        const order =
          index + 1;


        const filename =

          String(order)
            .padStart(
              3,
              "0"
            ) +

          "__" +

          safeFilename(
            carName(car)
          ) +

          "__" +

          safeFilename(
            branchName(car)
          ) +

          "__STORY.jpg";


        const outputPath =
          path.join(
            categoryDir,
            filename
          );


        try {

          await createStory(
            car,
            outputPath
          );


          console.log(

            "  OK " +

            String(order)
              .padStart(
                2,
                "0"
              ) +

            "/" +

            String(
              categoryCars.length
            ) +

            "  " +

            carName(car)

          );


          return {

            order:
              order,

            car:
              car,

            file:
              filename,

            ok:
              true,

            error:
              ""

          };

        }

        catch (error) {

          console.error(

            "  FAIL " +

            String(order)
              .padStart(
                2,
                "0"
              ) +

            "/" +

            String(
              categoryCars.length
            ) +

            "  " +

            carName(car) +

            "  " +

            (
              error instanceof Error
                ? error.message
                : String(error)
            )

          );


          return {

            order:
              order,

            car:
              car,

            file:
              filename,

            ok:
              false,

            error:

              error instanceof Error
                ? error.message
                : String(error)

          };

        }

      },

      DOWNLOAD_CONCURRENCY

    );


  await writeManifest(
    categoryDir,
    results
  );


  const success =
    results.filter(
      function (row) {
        return row.ok;
      }
    ).length;


  const failed =
    results.filter(
      function (row) {
        return !row.ok;
      }
    ).length;


  return {

    category:
      category.title,

    folder:
      category.key,

    selected:
      categoryCars.length,

    success:
      success,

    failed:
      failed

  };
}


// ============================================================
// OPEN FOLDER
// ============================================================

function openFolder(
  folder
) {

  if (
    process.platform !==
    "darwin"
  ) {
    return;
  }


  execFile(
    "open",
    [folder],
    function () {
      // Finder opened
    }
  );
}


// ============================================================
// MAIN
// ============================================================

async function main() {

  console.log("");

  console.log(
    "============================================"
  );

  console.log(
    "GARAGE88 STORY CAROUSEL GENERATOR"
  );

  console.log(
    "============================================"
  );

  console.log("");

  console.log(
    "Story: 1080 x 1920"
  );

  console.log(
    "Photo: 1080 x 1350"
  );

  console.log(
    "Max/category: " +
    MAX_PER_CATEGORY
  );

  console.log(
    "LOW KM: KM < 50.000 + average < 10.000/year"
  );

  console.log(
    "PURE PHOTO - NO TEXT - NO COVER - NO BLUR"
  );

  console.log("");


  const cars =
    await getCars();


  console.log(
    "READY stock: " +
    cars.length
  );


  if (
    cars.length === 0
  ) {

    console.log(
      "Tidak ada stock READY dengan IG image."
    );

    return;
  }


  const outputDir =
    path.join(

      ROOT_OUTPUT_DIR,

      "garage88-carousel-" +
      getTimestamp()

    );


  await mkdir(
    outputDir,
    {
      recursive: true
    }
  );


  const summary = [];


  for (
    const category of CATEGORIES
  ) {

    const result =
      await processCategory(

        outputDir,

        category,

        cars

      );


    summary.push(
      result
    );

  }


  await writeSummary(
    outputDir,
    summary
  );


  console.log("");

  console.log(
    "============================================"
  );

  console.log(
    "SELESAI"
  );

  console.log(
    "============================================"
  );

  console.log("");

  console.log(
    "Output:"
  );

  console.log(
    outputDir
  );

  console.log("");


  for (
    const row of summary
  ) {

    console.log(

      row.folder +
      " | " +
      row.success +
      "/" +
      row.selected +
      " OK"

    );

  }


  console.log("");


  openFolder(
    outputDir
  );
}


// ============================================================
// RUN
// ============================================================

main().catch(
  function (error) {

    console.error("");

    console.error(
      "FATAL ERROR"
    );

    console.error("");

    console.error(

      error instanceof Error
        ? error.stack
        : String(error)

    );

    console.error("");

    process.exit(1);
  }
);
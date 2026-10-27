#!/usr/bin/env node

/**
 * ============================================================
 * GARAGE88 PREMIUM COVER
 * ============================================================
 *
 * LOCAL PREVIEW
 *
 * Output:
 * ~/Downloads/GARAGE88-PREMIUM-COVER
 *
 * Ukuran:
 * 1080 x 1350
 *
 * TOP PHOTO:
 * Foto DB ke-2
 * Foto DB ke-4
 * Foto DB ke-5
 *
 * MAIN PHOTO:
 * Tetap menggunakan cover_source_image_url
 *
 * ============================================================
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadEnvFile } from "node:process";

import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";


/* ============================================================
   ENV
   ============================================================ */

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
  throw new Error(
    "SUPABASE_URL / PUBLIC_SUPABASE_URL tidak ditemukan."
  );
}

if (!SUPABASE_SERVICE_KEY) {
  throw new Error(
    "SUPABASE_SERVICE_KEY tidak ditemukan."
  );
}


const supabase =
  createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );


/* ============================================================
   ARGUMENT
   ============================================================ */

const args =
  process.argv.slice(2);


function getNumberArg(
  name,
  fallback
) {
  const prefix =
    `--${name}=`;

  const found =
    args.find(
      (arg) =>
        arg.startsWith(prefix)
    );

  if (!found) {
    return fallback;
  }

  const value =
    Number(
      found.slice(
        prefix.length
      )
    );

  return Number.isFinite(value)
    ? value
    : fallback;
}


const start =
  Math.max(
    0,
    getNumberArg(
      "start",
      0
    )
  );


const limit =
  Math.max(
    0,
    getNumberArg(
      "limit",
      1
    )
  );


/* ============================================================
   OUTPUT
   ============================================================ */

const OUTPUT_DIR =
  path.join(
    os.homedir(),
    "Downloads",
    "GARAGE88-PREMIUM-COVER"
  );


/* ============================================================
   CANVAS
   ============================================================ */

const WIDTH =
  1080;

const HEIGHT =
  1350;


/* ============================================================
   TOP GALLERY
   ============================================================ */

const TOP_PHOTO_HEIGHT =
  425;


/* ============================================================
   TITLE
   ============================================================ */

const TITLE_LEFT =
  155;

const TITLE_TOP =
  205;

const TITLE_WIDTH =
  875;

const TITLE_FONT_SIZE =
  81;


/* ============================================================
   SAFE AREA
   ============================================================ */

const SAFE_BOTTOM =
  135;


/* ============================================================
   BRANDING
   ============================================================ */

const GARAGE_INSTAGRAM =
  "garage88jakarta";

const GARAGE_PHONE =
  "0813 8522 6049";


/* ============================================================
   HELPERS
   ============================================================ */

function sleep(ms) {
  return new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        ms
      )
  );
}


function cleanText(value) {
  return String(
    value ?? ""
  )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


function esc(value) {
  return String(
    value ?? ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}


/* ============================================================
   PRICE FORMAT
   ============================================================ */

function formatPrice(value) {

  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(
      Number(value)
    )
  ) {
    return "-";
  }

  const number =
    Number(value);


  if (
    number >=
    1_000_000_000
  ) {

    const miliar =
      number /
      1_000_000_000;

    return (
      miliar.toLocaleString(
        "id-ID",
        {
          maximumFractionDigits:
            2,
        }
      ) +
      " M"
    );
  }


  const juta =
    number /
    1_000_000;


  return (
    juta.toLocaleString(
      "id-ID",
      {
        maximumFractionDigits:
          1,
      }
    ) +
    " JT"
  );
}


/* ============================================================
   KM FORMAT
   ============================================================ */

function formatKm(value) {

  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(
      Number(value)
    )
  ) {
    return "-";
  }


  return Math.round(
    Number(value)
  ).toLocaleString(
    "id-ID"
  );
}


/* ============================================================
   LOW KM
   ============================================================ */

function isLowKm(
  car
) {

  const km =
    Number(
      car.odometer
    );

  const year =
    Number(
      car.year
    );


  if (
    !Number.isFinite(km) ||
    !Number.isFinite(year)
  ) {
    return false;
  }


  if (
    km >=
    100_000
  ) {
    return false;
  }


  const currentYear =
    new Date()
      .getFullYear();


  const age =
    Math.max(
      1,
      currentYear - year
    );


  const averageKm =
    km / age;


  return (
    averageKm <
    10_000
  );
}


/* ============================================================
   HERO TITLE
   ============================================================ */

function buildHeroTitle(
  car
) {

  const hero =
    cleanText(
      car.cover_hero_title
    );


  const year =
    car.year !== null &&
    car.year !== undefined
      ? String(car.year)
      : "";


  if (
    hero &&
    year
  ) {

    return (
      `${hero} ${year}`
    )
      .replace(
        /\s+/g,
        " "
      )
      .trim()
      .toUpperCase();
  }


  if (hero) {

    return hero
      .toUpperCase();
  }


  const fallback = [

    car.model,

    car.variant,

    year,

  ]
    .filter(Boolean)
    .join(" ")
    .replace(
      /\s+/g,
      " "
    )
    .trim();


  return fallback
    .toUpperCase();
}


/* ============================================================
   DETAIL BRAND
   ============================================================ */

function buildDetailBrand(
  car
) {

  return cleanText(
    car.brand
  )
    .toUpperCase();
}


/* ============================================================
   DETAIL NAME
   ============================================================

   Brand TIDAK diulang.

   Contoh:

   TOYOTA

   ALPHARD G ATPM 2018

   HITAM

   ============================================================ */

function buildDetailName(
  car
) {

  const model =
    cleanText(
      car.model
    ).toUpperCase();


  const variant =
    cleanText(
      car.variant
    ).toUpperCase();


  const year =
    car.year !== null &&
    car.year !== undefined
      ? String(car.year)
      : "";


  return [

    model,

    variant,

    year,

  ]
    .filter(Boolean)
    .join(" ")
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


/* ============================================================
   GET CARS
   ============================================================ */

async function getCars() {

  const {
    data,
    error,
  } =
    await supabase
      .from("cars")
      .select(`
        id,
        brand,
        model,
        variant,
        year,
        color,
        odometer,
        credit_price,
        cash_price,
        dp,
        status,
        cover_source_image_url,
        cover_hero_title,
        ig_image_url,
        created_at
      `)
      .eq(
        "status",
        "READY"
      )
      .order(
        "created_at",
        {
          ascending:
            false,
        }
      );


  if (error) {

    throw new Error(
      `Supabase cars error: ${error.message}`
    );
  }


  const cars =
    (data ?? [])
      .filter(
        (car) =>
          cleanText(
            car.cover_source_image_url
          )
      );


  const sliced =
    limit > 0
      ? cars.slice(
          start,
          start + limit
        )
      : cars.slice(
          start
        );


  return {

    total:
      cars.length,

    cars:
      sliced,

  };
}


/* ============================================================
   GET CAR IMAGES
   ============================================================ */

async function getCarImages(
  carId
) {

  const {
    data,
    error,
  } =
    await supabase
      .from("car_images")
      .select(`
        image_url,
        sort_order
      `)
      .eq(
        "car_id",
        carId
      )
      .order(
        "sort_order",
        {
          ascending:
            true,
        }
      );


  if (error) {

    throw new Error(
      `Supabase car_images error: ${error.message}`
    );
  }


  return (
    data ?? []
  )
    .filter(
      (item) =>
        cleanText(
          item.image_url
        )
    );
}


/* ============================================================
   TOP PHOTO URLS
   ============================================================

   SEKARANG MENGAMBIL:

   DB FOTO 2
   DB FOTO 4
   DB FOTO 5

   Array JavaScript:

   urls[1] = Foto 2
   urls[3] = Foto 4
   urls[4] = Foto 5

   ============================================================ */

function getTopPhotoUrls(
  images
) {

  const urls =
    images
      .map(
        (item) =>
          cleanText(
            item.image_url
          )
      )
      .filter(Boolean);


  /*
   * Mapping:
   *
   * DB Foto 1 = urls[0]
   * DB Foto 2 = urls[1]  ← DIPAKAI
   * DB Foto 3 = urls[2]
   * DB Foto 4 = urls[3]  ← DIPAKAI
   * DB Foto 5 = urls[4]  ← DIPAKAI
   */

  const preferred =
    [
      urls[1],
      urls[3],
      urls[4],
    ]
      .filter(Boolean);


  /*
   * Kalau database punya 5 foto atau lebih,
   * hasil normalnya:
   *
   * FOTO 2
   * FOTO 4
   * FOTO 5
   */

  if (
    preferred.length >= 3
  ) {

    return preferred.slice(
      0,
      3
    );

  }


  /*
   * Fallback kalau hanya tersedia
   * sebagian dari foto 2/4/5.
   */

  if (
    preferred.length === 2
  ) {

    return [

      preferred[0],

      preferred[1],

      preferred[0],

    ];

  }


  if (
    preferred.length === 1
  ) {

    return [

      preferred[0],

      preferred[0],

      preferred[0],

    ];

  }


  /*
   * Kalau foto 2/4/5 tidak ada sama sekali,
   * return kosong dan buildHtml akan
   * menggunakan main image.
   */

  return [];

}


/* ============================================================
   WALLET ICON
   ============================================================ */

function walletIcon() {

  return `

<svg
  width="32"
  height="32"
  viewBox="0 0 32 32"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
>

  <rect
    x="3"
    y="6"
    width="26"
    height="21"
    rx="5"
    stroke="#222222"
    stroke-width="2"
  />

  <path
    d="M5 11H25"
    stroke="#222222"
    stroke-width="2"
  />

  <path
    d="M21 16H27V22H21C19.3431 22 18 20.6569 18 19C18 17.3431 19.3431 16 21 16Z"
    stroke="#222222"
    stroke-width="2"
  />

  <circle
    cx="22"
    cy="19"
    r="1.5"
    fill="#222222"
  />

</svg>

`;
}


/* ============================================================
   SPEED ICON
   ============================================================ */

function speedIcon() {

  return `

<svg
  width="32"
  height="32"
  viewBox="0 0 32 32"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
>

  <path
    d="M6 23C6 17.4772 10.4772 13 16 13C21.5228 13 26 17.4772 26 23"
    stroke="#222222"
    stroke-width="2"
    stroke-linecap="round"
  />

  <path
    d="M16 23L21 18"
    stroke="#222222"
    stroke-width="2"
    stroke-linecap="round"
  />

  <path
    d="M9 23H23"
    stroke="#222222"
    stroke-width="2"
    stroke-linecap="round"
  />

  <path
    d="M10 17L8 15"
    stroke="#222222"
    stroke-width="2"
    stroke-linecap="round"
  />

  <path
    d="M22 17L24 15"
    stroke="#222222"
    stroke-width="2"
    stroke-linecap="round"
  />

</svg>

`;
}


/* ============================================================
   INSTAGRAM ICON
   ============================================================ */

function instagramIcon() {

  return `

<svg
  viewBox="0 0 24 24"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
>

  <rect
    x="3"
    y="3"
    width="18"
    height="18"
    rx="5"
    stroke="#222222"
    stroke-width="2"
  />

  <circle
    cx="12"
    cy="12"
    r="4"
    stroke="#222222"
    stroke-width="2"
  />

  <circle
    cx="17.5"
    cy="6.5"
    r="1.2"
    fill="#222222"
  />

</svg>

`;
}


/* ============================================================
   WHATSAPP ICON
   ============================================================ */

function whatsappIcon() {

  return `

<svg
  viewBox="0 0 24 24"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
>

  <path
    d="M20.5 11.7C20.5 16.5 16.6 20.4 11.8 20.4C10.3 20.4 8.8 20 7.5 19.3L3.5 20.5L4.8 16.7C4 15.3 3.6 13.8 3.6 12.2C3.6 7.4 7.5 3.5 12.3 3.5C17 3.5 20.5 7.1 20.5 11.7Z"
    stroke="#222222"
    stroke-width="1.8"
    stroke-linejoin="round"
  />

  <path
    d="M8.2 8.3C8.5 7.8 8.8 7.7 9.2 7.8C9.5 7.9 10 9.1 10.1 9.4C10.2 9.7 10.1 9.9 9.9 10.2L9.3 10.8C9.1 11.3 9.2 11.3 9.4 11.6C10.2 12.9 11.3 14 12.7 14.7C13 14.9 13.3 14.9 13.5 14.6L14.1 14C14.3 13.8 14.5 13.7 14.8 13.8C15.1 13.9 16.3 14.5 16.6 14.7C16.9 14.9 17 15.1 16.9 15.4C16.8 15.9 16.4 16.4 15.9 16.6C15.4 16.8 14.8 16.8 14.2 16.6C11.1 15.6 8.5 13 7.4 10C7.2 9.4 7.3 8.8 7.6 8.5L8.2 8.3Z"
    stroke="#222222"
    stroke-width="1.4"
    stroke-linejoin="round"
  />

</svg>

`;
}


/* ============================================================
   BUILD HTML
   ============================================================ */

function buildHtml(
  car,
  mainImageUrl,
  topPhotoUrls
) {

  const heroTitle =
    buildHeroTitle(
      car
    );


  const detailBrand =
    buildDetailBrand(
      car
    );


  const detailName =
    buildDetailName(
      car
    );


  const dp =
    formatPrice(
      car.dp
    );


  const km =
    formatKm(
      car.odometer
    );


  const credit =
    formatPrice(
      car.credit_price
    );


  const cash =
    formatPrice(
      car.cash_price
    );


  const color =
    cleanText(
      car.color
    ).toUpperCase();


  const photo1 =
    topPhotoUrls[0] ||
    mainImageUrl;


  const photo2 =
    topPhotoUrls[1] ||
    mainImageUrl;


  const photo3 =
    topPhotoUrls[2] ||
    mainImageUrl;


  const lowKm =
    isLowKm(
      car
    );


  return `

<!doctype html>

<html lang="id">

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=1080,height=1350"
>

<title>
  Garage88 Premium Cover
</title>


<style>


/* ==========================================================
   RESET
   ========================================================== */

* {

  box-sizing:
    border-box;

  margin:
    0;

  padding:
    0;

}


html,
body {

  width:
    1080px;

  height:
    1350px;

  overflow:
    hidden;

  background:
    #ffffff;

  font-family:
    Arial,
    Helvetica,
    sans-serif;

}


/* ==========================================================
   POSTER
   ========================================================== */

.poster {

  position:
    relative;

  width:
    1080px;

  height:
    1350px;

  overflow:
    hidden;

  background:
    #ffffff;

}


/* ==========================================================
   MAIN PHOTO
   ========================================================== */

.main-photo {

  position:
    absolute;

  inset:
    0;

  width:
    1080px;

  height:
    1350px;

  z-index:
    1;

  overflow:
    hidden;

}


.main-photo img {

  display:
    block;

  width:
    1080px;

  height:
    1350px;

  object-fit:
    cover;

  object-position:
    center;

}


/* ==========================================================
   TOP GALLERY
   ========================================================== */

.top-gallery {

  position:
    absolute;

  left:
    0;

  top:
    0;

  width:
    1080px;

  height:
    425px;

  z-index:
    10;

  overflow:
    hidden;

}


/* ==========================================================
   TOP PHOTO
   ========================================================== */

.top-photo {

  position:
    absolute;

  top:
    0;

  height:
    425px;

  overflow:
    hidden;

}


.top-photo img {

  position:
    absolute;

  inset:
    0;

  width:
    100%;

  height:
    100%;

  display:
    block;

  object-fit:
    cover;

  object-position:
    center;

}


/* ==========================================================
   TOP PHOTO GRADIENT
   ========================================================== */

.top-photo::after {

  content:
    "";

  position:
    absolute;

  left:
    0;

  right:
    0;

  bottom:
    0;

  height:
    105px;

  background:
    linear-gradient(
      to bottom,

      rgba(255,255,255,0)
        0%,

      rgba(255,255,255,0.025)
        12%,

      rgba(255,255,255,0.08)
        28%,

      rgba(255,255,255,0.20)
        45%,

      rgba(255,255,255,0.40)
        62%,

      rgba(255,255,255,0.64)
        78%,

      rgba(255,255,255,0.86)
        91%,

      rgba(255,255,255,1)
        100%
    );

  pointer-events:
    none;

}


/* ==========================================================
   PHOTO 1
   ========================================================== */

.photo-one {

  left:
    0;

  width:
    395px;

  clip-path:
    polygon(
      0 0,
      100% 0,
      84% 100%,
      0 100%
    );

}


/* ==========================================================
   PHOTO 2
   ========================================================== */

.photo-two {

  left:
    330px;

  width:
    405px;

  clip-path:
    polygon(
      16% 0,
      100% 0,
      84% 100%,
      0 100%
    );

}


/* ==========================================================
   PHOTO 3
   ========================================================== */

.photo-three {

  left:
    670px;

  width:
    410px;

  right:
    0;

  clip-path:
    polygon(
      16% 0,
      100% 0,
      100% 100%,
      0 100%
    );

}


/* ==========================================================
   DIAGONAL
   ========================================================== */

.diagonal {

  position:
    absolute;

  top:
    -15px;

  height:
    455px;

  width:
    11px;

  z-index:
    20;

  background:
    linear-gradient(
      to bottom,

      rgba(255,255,255,1)
        0%,

      rgba(255,255,255,0.98)
        45%,

      rgba(255,255,255,0.82)
        70%,

      rgba(255,255,255,0.18)
        100%
    );

  transform-origin:
    center;

  pointer-events:
    none;

}


.diagonal-one {

  left:
    351px;

  transform:
    rotate(10deg);

}


.diagonal-two {

  left:
    691px;

  transform:
    rotate(10deg);

}


/* ==========================================================
   TITLE BLOCK
   ========================================================== */

.title-block {

  position:
    absolute;

  left:
    155px;

  top:
    205px;

  width:
    875px;

  z-index:
    40;

}


/* ==========================================================
   BRAND SMALL
   ========================================================== */

.brand-small {

  margin-bottom:
    7px;

  color:
    #ffffff;

  font-size:
    25px;

  line-height:
    1;

  font-weight:
    900;

  letter-spacing:
    1px;

  -webkit-text-stroke:
    3px #111111;

  paint-order:
    stroke fill;

  text-shadow:
    0 2px 4px
    rgba(0,0,0,0.45);

}


/* ==========================================================
   HERO TITLE
   ========================================================== */

.title {

  font-size:
    81px;

  line-height:
    0.91;

  font-weight:
    900;

  letter-spacing:
    -2.5px;

  text-align:
    left;

  text-transform:
    uppercase;

  color:
    #111111;

  background:
    none;

  -webkit-background-clip:
    initial;

  background-clip:
    initial;

  -webkit-text-fill-color:
    #111111;

  -webkit-text-stroke:
    2px #ffffff;

  paint-order:
    stroke fill;

  text-shadow:

    0 0 3px
    rgba(255,255,255,1),

    0 0 7px
    rgba(255,255,255,1),

    0 0 14px
    rgba(255,255,255,0.95),

    0 0 24px
    rgba(255,255,255,0.72),

    0 3px 6px
    rgba(0,0,0,0.28);

}


/* ==========================================================
   MAIN PHOTO BOTTOM FADE
   ========================================================== */

.main-bottom-fade {

  position:
    absolute;

  left:
    0;

  right:
    0;

  bottom:
    0;

  height:
    390px;

  z-index:
    35;

  pointer-events:
    none;

  background:
    linear-gradient(
      to bottom,

      rgba(255,255,255,0)
        0%,

      rgba(255,255,255,0.04)
        18%,

      rgba(255,255,255,0.18)
        45%,

      rgba(255,255,255,0.42)
        67%,

      rgba(255,255,255,0.70)
        82%,

      rgba(255,255,255,0.88)
        93%,

      rgba(255,255,255,0.94)
        100%
    );

}


/* ==========================================================
   BOTTOM INFO
   ========================================================== */

.bottom-info {

  position:
    absolute;

  left:
    65px;

  right:
    65px;

  top:
    955px;

  height:
    260px;

  z-index:
    50;

}


/* ==========================================================
   SPEC ROW
   ========================================================== */

.spec-row {

  display:
    grid;

  grid-template-columns:
    1fr 1fr 1fr;

  height:
    90px;

  border-top:
    1px solid
    rgba(40,40,40,0.25);

  border-bottom:
    1px solid
    rgba(40,40,40,0.25);

}


.spec {

  display:
    flex;

  align-items:
    center;

  gap:
    12px;

  padding:
    10px 28px;

  border-right:
    1px solid
    rgba(40,40,40,0.22);

}


.spec:last-child {

  border-right:
    none;

}


.spec-icon {

  width:
    52px;

  height:
    52px;

  display:
    flex;

  align-items:
    center;

  justify-content:
    center;

  border:
    2px solid
    #222222;

  border-radius:
    10px;

  flex:
    0 0 52px;

}


.spec-icon svg {

  width:
    32px;

  height:
    32px;

}


.spec-content {

  display:
    flex;

  flex-direction:
    column;

  justify-content:
    center;

}


.spec-label {

  color:
    #555555;

  font-size:
    13px;

  line-height:
    1;

  font-weight:
    800;

  letter-spacing:
    0.5px;

  text-transform:
    uppercase;

}


.spec-value {

  margin-top:
    5px;

  color:
    #111111;

  font-size:
    34px;

  line-height:
    0.92;

  font-weight:
    900;

  letter-spacing:
    -0.5px;

}


/* ==========================================================
   LOW KM
   ========================================================== */

.low-km-slot {

  display:
    flex;

  align-items:
    center;

  justify-content:
    flex-end;

  padding:
    0 12px;

}


.low-km-badge {

  display:
    inline-flex;

  align-items:
    center;

  justify-content:
    center;

  min-width:
    145px;

  height:
    50px;

  padding:
    0 18px;

  border-radius:
    10px;

  background:
    #dc2626;

  color:
    #ffffff;

  font-size:
    20px;

  line-height:
    1;

  font-weight:
    900;

  letter-spacing:
    0.3px;

  text-transform:
    uppercase;

  box-shadow:
    0 3px 8px
    rgba(0,0,0,0.12);

}


/* ==========================================================
   DETAIL ROW
   ========================================================== */

.detail-row {

  display:
    grid;

  grid-template-columns:
    1fr 1.12fr;

  height:
    170px;

}


/* ==========================================================
   PRICE BOX
   ========================================================== */

.price-box {

  padding:
    12px 28px 5px 0;

  border-right:
    1px solid
    rgba(40,40,40,0.22);

}


/* ==========================================================
   OTR CREDIT LABEL
   ========================================================== */

.price-label {

  color:
    #555555;

  font-size:
    18px;

  line-height:
    1;

  font-weight:
    900;

  letter-spacing:
    0.3px;

  text-transform:
    uppercase;

}


/* ==========================================================
   OTR CREDIT VALUE
   ========================================================== */

.price-main {

  margin-top:
    2px;

  color:
    #111111;

  font-size:
    96px;

  line-height:
    0.86;

  font-weight:
    900;

  letter-spacing:
    -4px;

  white-space:
    nowrap;

}


/* ==========================================================
   CASH
   ========================================================== */

.price-cash {

  margin-top:
    9px;

  color:
    #555555;

  font-size:
    27px;

  line-height:
    1;

  font-weight:
    800;

  letter-spacing:
    -0.2px;

  white-space:
    nowrap;

}


/* ==========================================================
   DETAIL BOX
   ========================================================== */

.detail-box {

  padding:
    12px 0 8px 45px;

}


/* ==========================================================
   DETAIL BRAND
   ========================================================== */

.detail-brand {

  color:
    #555555;

  font-size:
    14px;

  line-height:
    1;

  font-weight:
    900;

  text-transform:
    uppercase;

}


/* ==========================================================
   DETAIL NAME
   ========================================================== */

.detail-name {

  margin-top:
    7px;

  max-width:
    470px;

  color:
    #111111;

  font-size:
    27px;

  line-height:
    0.98;

  font-weight:
    900;

  text-transform:
    uppercase;

}


/* ==========================================================
   DETAIL COLOR
   ========================================================== */

.detail-color {

  margin-top:
    8px;

  color:
    #555555;

  font-size:
    16px;

  line-height:
    1;

  font-weight:
    800;

  text-transform:
    uppercase;

}


/* ==========================================================
   SOCIAL BRANDING
   ==========================================================

   HANYA:

   Instagram
   garage88jakarta

   WhatsApp
   0813 8522 6049

   TikTok DIHAPUS.
   ========================================================== */

.contact-brand {

  position:
    absolute;

  left:
    65px;

  right:
    65px;

  top:
    1230px;

  height:
    55px;

  z-index:
    56;

  display:
    flex;

  align-items:
    center;

  justify-content:
    center;

}


/* ==========================================================
   SIDE LINES
   ========================================================== */

.contact-brand::before,
.contact-brand::after {

  content:
    "";

  height:
    1px;

  flex:
    1;

  max-width:
    150px;

  background:
    rgba(30,30,30,0.25);

}


/* ==========================================================
   SOCIAL INNER
   ========================================================== */

.contact-inner {

  display:
    flex;

  align-items:
    center;

  justify-content:
    center;

  gap:
    20px;

  padding:
    0 22px;

}


/* ==========================================================
   SOCIAL ITEM
   ========================================================== */

.contact-item {

  display:
    flex;

  align-items:
    center;

  gap:
    10px;

  color:
    #222222;

  font-family:
    "Avenir Next",
    "Helvetica Neue",
    Arial,
    sans-serif;

  font-size:
    28px;

  line-height:
    1;

  font-weight:
    700;

  letter-spacing:
    -0.4px;

  white-space:
    nowrap;

}


/* ==========================================================
   SOCIAL ICON
   ========================================================== */

.contact-icon {

  width:
    32px;

  height:
    32px;

  display:
    flex;

  align-items:
    center;

  justify-content:
    center;

  flex:
    0 0 32px;

}


.contact-icon svg {

  width:
    30px;

  height:
    30px;

}


/* ==========================================================
   SOCIAL DIVIDER
   ========================================================== */

.contact-divider {

  width:
    1px;

  height:
    28px;

  background:
    rgba(30,30,30,0.28);

}


/* ==========================================================
   FOOTER
   ========================================================== */

.footer {

  position:
    absolute;

  left:
    65px;

  right:
    65px;

  bottom:
    12px;

  height:
    34px;

  z-index:
    60;

  display:
    flex;

  align-items:
    center;

  justify-content:
    center;

  border-top:
    1px solid
    rgba(40,40,40,0.25);

}


.footer-text {

  color:
    #333333;

  font-size:
    11px;

  line-height:
    1;

  font-weight:
    800;

  text-align:
    center;

  white-space:
    nowrap;

  text-transform:
    uppercase;

}


</style>

</head>


<body>


<div class="poster">


  <!-- ======================================================
       MAIN PHOTO
       ====================================================== -->

  <div
    class="
      main-photo
    "
  >

    <img
      src="${esc(
        mainImageUrl
      )}"
      alt=""
    >

  </div>


  <!-- ======================================================
       TOP 3 PHOTOS
       ======================================================

       DB FOTO 2
       DB FOTO 4
       DB FOTO 5

       ====================================================== -->

  <div
    class="
      top-gallery
    "
  >


    <div
      class="
        top-photo
        photo-one
      "
    >

      <img
        src="${esc(
          photo1
        )}"
        alt=""
      >

    </div>


    <div
      class="
        top-photo
        photo-two
      "
    >

      <img
        src="${esc(
          photo2
        )}"
        alt=""
      >

    </div>


    <div
      class="
        top-photo
        photo-three
      "
    >

      <img
        src="${esc(
          photo3
        )}"
        alt=""
      >

    </div>


    <div
      class="
        diagonal
        diagonal-one
      "
    ></div>


    <div
      class="
        diagonal
        diagonal-two
      "
    ></div>


  </div>


  <!-- ======================================================
       TITLE
       ====================================================== -->

  <div
    class="
      title-block
    "
  >


    ${
      detailBrand
        ? `
    <div
      class="
        brand-small
      "
    >
      ${esc(
        detailBrand
      )}
    </div>
    `
        : ""
    }


    <div
      class="
        title
      "
    >
      ${esc(
        heroTitle
      )}
    </div>


  </div>


  <!-- ======================================================
       MAIN PHOTO BOTTOM FADE
       ====================================================== -->

  <div
    class="
      main-bottom-fade
    "
  ></div>


  <!-- ======================================================
       BOTTOM INFO
       ====================================================== -->

  <div
    class="
      bottom-info
    "
  >


    <!-- ====================================================
         DP / KM / LOW KM
         ==================================================== -->

    <div
      class="
        spec-row
      "
    >


      <!-- DP -->

      <div
        class="
          spec
        "
      >

        <div
          class="
            spec-icon
          "
        >

          ${walletIcon()}

        </div>


        <div
          class="
            spec-content
          "
        >

          <div
            class="
              spec-label
            "
          >
            DP MULAI
          </div>


          <div
            class="
              spec-value
            "
          >
            ${esc(
              dp
            )}
          </div>

        </div>

      </div>


      <!-- KM -->

      <div
        class="
          spec
        "
      >

        <div
          class="
            spec-icon
          "
        >

          ${speedIcon()}

        </div>


        <div
          class="
            spec-content
          "
        >

          <div
            class="
              spec-label
            "
          >
            KM
          </div>


          <div
            class="
              spec-value
            "
          >
            ${esc(
              km
            )}
          </div>

        </div>

      </div>


      <!-- LOW KM -->

      <div
        class="
          low-km-slot
        "
      >

        ${
          lowKm
            ? `
        <div
          class="
            low-km-badge
          "
        >
          LOW KM
        </div>
        `
            : ""
        }

      </div>


    </div>


    <!-- ====================================================
         PRICE + DETAIL
         ==================================================== -->

    <div
      class="
        detail-row
      "
    >


      <!-- PRICE -->

      <div
        class="
          price-box
        "
      >

        <div
          class="
            price-label
          "
        >
          OTR CREDIT
        </div>


        <div
          class="
            price-main
          "
        >
          ${esc(
            credit
          )}
        </div>


        <div
          class="
            price-cash
          "
        >
          Cash ${esc(
            cash
          )}
        </div>

      </div>


      <!-- VEHICLE DETAIL -->

      <div
        class="
          detail-box
        "
      >

        <div
          class="
            detail-brand
          "
        >
          ${esc(
            detailBrand
          )}
        </div>


        <div
          class="
            detail-name
          "
        >
          ${esc(
            detailName
          )}
        </div>


        ${
          color
            ? `
        <div
          class="
            detail-color
          "
        >
          ${esc(
            color
          )}
        </div>
        `
            : ""
        }

      </div>


    </div>


  </div>


  <!-- ======================================================
       INSTAGRAM + WHATSAPP
       ====================================================== -->

  <div
    class="
      contact-brand
    "
  >

    <div
      class="
        contact-inner
      "
    >


      <!-- INSTAGRAM -->

      <div
        class="
          contact-item
        "
      >

        <div
          class="
            contact-icon
          "
        >

          ${instagramIcon()}

        </div>


        <span>
          ${esc(
            GARAGE_INSTAGRAM
          )}
        </span>

      </div>


      <div
        class="
          contact-divider
        "
      ></div>


      <!-- WHATSAPP -->

      <div
        class="
          contact-item
        "
      >

        <div
          class="
            contact-icon
          "
        >

          ${whatsappIcon()}

        </div>


        <span>
          ${esc(
            GARAGE_PHONE
          )}
        </span>

      </div>


    </div>

  </div>


  <!-- ======================================================
       FOOTER
       ====================================================== -->

  <div
    class="
      footer
    "
  >

    <div
      class="
        footer-text
      "
    >

      HARGA CREDIT
      ${esc(
        credit
      )}

      •

      HARGA CASH
      ${esc(
        cash
      )}

      •

      DP
      ${esc(
        dp
      )}

      •

      KM
      ${esc(
        km
      )}

      ${
        lowKm
          ? "• LOW KM"
          : ""
      }

      •

      ${esc(
        detailName
      )}

      ${
        color
          ? ` • ${esc(color)}`
          : ""
      }

    </div>

  </div>


</div>


</body>

</html>

`;

}


/* ============================================================
   WAIT FOR IMAGES
   ============================================================ */

async function waitForImages(
  page
) {

  await page.waitForFunction(

    () => {

      const images =
        Array.from(
          document.images
        );


      return images.every(
        (img) =>
          img.complete &&
          img.naturalWidth > 0
      );

    },

    undefined,

    {
      timeout:
        30000,
    }

  );

}


/* ============================================================
   RENDER COVER
   ============================================================ */

async function renderCover(
  browser,
  html
) {

  const context =
    await browser.newContext({

      viewport: {

        width:
          WIDTH,

        height:
          HEIGHT,

      },

      deviceScaleFactor:
        1,

      colorScheme:
        "light",

    });


  const page =
    await context.newPage();


  try {

    await page.setContent(
      html,
      {

        waitUntil:
          "networkidle",

        timeout:
          30000,

      }
    );


    await waitForImages(
      page
    );


    await sleep(
      500
    );


    const buffer =
      await page.screenshot({

        type:
          "jpeg",

        quality:
          95,

        clip: {

          x:
            0,

          y:
            0,

          width:
            WIDTH,

          height:
            HEIGHT,

        },

      });


    return buffer;


  } finally {

    await context.close();

  }

}


/* ============================================================
   SAFE FILENAME
   ============================================================ */

function safeFilename(
  value
) {

  return String(
    value ?? ""
  )

    .replace(
      /[^a-zA-Z0-9]+/g,
      "-"
    )

    .replace(
      /^-+|-+$/g,
      ""
    )

    .toUpperCase();

}


/* ============================================================
   PROCESS CAR
   ============================================================ */

async function processCar(
  browser,
  car,
  index,
  total
) {

  const label = [

    car.brand,

    car.model,

    car.variant,

    car.year,

  ]

    .filter(Boolean)

    .join(" ")

    .replace(
      /\s+/g,
      " "
    )

    .trim();


  console.log("");


  console.log(
    "================================================"
  );


  console.log(
    `[${index + 1}/${total}] ${label}`
  );


  console.log(
    `ID: ${car.id}`
  );


  const mainImageUrl =
    cleanText(
      car.cover_source_image_url
    );


  if (!mainImageUrl) {

    console.log(
      "⚠️ SKIP — cover_source_image_url kosong"
    );


    return {

      ok:
        false,

      skipped:
        true,

    };

  }


  const images =
    await getCarImages(
      car.id
    );


  console.log(
    `Foto ditemukan: ${images.length}`
  );


  const topPhotoUrls =
    getTopPhotoUrls(
      images
    );


  console.log(
    "Foto atas: DB Foto 2 + Foto 4 + Foto 5"
  );


  console.log(
    `Foto atas tersedia: ${topPhotoUrls.length}/3`
  );


  const lowKm =
    isLowKm(
      car
    );


  console.log(
    `LOW KM: ${
      lowKm
        ? "YES"
        : "NO"
    }`
  );


  console.log(
    `OTR CREDIT: ${formatPrice(
      car.credit_price
    )}`
  );


  console.log(
    `CASH: ${formatPrice(
      car.cash_price
    )}`
  );


  console.log(
    "Branding: Instagram + WhatsApp"
  );


  console.log(
    `Instagram: ${GARAGE_INSTAGRAM}`
  );


  console.log(
    `WhatsApp: ${GARAGE_PHONE}`
  );


  console.log(
    `Safe bottom target: ${SAFE_BOTTOM}px`
  );


  const html =
    buildHtml(
      car,
      mainImageUrl,
      topPhotoUrls
    );


  console.log(
    "Render 1080 x 1350..."
  );


  const jpeg =
    await renderCover(
      browser,
      html
    );


  const filename =

    `${String(
      index + 1
    ).padStart(
      3,
      "0"
    )}` +

    `__` +

    `${safeFilename(
      car.brand
    )}` +

    `-` +

    `${safeFilename(
      car.model
    )}` +

    `-` +

    `${car.year ?? ""}` +

    `.jpg`;


  const outputPath =
    path.join(
      OUTPUT_DIR,
      filename
    );


  await fs.writeFile(
    outputPath,
    jpeg
  );


  console.log(
    `✅ SAVED: ${outputPath}`
  );


  return {

    ok:
      true,

    skipped:
      false,

    outputPath,

  };

}


/* ============================================================
   MAIN
   ============================================================ */

async function main() {

  console.log("");


  console.log(
    "========================================================"
  );


  console.log(
    " GARAGE88 PREMIUM COVER — LOCAL PREVIEW"
  );


  console.log(
    "========================================================"
  );


  console.log(
    `Output : ${OUTPUT_DIR}`
  );


  console.log(
    `Start  : ${start}`
  );


  console.log(
    `Limit  : ${
      limit > 0
        ? limit
        : "SEMUA"
    }`
  );


  console.log(
    "Mode   : LOCAL ONLY"
  );


  console.log(
    "Upload : TIDAK"
  );


  console.log(
    "DB     : TIDAK DIUBAH"
  );


  console.log(
    "Top    : FOTO 2 + FOTO 4 + FOTO 5"
  );


  console.log(
    `Safe bottom : ${SAFE_BOTTOM}px`
  );


  console.log(
    "========================================================"
  );


  await fs.mkdir(
    OUTPUT_DIR,
    {
      recursive:
        true,
    }
  );


  const result =
    await getCars();


  console.log("");


  console.log(
    `READY dengan PhotoRoom: ${result.total}`
  );


  console.log(
    `Akan diproses: ${result.cars.length}`
  );


  if (
    result.cars.length === 0
  ) {

    console.log(
      "Tidak ada mobil."
    );

    return;

  }


  const browser =
    await chromium.launch({

      headless:
        true,

    });


  let success =
    0;


  let failed =
    0;


  let skipped =
    0;


  try {

    for (
      let i = 0;
      i < result.cars.length;
      i++
    ) {

      try {

        const output =
          await processCar(
            browser,
            result.cars[i],
            i,
            result.cars.length
          );


        if (
          output.ok
        ) {

          success++;

        } else if (
          output.skipped
        ) {

          skipped++;

        }


      } catch (
        error
      ) {

        failed++;


        console.log(
          "❌ FAILED"
        );


        console.log(
          error instanceof Error
            ? error.message
            : String(error)
        );

      }

    }


  } finally {

    await browser.close();

  }


  console.log("");


  console.log(
    "========================================================"
  );


  console.log(
    " SELESAI"
  );


  console.log(
    "========================================================"
  );


  console.log(
    `✅ Berhasil : ${success}`
  );


  console.log(
    `⚠️ Skip     : ${skipped}`
  );


  console.log(
    `❌ Gagal    : ${failed}`
  );


  console.log(
    `📁 Folder   : ${OUTPUT_DIR}`
  );


  console.log(
    "========================================================"
  );

}


/* ============================================================
   RUN
   ============================================================ */

main()
  .catch(
    (error) => {

      console.error("");


      console.error(
        "FATAL ERROR:"
      );


      console.error(
        error
      );


      process.exit(
        1
      );

    }
  );
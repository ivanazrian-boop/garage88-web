/**
 * Garage88 Premium Cover template ported from scripts/premium-cover.mjs.
 * Keeps the standalone MJS layout values and output style.
 */

type PremiumCoverCar = {
  id?: string;
  brand?: string | null;
  model?: string | null;
  variant?: string | null;
  year?: number | string | null;
  color?: string | null;
  fuel?: string | null;
  odometer?: number | null;
  credit_price?: number | null;
  cash_price?: number | null;
  dp?: number | null;
  cover_hero_title?: string | null;
  cover_source_image_url?: string | null;
};

const TOP_PHOTO_HEIGHT = 425;


/* ============================================================
   6. MANUAL LAYOUT CONTROLS — EDIT BAGIAN INI SAJA
   ============================================================

   Cara adjust:
   - Angka TOP makin besar = elemen makin TURUN.
   - Angka TOP makin kecil / negatif = elemen makin NAIK.
   - Font size makin besar = tulisan makin besar.
   - Nilai posisi dalam px.

   TITLE_TOP menggerakkan keseluruhan blok title + brand.
   TITLE_LONG/MEDIUM/SHORT_FONT_SIZE mengatur ukuran title
   berdasarkan panjang judul mobil.
   TITLE_LONG_TEXT_TOP menggeser teks title panjang relatif
   terhadap brand (tidak menggeser keseluruhan blok).

   Harga:
   PRICE_GROUP_TOP menggeser blok harga + DP/KM bersama.
   OTR_LABEL_TOP mengatur label OTR CREDIT.
   MAIN_PRICE_TOP dan CASH_TOP mengatur posisi masing-masing.
   DP/KM tampil besar di kolom kanan harga.
   ============================================================ */

// TITLE: seluruh blok brand + title
const TITLE_TOP = 300;

// TITLE: ukuran font manual sesuai panjang judul
const TITLE_FONT_SIZE = 90;          // judul pendek
const TITLE_LONG_FONT_SIZE = 60;     // judul sangat panjang (>38 karakter)
const TITLE_MEDIUM_FONT_SIZE = 60;   // judul >32 karakter
const TITLE_LARGE_FONT_SIZE = 75;    // judul >26 karakter
const TITLE_LONG_TEXT_TOP = 10;      // geser title panjang ke bawah

// Brand kecil di atas title
const BRAND_FONT_SIZE = 40;

// HERO IMAGE: seberapa jauh foto utama turun
const HERO_IMAGE_SHIFT_Y = 80;

// PRICE AREA: menggeser semua elemen harga bersamaan
const PRICE_GROUP_TOP = 30;

// OTR CREDIT: posisi dari atas area harga
const OTR_LABEL_TOP = 10;

// 145JT: posisi dan ukuran harga utama
const MAIN_PRICE_TOP = 0;
const MAIN_PRICE_FONT_SIZE = 75;

// Cash 158 JT: jarak dari harga utama
const CASH_TOP = 2;


/*
 * White outline tetap tipis.
 *
 * Tidak menggunakan stroke 10px lagi
 * supaya tidak flat / terlalu berat.
 */

const TITLE_STROKE = 15;

function cleanText(value: unknown) {
  return String(
    value ?? ""
  )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


function esc(value: unknown) {
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
   9. PRICE FORMAT
   ============================================================ */

function formatPrice(value: unknown) {

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


  /*
   * 1 Miliar ke atas
   *
   * 2,000,000,000
   * menjadi
   * 2 M
   */

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
          maximumFractionDigits: 2,
        }
      ) +
      "M"
    );
  }


  const juta =
    number /
    1_000_000;


  return (
    juta.toLocaleString(
      "id-ID",
      {
        maximumFractionDigits: 1,
      }
    ) +
    " JT"
  );
}


/* ============================================================
   10. KM FORMAT
   ============================================================ */

function formatKm(value: unknown) {

  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(
      Number(value)
    )
  ) {
    return "-";
  }


  const formatted = Math.round(
    Number(value)
  ).toLocaleString(
    "id-ID"
  );

  // Sembunyikan tiga digit terakhir odometer: 23.000 menjadi 23.XXX.
  // Berlaku untuk semua tampilan KM yang memakai formatKm().
  return formatted.replace(/\.\d{3}$/, ".XXX");
}


/* ============================================================
   11. LOW KM
   ============================================================ */

function getLowKmStatus(car: PremiumCoverCar) {

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
    !Number.isFinite(year) ||
    km <= 0 ||
    year <= 0
  ) {
    return null;
  }


  /*
   * LOW KM:
   *
   * < 100.000 KM
   * average < 10.000 KM / tahun
   */

  const currentYear =
    new Date().getFullYear();


  const elapsedYears =
    Math.max(
      1,
      currentYear - year
    );


  const averageKm =
    km /
    elapsedYears;


  if (
    km < 100_000 &&
    averageKm < 10_000
  ) {
    return "LOW KM";
  }


  /*
   * LOW USAGE KM:
   *
   * >= 100.000 KM
   * average < 10.000 KM / tahun
   */

  if (
    km >= 100_000 &&
    averageKm < 10_000
  ) {
    return "LOW USAGE KM";
  }


  return null;
}


/* ============================================================
   12. HERO TITLE
   ============================================================ */

function buildHeroTitle(
  car: PremiumCoverCar
) {

  /*
   * PRIORITAS:
   *
   * cover_hero_title
   * + year
   */

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

    /*
     * Kalau year sudah ada
     * di cover_hero_title,
     * jangan duplikasi.
     */

    const heroUpper =
      hero.toUpperCase();


    const yearUpper =
      year.toUpperCase();


    if (
      heroUpper.includes(
        yearUpper
      )
    ) {
      return heroUpper;
    }


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


  /*
   * FALLBACK
   */

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
   13. DETAIL TITLE
   ============================================================ */

/*
 * Tidak mengulang BRAND.
 *
 * Contoh:
 *
 * BRAND:
 * WULING
 *
 * DETAIL:
 * ALMAZ T LUX EX PANORAMIC WHITE 2019
 */

function buildDetailTitle(
  car: PremiumCoverCar
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
   14. INFO LINE
   ============================================================ */

function buildInfoLine(
  car: PremiumCoverCar,
  dp: string,
  km: string,
  detailTitle: string,
  color: string
) {

  const fuel =
    cleanText(
      car.fuel
    ).toUpperCase();


  const lowKm =
    getLowKmStatus(
      car
    );


  const parts = [];


  if (dp !== "-") {
    parts.push(
      `DP ${dp}`
    );
  }


  if (km !== "-") {
    parts.push(
      `KM ${km}`
    );
  }


  if (fuel) {
    parts.push(
      fuel
    );
  }


  if (detailTitle) {
    parts.push(
      detailTitle
    );
  }


  if (color) {
    parts.push(
      color
    );
  }


  if (lowKm) {
    parts.push(
      lowKm
    );
  }


  return parts
    .join(" • ")
    .toUpperCase();
}

export function getPremiumTopPhotoUrls(
  images: Array<{ image_url?: string | null }>
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


  if (
    urls.length === 0
  ) {
    return [];
  }


  /*
   * Prioritas utama:
   *
   * FOTO 2
   * FOTO 4
   * FOTO 5
   */

  const preferredIndexes = [
    1,
    3,
    4,
  ];


  const selected =
    preferredIndexes
      .map(
        (index) =>
          urls[index]
      )
      .filter(Boolean);


  /*
   * Kalau foto belum sampai 5,
   * isi kekurangan dari foto yang tersedia.
   */

  if (
    selected.length < 3
  ) {

    for (
      const url of urls
    ) {

      if (
        selected.length >= 3
      ) {
        break;
      }


      if (
        !selected.includes(
          url
        )
      ) {
        selected.push(
          url
        );
      }
    }
  }


  /*
   * Kalau cuma ada 1 foto,
   * duplicate untuk menjaga layout.
   */

  if (
    selected.length === 1
  ) {

    return [
      selected[0],
      selected[0],
      selected[0],
    ];
  }


  if (
    selected.length === 2
  ) {

    return [
      selected[0],
      selected[1],
      selected[0],
    ];
  }


  return selected.slice(
    0,
    3
  );
}

function instagramIcon() {

  return `
    <svg
      width="34"
      height="34"
      viewBox="0 0 34 34"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="5"
        y="5"
        width="24"
        height="24"
        rx="7"
        stroke="#111111"
        stroke-width="2.4"
      />

      <circle
        cx="17"
        cy="17"
        r="5.2"
        stroke="#111111"
        stroke-width="2.2"
      />

      <circle
        cx="24.1"
        cy="9.9"
        r="1.5"
        fill="#111111"
      />
    </svg>
  `;
}


function whatsappIcon() {

  return `
    <svg
      width="34"
      height="34"
      viewBox="0 0 34 34"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        cx="17"
        cy="17"
        r="12"
        stroke="#111111"
        stroke-width="2.2"
      />

      <path
        d="M11.5 23L12.8 19.4"
        stroke="#111111"
        stroke-width="2"
        stroke-linecap="round"
      />

      <path
        d="M12.7 19.4C11.9 18.1 11.5 16.9 11.5 15.7C11.5 12.3 14.2 9.8 17.5 9.8C20.9 9.8 23.6 12.5 23.6 15.8C23.6 19.1 20.9 21.8 17.5 21.8C16.2 21.8 15 21.4 14 20.8"
        stroke="#111111"
        stroke-width="1.9"
        stroke-linecap="round"
      />
    </svg>
  `;
}

export function buildPremiumCoverHtml(
  car: PremiumCoverCar,
  mainImageUrl: string,
  topPhotoUrls: string[]
) {

  const heroTitle =
    buildHeroTitle(
      car
    );


  const detailTitle =
    buildDetailTitle(
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


  const brand =
    cleanText(
      car.brand
    ).toUpperCase();


  const year =
    car.year ?? "";


  const lowKm =
    getLowKmStatus(
      car
    );


  const infoLine =
    buildInfoLine(
      car,
      dp,
      km,
      detailTitle,
      color
    );


  const photo1 =
    topPhotoUrls[0] ||
    mainImageUrl;


  const photo2 =
    topPhotoUrls[1] ||
    mainImageUrl;


  const photo3 =
    topPhotoUrls[2] ||
    mainImageUrl;


  /*
   * Untuk title panjang,
   * font sedikit diperkecil agar
   * tetap terlihat premium.
   */

  const titleSize =
    heroTitle.length > 38
      ? TITLE_LONG_FONT_SIZE
      : heroTitle.length > 32
        ? TITLE_MEDIUM_FONT_SIZE
        : heroTitle.length > 26
          ? TITLE_LARGE_FONT_SIZE
          : TITLE_FONT_SIZE;

  /*
   * Judul panjang yang pecah menjadi dua baris
   * diturunkan supaya baris pertama lebih banyak
   * berada di area putih, bukan menutup tiga foto atas.
   */
  const titleVerticalOffset =
    heroTitle.length > 26
      ? TITLE_LONG_TEXT_TOP
      : 0;


  /*
   * Primary price.
   *
   * Kalau credit ada:
   * OTR CREDIT = primary
   *
   * Kalau tidak:
   * CASH = primary
   */

  const hasCredit =
    credit !== "-";


  const primaryLabel =
    hasCredit
      ? "OTR CREDIT"
      : "CASH";


  const primaryPrice =
    (hasCredit ? credit : cash)
      .replace(/\s+JT$/, "JT");


  const secondaryCash =
    hasCredit &&
    cash !== "-"
      ? `Cash ${cash}`
      : "";


  return `

<!doctype html>

<html lang="id">

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="
    width=1080,
    height=1350
  "
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


body {

  margin:
    0;

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
    center 54%;

  /* Manual setting: HERO_IMAGE_SHIFT_Y di bagian controls. */
  transform:
    translateY(${HERO_IMAGE_SHIFT_Y}px);

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
    ${TOP_PHOTO_HEIGHT}px;

  z-index:
    10;

  overflow:
    hidden;

}


.top-photo {

  position:
    absolute;

  top:
    0;

  height:
    ${TOP_PHOTO_HEIGHT}px;

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
    center 54%;

}


/* ==========================================================
   TOP PHOTO FADE
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
    155px;

  background:
    linear-gradient(
      to bottom,

      rgba(255,255,255,0)
        0%,

      rgba(255,255,255,0.025)
        15%,

      rgba(255,255,255,0.08)
        30%,

      rgba(255,255,255,0.20)
        48%,

      rgba(255,255,255,0.42)
        66%,

      rgba(255,255,255,0.72)
        82%,

      rgba(255,255,255,0.93)
        94%,

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
    10px;

  z-index:
    20;

  background:
    linear-gradient(
      to bottom,

      rgba(255,255,255,1)
        0%,

      rgba(255,255,255,0.99)
        42%,

      rgba(255,255,255,0.90)
        65%,

      rgba(255,255,255,0.30)
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
   TOP HAZE
   ========================================================== */

/*
 * Hanya sampai batas top gallery.
 *
 * Tidak boleh turun ke foto hero.
 */

.top-haze {

  position:
    absolute;

  left:
    0;

  right:
    0;

  top:
    330px;

  height:
    95px;

  z-index:
    25;

  pointer-events:
    none;

  background:
    linear-gradient(
      to bottom,

      rgba(255,255,255,0)
        0%,

      rgba(255,255,255,0.08)
        25%,

      rgba(255,255,255,0.30)
        52%,

      rgba(255,255,255,0.70)
        78%,

      rgba(255,255,255,1)
        100%
    );

}


/* ==========================================================
   TITLE BLOCK
   ========================================================== */

.title-block {

  position:
    absolute;

  left:
    50%;

  top:
    ${TITLE_TOP}px;

  width:
    1000px;

  transform:
    translateX(-50%);

  z-index:
    40;

  text-align:
    center;

}


/* ==========================================================
   BRAND TITLE
   ========================================================== */

.brand-small {

  margin-bottom:
    7px;

  color:
    #ffffff;

  font-family:
    "Arial Black",
    Arial,
    Helvetica,
    sans-serif;

  font-size:
    ${BRAND_FONT_SIZE}px;

  line-height:
    1;

  font-weight:
    900;

  letter-spacing:
    -0.5px;

  text-transform:
    uppercase;

  -webkit-text-stroke:
    3px #111111;

  paint-order:
    stroke fill;

  text-shadow:
    0 2px 4px
    rgba(0,0,0,0.50);

}


/* ==========================================================
   MAIN HERO TITLE
   ========================================================== */

/*
 * IMPORTANT:
 *
 * Tetap:
 * BLACK FILL
 * WHITE OUTLINE
 *
 * Tidak dibuat putih full.
 */

.title {

  display:
    inline-block;

  position:
    relative;

  top:
    ${titleVerticalOffset}px;

  max-width:
    1000px;

  color:
    #080808;

  font-family:
    Impact,
    "Arial Black",
    Arial,
    Helvetica,
    sans-serif;

  font-size:
    ${titleSize}px;

  line-height:
    0.98;

  font-weight:
    900;

  font-style:
    italic;

  letter-spacing:
    -1.5px;

  text-align:
    center;

  text-transform:
    uppercase;

  -webkit-text-stroke:
    ${TITLE_STROKE}px #ffffff;

  paint-order:
    stroke fill;

  /* Bayangan luar hitam saja; tanpa highlight putih atau lapisan stroke hitam di dalam. */
  text-shadow:
    0 5px 10px
      rgba(0,0,0,0.38),

    0 10px 20px
      rgba(0,0,0,0.16);

}

/* ==========================================================
   MAIN PHOTO FADE
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
    485px;

  z-index:
    35;

  pointer-events:
    none;

  background:
    linear-gradient(
      to bottom,

      rgba(255,255,255,0)
        0%,

      rgba(255,255,255,0.025)
        15%,

      rgba(255,255,255,0.10)
        32%,

      rgba(255,255,255,0.24)
        49%,

      rgba(255,255,255,0.43)
        64%,

      rgba(255,255,255,0.66)
        79%,

      rgba(255,255,255,0.83)
        90%,

      rgba(255,255,255,0.93)
        100%
    );

}


/* ==========================================================
   BOTTOM AREA
   ========================================================== */

.bottom-area {

  position:
    absolute;

  left:
    65px;

  right:
    65px;

  top:
    985px;

  height:
    380px;

  z-index:
    50;

}


/* ==========================================================
   SPEC ROW
   ========================================================== */

/* Top DP/KM spec row removed; DP and KM remain in the bottom info line. */


.price-layout {

  position: relative;

  /* Manual setting: PRICE_GROUP_TOP menggeser harga + DP/KM bersama. */
  top: ${PRICE_GROUP_TOP}px;

  width: 100%;
  height: 165px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
}

.price-area {

  position: relative;
  top: 0;
  width: 50%;
  height: 165px;
  padding-right: 22px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  text-align: right;
  flex-shrink: 0;
}

/* DP dan KM besar di kolom kanan, mulai tepat setelah garis tengah. */
.dp-km-area {
  position: relative;
  width: 50%;
  height: 150px;
  padding-left: 22px;
  border-left: 2px solid rgba(40,40,40,0.24);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  gap: 10px;
  flex-shrink: 0;
}

/* Badge hanya memakai ruang di kanan kolom DP/KM saat LOW KM aktif. */
.dp-km-area.has-low-km {
  padding-right: 122px;
}

.dp-km-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  width: 100%;
}

.dp-km-label {
  color: #333333;
  font-family: "Arial Black", Arial, Helvetica, sans-serif;
  font-size: 16px;
  line-height: 1;
  font-weight: 900;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.dp-km-value {
  color: #080808;
  font-family: Impact, "Arial Black", Arial, Helvetica, sans-serif;
  font-size: 43px;
  line-height: 0.98;
  font-weight: 900;
  letter-spacing: -1.2px;
  white-space: nowrap;
}

.dp-km-value.km-value {
  font-size: 35px;
  letter-spacing: -0.6px;
}


/* ==========================================================
   PRICE LABEL
   ========================================================== */

.price-label {

  margin-top:
    ${OTR_LABEL_TOP}px;

  color:
    #080808;

  font-size:
    17px;

  line-height:
    1;

  font-weight:
    900;

  letter-spacing:
    0.4px;

  text-transform:
    uppercase;

}


/* ==========================================================
   PRICE WRAPPER + CONDITIONAL LOW KM BADGE
   ========================================================== */

.price-main-wrap {

  position: relative;

  width: max-content;

  margin-top: ${MAIN_PRICE_TOP}px;

}

.low-km-price-badge {

  position: absolute;

  right: 0;

  top: 50%;

  transform: translateY(-50%);

  min-width: 112px;

  height: 38px;

  padding: 0 12px;

  display: flex;

  align-items: center;

  justify-content: center;

  box-sizing: border-box;

  border-radius: 7px;

  background: #e12626;

  color: #ffffff;

  font-family: "Arial Black", Arial, Helvetica, sans-serif;

  font-size: 15px;

  line-height: 1;

  font-weight: 900;

  letter-spacing: -0.2px;

  text-transform: uppercase;

  white-space: nowrap;

  box-shadow: 0 4px 10px rgba(0,0,0,0.18);

}


/* ==========================================================
   MAIN PRICE
   ========================================================== */

/*
 * PRIMARY PRICE.
 *
 * Sangat besar.
 * Sangat bold.
 * Fokus utama cover.
 */

.price-main {

  margin-top:
    0;

  color:
    #080808;

  font-family:
    Impact,
    "Arial Black",
    Arial,
    Helvetica,
    sans-serif;

  /* Manual setting: MAIN_PRICE_FONT_SIZE di bagian controls. */
  font-size:
    ${MAIN_PRICE_FONT_SIZE}px;

  line-height:
    0.90;

  font-weight:
    900;

  font-style:
    normal;

  -webkit-text-stroke:
    1px #080808;

  letter-spacing:
    -2px;

  white-space:
    nowrap;

}


/* ==========================================================
   CASH
   ========================================================== */

.price-cash {

  margin-top:
    ${CASH_TOP}px;

  color:
    #555555;

  font-family:
    Impact,
    "Arial Black",
    Arial,
    Helvetica,
    sans-serif;

  font-size:
    25px;

  line-height:
    1;

  font-weight:
    900;

  letter-spacing:
    -0.8px;

  white-space:
    nowrap;

}


/* ==========================================================
   INFO LINE
   ========================================================== */

.info-line {

  position:
    absolute;

  left:
    0;

  right:
    0;

  top:
    200px;

  min-height:
    38px;

  display:
    flex;

  align-items:
    center;

  justify-content:
    center;

  padding:
    5px 10px;

  border-top:
    1px solid
    rgba(40,40,40,0.25);

  border-bottom:
    1px solid
    rgba(40,40,40,0.25);

  color:
    #222222;

  font-family:
    "Arial Black",
    Arial,
    Helvetica,
    sans-serif;

  font-size:
    18px;

  line-height:
    1.1;

  font-weight:
    900;

  letter-spacing:
    -0.25px;

  text-align:
    center;

  white-space:
    nowrap;

  overflow:
    hidden;

}


/* ==========================================================
   CONTACT ROW
   ========================================================== */

.contact-row {

  position:
    absolute;

  left:
    0;

  right:
    0;

  top:
    260px;

  height:
    58px;

  display:
    flex;

  align-items:
    center;

  justify-content:
    center;

}


/* ==========================================================
   CONTACT LINE
   ========================================================== */

.contact-line {

  position:
    absolute;

  left:
    0;

  right:
    0;

  top:
    50%;

  height:
    1px;

  background:
    rgba(40,40,40,0.24);

  transform:
    translateY(-50%);

}


/* ==========================================================
   CONTACT CONTENT
   ========================================================== */

.contact-content {

  position:
    relative;

  z-index:
    2;

  display:
    flex;

  align-items:
    center;

  justify-content:
    center;

  gap:
    24px;

  padding:
    0 28px;

  background:
    rgba(255,255,255,0.82);

  backdrop-filter:
    blur(2px);

}


/* ==========================================================
   CONTACT ITEM
   ========================================================== */

.contact-item {

  display:
    flex;

  align-items:
    center;

  gap:
    9px;

  color:
    #111111;

  font-family:
    "Arial Black",
    Arial,
    Helvetica,
    sans-serif;

  font-size:
    25px;

  line-height:
    1;

  font-weight:
    900;

  letter-spacing:
    -0.7px;

  white-space:
    nowrap;

}


/* ==========================================================
   CONTACT DIVIDER
   ========================================================== */

.contact-divider {

  width:
    1px;

  height:
    34px;

  background:
    rgba(40,40,40,0.25);

}


/* ==========================================================
   NO FOOTER
   ========================================================== */

/*
 * Footer lama sengaja dihapus.
 *
 * Info utama sudah ada di:
 * - info-line
 * - contact-row
 */


/* ==========================================================
   RESPONSIVE SAFETY
   ========================================================== */

@media (
  max-width: 1080px
) {

  html,
  body {

    width:
      1080px;

    height:
      1350px;

  }

}

</style>

</head>


<body>


<div class="poster">


  <!-- ======================================================
       MAIN PHOTO
       ====================================================== -->

  <div
    class="main-photo"
  >

    <img
      src="${esc(
        mainImageUrl
      )}"
      alt=""
    >

  </div>


  <!-- ======================================================
       TOP GALLERY
       ====================================================== -->

  <div
    class="top-gallery"
  >


    <!-- ====================================================
         PHOTO 1 = DB FOTO #2
         ==================================================== -->

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


    <!-- ====================================================
         PHOTO 2 = DB FOTO #4
         ==================================================== -->

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


    <!-- ====================================================
         PHOTO 3 = DB FOTO #5
         ==================================================== -->

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


    <!-- ====================================================
         DIAGONAL 1
         ==================================================== -->

    <div
      class="
        diagonal
        diagonal-one
      "
    ></div>


    <!-- ====================================================
         DIAGONAL 2
         ==================================================== -->

    <div
      class="
        diagonal
        diagonal-two
      "
    ></div>


    <!-- ====================================================
         TOP HAZE
         ==================================================== -->

    <div
      class="top-haze"
    ></div>


  </div>


  <!-- ======================================================
       TITLE
       ====================================================== -->

  <div
    class="title-block"
  >


    <!-- BRAND -->

    ${
      brand
        ? `
    <div
      class="brand-small"
    >
      ${esc(brand)}
    </div>
    `
        : ""
    }


    <!-- HERO TITLE -->

    <div
      class="title"
    >
      ${esc(
        heroTitle
      )}
    </div>


  </div>


  <!-- ======================================================
       MAIN PHOTO FADE
       ====================================================== -->

  <div
    class="
      main-bottom-fade
    "
  ></div>


  <!-- ======================================================
       BOTTOM AREA
       ====================================================== -->

  <div
    class="
      bottom-area
    "
  >


    <!-- ====================================================
         PRICE
         ==================================================== -->

    <div class="price-layout">

      <div class="price-area">

        <div class="price-label">
          ${esc(primaryLabel)}
        </div>

        <div class="price-main-wrap">
          <div class="price-main">
              ${esc(primaryPrice)}
          </div>
        </div>

        ${
          secondaryCash
            ? `
        <div class="price-cash">
          ${esc(secondaryCash)}
        </div>
        `
            : ""
        }

      </div>

      <div class="dp-km-area${lowKm ? " has-low-km" : ""}">
        <div class="dp-km-item">
          <div class="dp-km-label">DP MULAI</div>
          <div class="dp-km-value">${esc(dp === "-" ? "-" : dp.replace(/\s+JT$/, " JT"))}</div>
        </div>
        <div class="dp-km-item">
          <div class="dp-km-label">KM</div>
          <div class="dp-km-value km-value">${esc(km)}</div>
        </div>
        ${
          lowKm
            ? `
        <div class="low-km-price-badge">
          ${esc(lowKm)}
        </div>
        `
            : ""
        }
      </div>

    </div>


    <!-- ====================================================
         INFO LINE
         ==================================================== -->

    <div
      class="
        info-line
      "
    >
      ${esc(
        infoLine
      )}
    </div>


    <!-- ====================================================
         CONTACT
         ==================================================== -->

    <div
      class="
        contact-row
      "
    >

      <div
        class="
          contact-line
        "
      ></div>


      <div
        class="
          contact-content
        "
      >


        <!-- INSTAGRAM -->

        <div
          class="
            contact-item
          "
        >

          ${instagramIcon()}

          <span>
            garage88jakarta
          </span>

        </div>


        <!-- DIVIDER -->

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

          ${whatsappIcon()}

          <span>
            0813 8522 6049
          </span>

        </div>


      </div>

    </div>


  </div>


</div>


</body>

</html>

`;

}

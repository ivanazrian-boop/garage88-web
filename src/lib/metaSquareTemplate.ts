type MetaCoverCar = {
  brand?: string | null;
  model?: string | null;
  variant?: string | null;
  year?: number | null;
  color?: string | null;
  odometer?: number | null;
  credit_price?: number | null;
  cash_price?: number | null;
  dp?: number | null;

  cover_hero_title?:
    string | null;
};


/* =====================================================
   ESCAPE HTML
   ===================================================== */

function esc(
  value: unknown
): string {

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


/* =====================================================
   FORMAT
   ===================================================== */

function formatJt(
  value?: number | null
): string {

  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return "-";
  }


  const jt =
    value /
    1_000_000;


  return Number.isInteger(jt)
    ? `${jt}JT`
    : `${jt.toLocaleString(
        "id-ID",
        {
          maximumFractionDigits: 1,
        }
      )}JT`;
}


function formatKm(
  value?: number | null
): string {

  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return "-";
  }


  return Math.round(
    value
  ).toLocaleString(
    "id-ID"
  );
}


/* =====================================================
   CLEAN VARIANT FOR AUTO HERO
   ===================================================== */

function cleanVariantForHero(
  variant?: string | null
): string {

  const raw =
    String(
      variant ?? ""
    )
      .toUpperCase()
      .replace(
        /\s+/g,
        " "
      )
      .trim();


  if (!raw) {
    return "";
  }


  const removeTokens =
    new Set([
      "AT",
      "MT",
      "CVT",
      "DCT",
      "ATPM",
      "TSS",
      "FWD",
      "RWD",
      "AWD",
      "4X2",
      "4X4",

      "BLACK",
      "WHITE",
      "PUTIH",
      "HITAM",
      "SILVER",
      "GREY",
      "GRAY",
      "ABU",
      "MERAH",
      "BIRU",
    ]);


  const tokens =
    raw
      .split(
        /\s+/
      )
      .filter(Boolean)
      .filter(
        (token) =>
          !removeTokens.has(
            token
          )
      )
      .filter(
        (token) =>
          !/^\d(?:\.\d)?$/.test(
            token
          )
      );


  return tokens
    .join(" ")
    .trim();
}


/* =====================================================
   HERO TITLE
   ===================================================== */

function buildHeroTitle(
  car: MetaCoverCar
): string {

  const manualHero =
    String(
      car.cover_hero_title ??
      ""
    )
      .replace(
        /\s+/g,
        " "
      )
      .trim();


  if (manualHero) {

    return manualHero
      .toUpperCase();

  }


  const model =
    String(
      car.model ?? ""
    )
      .trim()
      .toUpperCase();


  const variant =
    cleanVariantForHero(
      car.variant
    );


  return [
    model,
    variant,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


/* =====================================================
   SPLIT HERO

   Kita balance berdasarkan panjang karakter.

   Contoh:

   IONIQ 5 SIGNATURE
   LONG RANGE

   ALPHARD G
   ATPM
   ===================================================== */

function splitHeroLines(
  title: string
) {

  const words =
    title
      .trim()
      .split(
        /\s+/
      )
      .filter(Boolean);


  if (
    words.length <= 1
  ) {

    return {
      line1:
        title,

      line2:
        "",

      lineCount:
        1,
    };

  }


  /*
   * Title pendek tetap satu baris.
   */

  if (
    title.length <= 11
  ) {

    return {
      line1:
        title,

      line2:
        "",

      lineCount:
        1,
    };

  }


  /*
   * Cari pembagian dua baris
   * yang paling seimbang.
   */

  let bestIndex =
    1;

  let bestScore =
    Infinity;


  for (
    let i = 1;
    i < words.length;
    i++
  ) {

    const a =
      words
        .slice(
          0,
          i
        )
        .join(" ");


    const b =
      words
        .slice(i)
        .join(" ");


    const score =
      Math.abs(
        a.length -
        b.length
      );


    if (
      score <
      bestScore
    ) {

      bestScore =
        score;

      bestIndex =
        i;

    }

  }


  const line1 =
    words
      .slice(
        0,
        bestIndex
      )
      .join(" ");


  const line2 =
    words
      .slice(
        bestIndex
      )
      .join(" ");


  return {
    line1,
    line2,
    lineCount:
      2,
  };
}


/* =====================================================
   HERO FONT SIZE

   Yang dihitung bukan hanya Hero,
   tapi line kedua + tahun juga.

   Jadi tidak overflow ke kanan.
   ===================================================== */

function getHeroFontSize(
  heroLines: {
    line1: string;
    line2: string;
    lineCount: number;
  },
  year: string
): number {

  const lastLine =
    heroLines.lineCount ===
    2
      ? [
          heroLines.line2,
          year,
        ]
          .filter(Boolean)
          .join(" ")
      : [
          heroLines.line1,
          year,
        ]
          .filter(Boolean)
          .join(" ");


  const longest =
    Math.max(
      heroLines.line1.length,
      lastLine.length
    );


  if (
    longest <= 10
  ) {
    return 94;
  }


  if (
    longest <= 14
  ) {
    return 86;
  }


  if (
    longest <= 18
  ) {
    return 78;
  }


  if (
    longest <= 22
  ) {
    return 70;
  }


  if (
    longest <= 27
  ) {
    return 63;
  }


  return 56;
}


/* =====================================================
   BUILD META COVER
   ===================================================== */

export function buildGarage88MetaSquareHtml(
  car: MetaCoverCar,
  sourceImageUrl: string
): string {

  const heroTitle =
    buildHeroTitle(
      car
    );


  const heroLines =
    splitHeroLines(
      heroTitle
    );


  const year =
    car.year
      ? String(
          car.year
        )
      : "";


  const heroFontSize =
    getHeroFontSize(
      heroLines,
      year
    );


  const credit =
    formatJt(
      car.credit_price
    );


  const km =
    formatKm(
      car.odometer
    );


  /*
   * PENTING:
   *
   * 1 BARIS:
   * hero sekitar 180
   * spec sekitar 300
   *
   * 2 BARIS:
   * hero naik sedikit
   * spec TURUN ke 365
   *
   * Ini yang memperbaiki overlap.
   */

  const headerTop =
    heroLines.lineCount ===
    2
      ? 150
      : 180;


  const specTop =
    heroLines.lineCount ===
    2
      ? 365
      : 300;


  const dividerTop =
    heroLines.lineCount ===
    2
      ? 420
      : 355;


  return `
<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8" />

<style>

  * {
    box-sizing: border-box;
  }


  html,
  body {
    margin: 0;
    padding: 0;
    width: 1080px;
    height: 1080px;
    overflow: hidden;
    background: #ffffff;
    font-family:
      Arial,
      Helvetica,
      sans-serif;
  }


  .cover {
    position: relative;
    width: 1080px;
    height: 1080px;
    overflow: hidden;
    background: #ffffff;
  }


  /* ===================================================
     PHOTOROOM SOURCE

     Crop square dari TOP,
     supaya logo bawaan PhotoRoom tetap ada.
     =================================================== */

  .source {
    position: absolute;
    inset: 0;

    width: 1080px;
    height: 1080px;

    object-fit: cover;
    object-position: center top;

    z-index: 1;
  }


  /* ===================================================
     HEADER
     =================================================== */

  .header-block {
    position: absolute;

    z-index: 5;

    top: ${headerTop}px;

    left: 58px;
    right: 58px;

    text-align: center;
  }


  .hero {
    width: 100%;

    font-family:
      "Arial Black",
      Arial,
      Helvetica,
      sans-serif;

    font-size:
      ${heroFontSize}px;

    font-weight: 900;

    line-height: .88;

    letter-spacing: -4px;

    color: #000000;

    text-transform: uppercase;
  }


  .hero-line {
    display: block;

    width: 100%;

    white-space: nowrap;

    text-align: center;
  }


  /*
   * Satu baris:
   *
   * ALPHARD G 2021
   */

  .hero-line-single {
    display: flex;

    align-items: baseline;
    justify-content: center;

    gap: 22px;

    white-space: nowrap;
  }


  /*
   * Dua baris:
   *
   * ALPHARD G
   * ATPM 2021
   *
   * Tahun SELALU ikut line terakhir.
   */

  .hero-line-bottom {
    display: flex;

    align-items: baseline;
    justify-content: center;

    gap: 22px;

    white-space: nowrap;

    margin-top: 4px;
  }


  .year-inline {
    display: inline-block;

    flex: 0 0 auto;

    font-family: inherit;

    font-size: 1em;

    font-weight: inherit;

    line-height: inherit;

    letter-spacing: inherit;

    color: #7f8ea3;

    white-space: nowrap;
  }


  /* ===================================================
     OTR + KM
     =================================================== */

  .spec-row {
    position: absolute;

    z-index: 6;

    top: ${specTop}px;

    left: 110px;
    right: 110px;

    height: 52px;

    display: flex;

    align-items: center;
    justify-content: center;

    gap: 55px;

    color: #111111;
  }


  .spec-item {
    display: flex;

    align-items: baseline;

    gap: 10px;

    white-space: nowrap;
  }


  .spec-label {
    font-size: 22px;

    font-weight: 800;

    color: #555555;

    line-height: 1;
  }


  .spec-value {
    font-size: 46px;

    font-weight: 900;

    line-height: 1;

    letter-spacing: -2px;

    color: #000000;
  }


  /* ===================================================
     DIVIDER
     =================================================== */

  .divider {
    position: absolute;

    z-index: 5;

    top: ${dividerTop}px;

    left: 170px;
    right: 170px;

    height: 1px;

    background:
      rgba(
        0,
        0,
        0,
        .17
      );
  }

</style>

</head>


<body>

  <div class="cover">


    <img
      class="source"
      src="${esc(sourceImageUrl)}"
    />


    <div class="header-block">

      <div class="hero">

        ${
          heroLines.lineCount === 2

            ? `

              <div class="hero-line">
                ${esc(heroLines.line1)}
              </div>


              <div class="hero-line hero-line-bottom">

                <span>
                  ${esc(heroLines.line2)}
                </span>

                ${
                  year
                    ? `
                      <span class="year-inline">
                        ${esc(year)}
                      </span>
                    `
                    : ""
                }

              </div>

            `

            : `

              <div class="hero-line hero-line-single">

                <span>
                  ${esc(heroLines.line1)}
                </span>

                ${
                  year
                    ? `
                      <span class="year-inline">
                        ${esc(year)}
                      </span>
                    `
                    : ""
                }

              </div>

            `
        }

      </div>

    </div>



    <div class="spec-row">

      <div class="spec-item">

        <span class="spec-label">
          OTR
        </span>

        <span class="spec-value">
          ${esc(credit)}
        </span>

      </div>


      <div class="spec-item">

        <span class="spec-label">
          KM
        </span>

        <span class="spec-value">
          ${esc(km)}
        </span>

      </div>

    </div>



    <div class="divider"></div>


  </div>

</body>

</html>
`;
}
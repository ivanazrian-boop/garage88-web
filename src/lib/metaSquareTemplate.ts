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
  cover_hero_title?: string | null;
};

function esc(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatJt(
  value?: number | null
): string | null {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return null;
  }

  const jt =
    value / 1_000_000;

  return Number.isInteger(jt)
    ? String(jt)
    : jt.toLocaleString(
        "id-ID",
        {
          maximumFractionDigits: 1,
        }
      );
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

  return Math.round(value)
    .toLocaleString("id-ID");
}

function cleanColorWords(
  raw: string
): string {
  const COLOR_WORDS =
    new Set([
      "HITAM",
      "PUTIH",
      "BLACK",
      "WHITE",
      "SILVER",
      "GREY",
      "GRAY",
      "ABU",
      "ABU-ABU",
      "MERAH",
      "RED",
      "BIRU",
      "BLUE",
      "COKLAT",
      "BROWN",
      "HIJAU",
      "GREEN",
      "GOLD",
      "KUNING",
      "YELLOW",
      "METALIK",
      "METALLIC",
    ]);

  return raw
    .split(/\s+/)
    .filter(
      (token) =>
        !COLOR_WORDS.has(token)
    )
    .join(" ")
    .trim();
}

function cleanVariantForHero(
  variant?: string | null
): string {
  const raw =
    cleanColorWords(
      String(variant ?? "")
        .trim()
        .toUpperCase()
    );

  if (!raw) {
    return "";
  }

  const REMOVE =
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
    ]);

  return raw
    .split(/\s+/)
    .filter((token) => {

      if (REMOVE.has(token)) {
        return false;
      }

      if (
        /^\d+(\.\d+)?$/.test(
          token
        )
      ) {
        return false;
      }

      return true;
    })
    .join(" ")
    .trim();
}

function buildHeroTitle(
  car: MetaCoverCar
): string {

  const manualHero =
    String(
      car.cover_hero_title ?? ""
    ).trim();

  if (manualHero) {
    return manualHero.toUpperCase();
  }


  const model =
    String(car.model ?? "")
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
    .trim();
}

function getHeroFontSize(
  title: string
): number {
  const length =
    title.length;

  if (length <= 10) {
    return 94;
  }

  if (length <= 16) {
    return 84;
  }

  if (length <= 24) {
    return 72;
  }

  if (length <= 30) {
    return 64;
  }

  return 56;
}

function splitHeroLines(
  title: string,
  year: string
): {
  html: string;
  lineCount: number;
} {
  const tokens =
    title
      .split(/\s+/)
      .filter(Boolean);

  /*
   * Judul pendek:
   *
   * CAMRY V 2021
   */
  if (
    tokens.length <= 2 ||
    title.length <= 14
  ) {
    return {
      html: `
        <span class="hero-line hero-line-bottom">

          <span>
            ${esc(title)}
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

        </span>
      `,
      lineCount: 1,
    };
  }

  /*
   * Judul panjang:
   *
   * IONIQ 5 SIGNATURE
   * LONG RANGE 2022
   */

  let bestIndex = 1;

  let bestDiff =
    Number.POSITIVE_INFINITY;

  for (
    let i = 1;
    i < tokens.length;
    i++
  ) {
    const left =
      tokens
        .slice(0, i)
        .join(" ");

    const right =
      tokens
        .slice(i)
        .join(" ");

    const diff =
      Math.abs(
        left.length -
        right.length
      );

    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = i;
    }
  }

  const line1 =
    tokens
      .slice(
        0,
        bestIndex
      )
      .join(" ");

  const line2 =
    tokens
      .slice(
        bestIndex
      )
      .join(" ");

  return {
    html: `
      <span class="hero-line">
        ${esc(line1)}
      </span>

      <span class="hero-line hero-line-bottom">

        <span>
          ${esc(line2)}
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

      </span>
    `,
    lineCount: 2,
  };
}

export function buildGarage88MetaSquareHtml(
  car: MetaCoverCar,
  sourceImageUrl: string
): string {
  const heroTitle =
    buildHeroTitle(car);

  const year =
    String(
      car.year ?? ""
    );

  const heroFontSize =
    getHeroFontSize(
      heroTitle
    );

  const heroLines =
    splitHeroLines(
      heroTitle,
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
   * Header sengaja mengikuti area atas
   * dari layout IG.
   */

  const headerTop =
    heroLines.lineCount === 2
      ? 155
      : 180;

  const specTop =
    heroLines.lineCount === 2
      ? 325
      : 290;

  return `
<!doctype html>

<html lang="id">

<head>

<meta charset="UTF-8" />

<meta
  name="viewport"
  content="width=1080, initial-scale=1"
/>

<style>

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html,
body {
  width: 1080px;
  height: 1080px;

  overflow: hidden;

  font-family:
    Arial,
    Helvetica,
    sans-serif;

  background: #f4f4f2;

  color: #111;
}

.poster {
  position: relative;

  width: 1080px;
  height: 1080px;

  overflow: hidden;

  background: #f4f4f2;
}


/* ==================================
   PHOTOROOM POLOS

   Source asli 1080 x 1350.

   Kita crop menjadi 1080 x 1080
   DARI ATAS supaya logo Garage88
   tetap ikut.
   ================================== */

.source {
  position: absolute;

  inset: 0;

  width: 1080px;
  height: 1080px;

  object-fit: cover;

  object-position:
    center top;

  z-index: 1;
}


/* ==================================
   HERO
   ================================== */

.header-block {
  position: absolute;

  z-index: 5;

  top: ${headerTop}px;

  left: 55px;
  right: 55px;

  text-align: center;
}

.hero {
  width: 100%;

  text-transform: uppercase;

  font-family:
    Arial Black,
    Arial,
    Helvetica,
    sans-serif;

  font-size:
    ${heroFontSize}px;

  font-weight: 1000;

  line-height: .9;

  letter-spacing: -3px;

  color: #050505;
}

.hero-line {
  display: block;
}

.hero-line-bottom {
  display: flex;

  align-items: baseline;

  justify-content: center;

  gap: 12px;

  margin-top: 3px;
}


/* Tahun sama besar.
   Hanya beda warna,
   sama seperti IG Cover.
*/

.year-inline {
  display: inline-block;

  font-family: inherit;

  font-size: 1em;

  font-weight: inherit;

  line-height: inherit;

  letter-spacing: inherit;

  color: #7f8ea3;

  white-space: nowrap;
}


/* ==================================
   OTR + KM
   ================================== */

.spec-bar {
  position: absolute;

  z-index: 6;

  top: ${specTop}px;

  left: 125px;
  right: 125px;

  height: 74px;

  display: flex;

  align-items: center;

  justify-content: center;

  gap: 34px;
}

.spec-item {
  display: flex;

  align-items: baseline;

  gap: 11px;
}

.spec-label {
  font-size: 23px;

  font-weight: 600;

  line-height: 1;

  color: #555;
}

.spec-value {
  font-family:
    Arial Black,
    Arial,
    Helvetica,
    sans-serif;

  font-size: 43px;

  font-weight: 1000;

  line-height: 1;

  letter-spacing: -1px;

  color: #080808;

  white-space: nowrap;
}

.spec-divider {
  width: 1px;

  height: 42px;

  background:
    rgba(0,0,0,.25);
}


/* ==================================
   SMALL DIVIDER
   ================================== */

.line {
  position: absolute;

  z-index: 5;

  top: ${specTop + 79}px;

  left: 170px;
  right: 170px;

  height: 1px;

  background:
    rgba(0,0,0,.14);
}

</style>

</head>


<body>


<div class="poster">


  <!-- PHOTOROOM -->

  <img
    class="source"
    src="${esc(sourceImageUrl)}"
    alt=""
  />


  <!-- HEADER -->

  <section class="header-block">

    <div class="hero">
      ${heroLines.html}
    </div>

  </section>


  <!-- OTR + KM -->

  <section class="spec-bar">


    <div class="spec-item">

      <span class="spec-label">
        OTR
      </span>

      <span class="spec-value">
        ${
          credit
            ? `${esc(credit)}JT`
            : "-"
        }
      </span>

    </div>



    <div class="spec-divider"></div>



    <div class="spec-item">

      <span class="spec-label">
        KM
      </span>

      <span class="spec-value">
        ${esc(km)}
      </span>

    </div>


  </section>


  <div class="line"></div>


</div>


</body>

</html>
`;
}
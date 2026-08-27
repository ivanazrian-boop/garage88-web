/* =====================================================
   GARAGE88 IG COVER
   1080 x 1350
   ===================================================== */

export type IgCoverCar = {
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

/* =====================================================
   ESCAPE HTML
   ===================================================== */

function esc(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* =====================================================
   NORMALIZE TEXT
   ===================================================== */

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

/* =====================================================
   PRICE FORMAT
   ===================================================== */

function formatPriceNumber(value?: number | null): string {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return "-";
  }

  const jt = value / 1_000_000;

  return Number.isInteger(jt)
    ? String(jt)
    : jt.toLocaleString("id-ID", {
        maximumFractionDigits: 1,
      });
}

/* =====================================================
   KM FORMAT
   ===================================================== */

function formatKm(value?: number | null): string {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return "-";
  }

  return Math.round(value).toLocaleString("id-ID");
}

/* =====================================================
   CLEAN VARIANT FOR HERO
   ===================================================== */

function cleanVariantForHero(value?: string | null): string {
  const raw = normalizeText(value).toUpperCase();

  if (!raw) {
    return "";
  }

  const removeTokens = new Set([
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
    "ABU-ABU",
    "MERAH",
    "BIRU",
    "COKLAT",
    "HIJAU",
    "KUNING",
    "PEARL",
    "METALLIC",
    "METALIK",
  ]);

  return raw
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !removeTokens.has(token))
    .filter((token) => !/^\d(?:\.\d)?$/.test(token))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/* =====================================================
   AUTO HERO
   ===================================================== */

export function buildGarage88AutoHeroTitle(
  car: IgCoverCar
): string {
  const model = normalizeText(car.model).toUpperCase();
  const variant = cleanVariantForHero(car.variant);

  return [model, variant]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/* =====================================================
   HERO TITLE
   ===================================================== */

function buildHeroTitle(car: IgCoverCar): string {
  const manualHero = normalizeText(car.cover_hero_title);

  if (manualHero) {
    return manualHero.toUpperCase();
  }

  return buildGarage88AutoHeroTitle(car);
}

/* =====================================================
   HERO LINE SPLITTER
   ===================================================== */

function splitHeroLines(title: string): {
  line1: string;
  line2: string;
  lineCount: 1 | 2;
} {
  const clean = normalizeText(title).toUpperCase();

  const words = clean.split(/\s+/).filter(Boolean);

  if (words.length <= 1 || clean.length <= 12) {
    return {
      line1: clean,
      line2: "",
      lineCount: 1,
    };
  }

  let bestIndex = 1;
  let bestScore = Infinity;

  for (let i = 1; i < words.length; i++) {
    const first = words.slice(0, i).join(" ");
    const second = words.slice(i).join(" ");

    const difference = Math.abs(first.length - second.length);
    const penalty = second.length > first.length + 6 ? 3 : 0;
    const score = difference + penalty;

    if (score < bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return {
    line1: words.slice(0, bestIndex).join(" "),
    line2: words.slice(bestIndex).join(" "),
    lineCount: 2,
  };
}

/* =====================================================
   HERO FONT SIZE
   ===================================================== */

function getHeroFontSize(
  heroLines: {
    line1: string;
    line2: string;
    lineCount: 1 | 2;
  },
  year: string
): number {
  const lastLine =
    heroLines.lineCount === 2
      ? [heroLines.line2, year].filter(Boolean).join(" ")
      : [heroLines.line1, year].filter(Boolean).join(" ");

  const longest = Math.max(
    heroLines.line1.length,
    lastLine.length
  );

  if (longest <= 10) return 116;
  if (longest <= 16) return 100;
  if (longest <= 24) return 84;
  if (longest <= 30) return 72;

  return 64;
}

/* =====================================================
   MILEAGE STATUS
   ===================================================== */

function getMileageStatus(car: IgCoverCar): string {
  if (
    !car.year ||
    car.odometer === null ||
    car.odometer === undefined ||
    !Number.isFinite(car.odometer)
  ) {
    return "";
  }

  const currentYear = new Date().getFullYear();
  const age = Math.max(1, currentYear - car.year);
  const average = car.odometer / age;

  if (average < 10_000 && car.odometer < 100_000) {
    return "LOW KM";
  }

  if (average < 10_000 && car.odometer >= 100_000) {
    return "LOW USAGE KM";
  }

  return "";
}

/* =====================================================
   FULL CAR NAME
   ===================================================== */

function buildFullName(car: IgCoverCar): string {
  return [
    normalizeText(car.model),
    normalizeText(car.variant),
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/* =====================================================
   IG COVER HTML
   ===================================================== */

export function buildGarage88IgCoverHtml(
  car: IgCoverCar,
  sourceImageUrl: string
): string {
  const heroTitle = buildHeroTitle(car);
  const heroLines = splitHeroLines(heroTitle);

  const year = car.year ? String(car.year) : "";

  const heroFontSize = getHeroFontSize(heroLines, year);

  const headerTop =
    heroLines.lineCount === 2 ? 190 : 215;

  const dp = formatPriceNumber(car.dp);
  const credit = formatPriceNumber(car.credit_price);
  const cash = formatPriceNumber(car.cash_price);
  const km = formatKm(car.odometer);

  const mileageStatus = getMileageStatus(car);
  const isLowUsage = mileageStatus === "LOW USAGE KM";

  const brand = normalizeText(car.brand).toUpperCase();
  const fullName = buildFullName(car);

  const fullNameWithYear = [fullName, year]
    .filter(Boolean)
    .join(" ");

  const color = normalizeText(car.color).toUpperCase();

  const footerItems = [
    car.credit_price ? `HARGA CREDIT ${credit} JT` : "",
    car.cash_price ? `HARGA CASH ${cash} JT` : "",
    car.dp ? `DP ${dp} JT` : "",
    car.odometer !== null && car.odometer !== undefined
      ? `KM ${km}`
      : "",
    mileageStatus,
  ].filter(Boolean);

  const footerTop = footerItems.join(" • ");

  const footerBottom = [
    brand,
    fullName,
    year,
    color,
  ]
    .filter(Boolean)
    .join(" • ");

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
    height: 1350px;
    overflow: hidden;
    background: #ffffff;
    font-family: Arial, Helvetica, sans-serif;
  }

  .cover {
    position: relative;
    width: 1080px;
    height: 1350px;
    overflow: hidden;
    background: #ffffff;
  }

  .source {
    position: absolute;
    inset: 0;
    width: 1080px;
    height: 1350px;
    object-fit: contain;
    z-index: 1;
  }

  /* ===================================================
     HERO
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
    font-family: "Arial Black", Arial, Helvetica, sans-serif;
    font-size: ${heroFontSize}px;
    font-weight: 900;
    line-height: .88;
    letter-spacing: -4px;
    color: #000000;
    text-transform: uppercase;
  }

  .hero-line {
    width: 100%;
    display: block;
    text-align: center;
    white-space: nowrap;
  }

  .hero-line-single {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 24px;
    white-space: nowrap;
  }

  .hero-line-bottom {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 24px;
    margin-top: 4px;
    white-space: nowrap;
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
     SPEC ROW
     =================================================== */

  .spec-row {
    position: absolute;
    z-index: 8;
    top: 958px;
    left: 78px;
    right: 78px;
    min-height: 82px;
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    align-items: center;
  }

  .spec-item {
    display: flex;
    align-items: center;
    gap: 14px;
    min-width: 0;
  }

  .spec-item + .spec-item {
    padding-left: 26px;
    border-left: 1px solid rgba(0, 0, 0, .22);
  }

  .spec-icon {
    flex: 0 0 auto;
    width: 52px;
    height: 52px;
    border: 2px solid rgba(0, 0, 0, .82);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #111111;
  }

  .spec-icon svg {
    width: 30px;
    height: 30px;
    display: block;
  }

  .spec-copy {
    min-width: 0;
  }

  .spec-label {
    margin-bottom: 2px;
    font-size: 18px;
    font-weight: 700;
    line-height: 1;
    color: #222222;
    white-space: nowrap;
  }

  .spec-value {
    font-size: 40px;
    font-weight: 900;
    line-height: 1;
    letter-spacing: -1px;
    color: #000000;
    white-space: nowrap;
  }

  .status-wrap {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-left: 24px;
  }

  .status-stack {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 52px;
    padding: 0 24px;
    border-radius: 15px;
    background: #111111;
    color: #ffffff;
    font-size: ${mileageStatus === "LOW USAGE KM" ? 22 : 27}px;
    font-weight: 900;
    line-height: 1;
    white-space: nowrap;
  }

  .status-subtext {
    margin-top: 5px;
    font-size: 12px;
    font-weight: 700;
    line-height: 1;
    color: #444444;
    white-space: nowrap;
    letter-spacing: .2px;
  }

  .status-empty {
    width: 1px;
    height: 1px;
  }

  /* ===================================================
     MAIN DIVIDER
     =================================================== */

  .main-divider {
    position: absolute;
    z-index: 8;
    top: 1048px;
    left: 66px;
    right: 66px;
    height: 1px;
    background: rgba(0, 0, 0, .20);
  }

  /* ===================================================
     BOTTOM GRID
     =================================================== */

  .bottom-grid {
    position: absolute;
    z-index: 8;
    left: 66px;
    right: 66px;
    top: 1060px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: 24px;
    align-items: start;
  }

  /* ===================================================
     PRICE LEFT
     =================================================== */

  .price-block {
    min-width: 0;
    padding-right: 8px;
  }

  .otr-label {
    font-size: 28px;
    font-weight: 900;
    line-height: 1;
    color: #111111;
    white-space: nowrap;
  }

  .otr-price {
    margin-top: 2px;
    display: flex;
    align-items: flex-end;
    white-space: nowrap;
  }

  .otr-number {
    font-family: "Arial Black", Arial, Helvetica, sans-serif;
    font-size: 90px;
    font-weight: 900;
    line-height: .74;
    letter-spacing: -1px;
    color: #000000;

    -webkit-text-stroke: 1.8px #000000;
  }

  .otr-jt {
    margin-left: 6px;
    padding-bottom: 3px;
    font-size: 50px;
    font-weight: 900;
    line-height: 1;
    letter-spacing: -2px;
    color: #000000;
    white-space: nowrap;
  }

  .cash {
    margin-top: 4px;
    font-size: 28px;
    font-weight: 500;
    line-height: 1;
    color: #555555;
    white-space: nowrap;
  }

  .cash strong {
    font-weight: 900;
    color: #111111;
  }

  /* ===================================================
     CAR INFO RIGHT
     =================================================== */

  .car-info {
    min-height: 150px;
    padding-left: 18px;
    border-left: 1px solid rgba(0, 0, 0, .23);
  }

  .car-brand {
    font-size: 30px;
    font-weight: 600;
    line-height: 1;
    color: #111111;
    text-transform: uppercase;
  }

  .car-name {
    margin-top: 7px;
    font-size: 34px;
    font-weight: 900;
    line-height: 1.06;
    color: #111111;
    text-transform: uppercase;
    -webkit-text-stroke: 1px #000;
  }

  .car-color {
    margin-top: 8px;
    font-size: 24px;
    font-weight: 600;
    line-height: 1;
    color: #444444;
    text-transform: uppercase;
  }

  /* ===================================================
     FOOTER
     =================================================== */

  .footer-divider {
    position: absolute;
    z-index: 8;
    left: 66px;
    right: 66px;
    bottom: 62px;
    height: 1px;
    background: rgba(0, 0, 0, .22);
  }

  .footer {
    position: absolute;
    z-index: 8;
    left: 44px;
    right: 44px;
    bottom: 10px;
    text-align: center;
    line-height: 1.25;
    color: #111111;
  }

  .footer-top {
    font-size: 16px;
    font-weight: 700;
    white-space: nowrap;
  }

  .footer-bottom {
    margin-top: 2px;
    font-size: 17px;
    font-weight: 750;
    white-space: nowrap;
  }

</style>
</head>

<body>
<div class="cover">
  <img
    class="source"
    src="${esc(sourceImageUrl)}"
    alt=""
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
              <span>${esc(heroLines.line2)}</span>
              ${
                year
                  ? `<span class="year-inline">${esc(year)}</span>`
                  : ""
              }
            </div>
          `
          : `
            <div class="hero-line hero-line-single">
              <span>${esc(heroLines.line1)}</span>
              ${
                year
                  ? `<span class="year-inline">${esc(year)}</span>`
                  : ""
              }
            </div>
          `
      }
    </div>
  </div>

  <div class="spec-row">
    <div class="spec-item">
      <div class="spec-icon">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M4 7.5h15a1.5 1.5 0 0 1 1.5 1.5v10H5.5A2.5 2.5 0 0 1 3 16.5V9a1.5 1.5 0 0 1 1-1.4" />
          <path d="M5 7.5 15 4.5c1.2-.35 2 .1 2.35 1.2L18 7.5" />
          <path d="M15 12.5h5.5v4H15a2 2 0 1 1 0-4Z" />
          <circle cx="16.5" cy="14.5" r=".6" fill="currentColor" stroke="none" />
        </svg>
      </div>

      <div class="spec-copy">
        <div class="spec-label">DP MULAI</div>
        <div class="spec-value">${esc(dp)}JT</div>
      </div>
    </div>

    <div class="spec-item">
      <div class="spec-icon">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M4 17a8 8 0 0 1 16 0" />
          <path d="M7 17h10" />
          <path d="m12 14 4-4" />
          <circle cx="12" cy="14" r="1" fill="currentColor" stroke="none" />
        </svg>
      </div>

      <div class="spec-copy">
        <div class="spec-label">KM</div>
        <div class="spec-value">${esc(km)}</div>
      </div>
    </div>

    <div class="status-wrap">
      ${
        mileageStatus
          ? `
            <div class="status-stack">
              <div class="status-badge">
                ${esc(mileageStatus)}
              </div>
              ${
                isLowUsage
                  ? `
                    <div class="status-subtext">
                      average &lt;10.000KM /YEAR
                    </div>
                  `
                  : ""
              }
            </div>
          `
          : `
            <div class="status-empty"></div>
          `
      }
    </div>
  </div>

  <div class="main-divider"></div>

  <div class="bottom-grid">
    <div class="price-block">
      <div class="otr-label">OTR</div>

      <div class="otr-price">
        <span class="otr-number">${esc(credit)}</span>
        <span class="otr-jt">JT</span>
      </div>

      ${
        car.cash_price
          ? `
            <div class="cash">
              Cash <strong>${esc(cash)}JT</strong>
            </div>
          `
          : ""
      }
    </div>

    <div class="car-info">
      <div class="car-brand">${esc(brand)}</div>

      <div class="car-name">
        ${esc(fullNameWithYear)}
      </div>

      ${
        color
          ? `
            <div class="car-color">
              ${esc(color)}
            </div>
          `
          : ""
      }
    </div>
  </div>

  <div class="footer-divider"></div>

  <div class="footer">
    <div class="footer-top">${esc(footerTop)}</div>
    <div class="footer-bottom">${esc(footerBottom)}</div>
  </div>
</div>
</body>
</html>
`;
}
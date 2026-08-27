type IgCoverCar = {
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

function getMileageStatus(
  car: IgCoverCar
): string {
  if (
    !car.year ||
    car.odometer === null ||
    car.odometer === undefined
  ) {
    return "";
  }

  const currentYear =
    new Date().getFullYear();

  const age =
    Math.max(
      1,
      currentYear - car.year
    );

  const average =
    car.odometer / age;

  if (
    average < 10_000 &&
    car.odometer < 100_000
  ) {
    return "LOW KM";
  }

  if (
    average < 10_000 &&
    car.odometer >= 100_000
  ) {
    return "LOW USAGE KM";
  }

  return "";
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
      if (
        REMOVE.has(token)
      ) {
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

function cleanVariantForSide(
  variant?: string | null
): string {
  return cleanColorWords(
    String(variant ?? "")
      .trim()
      .toUpperCase()
  );
}

export function buildGarage88AutoHeroTitle(
  car: IgCoverCar
): string {
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


function buildHeroTitle(
  car: IgCoverCar
): string {

  const manualHero =
    String(
      car.cover_hero_title ?? ""
    ).trim();

  if (manualHero) {
    return manualHero.toUpperCase();
  }

  return buildGarage88AutoHeroTitle(
    car
  );
}

function getHeroFontSize(
  title: string
): number {
  const length =
    title.length;

  if (length <= 10) {
    return 116;
  }

  if (length <= 16) {
    return 100;
  }

  if (length <= 24) {
    return 84;
  }

  if (length <= 30) {
    return 72;
  }

  return 64;
}

function splitHeroLines(
  title: string,
  year?: string
): {
  html: string;
  lineCount: number;
} {
  const tokens =
    title
      .split(/\s+/)
      .filter(Boolean);

  if (
    tokens.length <= 2 ||
    title.length <= 14
  ) {
    return {
      html: `
        <span class="hero-line">
          ${esc(title)}
        </span>

        ${
          year
            ? `
              <span class="hero-line hero-year-alone">
                ${esc(year)}
              </span>
            `
            : ""
        }
      `,
      lineCount:
        year ? 2 : 1,
    };
  }

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

    if (
      diff < bestDiff
    ) {
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

export function buildGarage88IgCoverHtml(
  car: IgCoverCar,
  sourceImageUrl: string
): string {
  const brand =
    String(
      car.brand ?? ""
    )
      .trim()
      .toUpperCase();

  const model =
    String(
      car.model ?? ""
    )
      .trim()
      .toUpperCase();

  const variantSide =
    cleanVariantForSide(
      car.variant
    );

  const year =
    String(
      car.year ?? ""
    );

  const color =
    String(
      car.color ?? ""
    )
      .trim()
      .toUpperCase();

  const heroTitle =
    buildHeroTitle(car);

  const heroFontSize =
    getHeroFontSize(
      heroTitle
    );

  const heroLines =
    splitHeroLines(
      heroTitle,
      year
    );

  const headerTop =
    heroLines.lineCount === 2
      ? 190
      : 215;

  const dp =
    formatJt(
      car.dp
    );

  const credit =
    formatJt(
      car.credit_price
    );

  const cash =
    formatJt(
      car.cash_price
    );

  const km =
    formatKm(
      car.odometer
    );

  const mileageStatus =
    getMileageStatus(
      car
    );

  const fullName =
    [
      model,
      variantSide,
    ]
      .filter(Boolean)
      .join(" ");

  const fullNameWithYear =
    [
      fullName,
      year,
    ]
      .filter(Boolean)
      .join(" ");

  const dpDisplay =
    dp
      ? `${dp}JT`
      : "-";

  const cashDisplay =
    cash
      ? `${cash}JT`
      : "-";

  const footerTop = [
    credit
      ? `HARGA CREDIT ${credit} JT`
      : "",

    cash
      ? `HARGA CASH ${cash} JT`
      : "",

    dp
      ? `DP ${dp} JT`
      : "",

    `KM ${km}`,

    mileageStatus || "-",
  ]
    .filter(Boolean)
    .join(" • ");

  const footerBottom = [
    brand,
    fullName,
    year,
    color,
  ]
    .filter(Boolean)
    .join(" • ");

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
  height: 1350px;

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
  height: 1350px;

  overflow: hidden;

  background: #f4f4f2;
}


/* ==============================
   PHOTOROOM IMAGE
   ============================== */

.source {
  position: absolute;

  inset: 0;

  width: 1080px;
  height: 1350px;

  object-fit: contain;

  z-index: 1;
}


/* ==============================
   HEADER
   ============================== */

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

  justify-content: center;

  align-items: baseline;

  gap: 13px;

  margin-top: 3px;
}

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

.hero-year-alone {
  display: block;

  margin-top: 8px;

  font-family:
    Arial Black,
    Arial,
    Helvetica,
    sans-serif;

  font-size: 80px;

  font-weight: 1000;

  line-height: .92;

  letter-spacing: -2px;

  color: #7f8ea3;
}


/* ==============================
   DP / KM / STATUS
   ============================== */

.spec-row {
  position: absolute;

  z-index: 8;

  top: 958px;

  left: 78px;
  right: 78px;

  height: 82px;

  display: grid;

  grid-template-columns:
    1fr
    1px
    1fr
    1px
    auto;

  align-items: center;

  column-gap: 26px;
}

.vline {
  width: 1px;

  height: 60px;

  background:
    rgba(0,0,0,.23);
}

.spec {
  display: flex;

  align-items: center;

  gap: 14px;
}

.spec-icon {
  width: 54px;
  height: 54px;

  flex: 0 0 auto;

  display: flex;

  align-items: center;
  justify-content: center;

  border:
    2px solid #111;

  border-radius: 16px;
}

.spec-icon svg {
  width: 29px;
  height: 29px;
}

.spec-copy {
  line-height: 1;
}

.spec-label {
  margin-bottom: 7px;

  font-size: 19px;

  font-weight: 500;

  letter-spacing: .1px;
}

.spec-value {
  font-size: 39px;

  font-weight: 900;

  line-height: .92;

  letter-spacing: -1px;

  white-space: nowrap;
}


/* ==============================
   LOW KM / LOW USAGE KM
   ============================== */

.low-km {
  min-height: 54px;

  padding:
    10px
    18px;

  border-radius: 16px;

  background: #111;

  color: #fff;

  display: flex;

  flex-direction: column;

  align-items: center;

  justify-content: center;

  gap: 5px;

  font-size:
    ${
      mileageStatus ===
      "LOW USAGE KM"
        ? 18
        : 25
    }px;

  font-weight: 900;

  line-height: 1;

  white-space: nowrap;
}

.low-km-note {
  display: block;

  font-size: 10px;

  font-weight: 500;

  line-height: 1;

  letter-spacing: .15px;

  color:
    rgba(
      255,
      255,
      255,
      .72
    );

  white-space: nowrap;
}


/* ==============================
   DIVIDER
   ============================== */

.main-divider {
  position: absolute;

  z-index: 8;

  top: 1048px;

  left: 66px;
  right: 66px;

  height: 1px;

  background:
    rgba(0,0,0,.24);
}


/* ==============================
   LOWER CONTENT
   ============================== */

.bottom-grid {
  position: absolute;

  z-index: 8;

  left: 66px;
  right: 66px;

  top: 1072px;

  display: grid;

  grid-template-columns:
    1fr
    1fr;

  column-gap: 34px;

  align-items: start;
}


/* ==============================
   OTR
   ============================== */

.price-area {
  min-width: 0;
}

.otr-label {
  margin-bottom: 8px;

  font-size: 28px;

  font-weight: 800;

  line-height: 1;
}

.otr {
  display: flex;

  align-items: baseline;

  line-height: .84;

  color: #050505;
}

.otr-number {
  font-family:
    Arial Black,
    Arial,
    Helvetica,
    sans-serif;

  font-size: 108px;

  font-weight: 1000;

  letter-spacing: -6px;
}

.otr-jt {
  margin-left: 6px;

  font-family:
    Arial Black,
    Arial,
    Helvetica,
    sans-serif;

  font-size: 50px;

  font-weight: 1000;

  letter-spacing: -2px;
}

.cash {
  margin-top: 20px;

  font-size: 28px;

  font-weight: 400;

  color: #555;
}

.cash strong {
  color: #111;

  font-weight: 900;
}


/* ==============================
   CAR INFO
   ============================== */

.car-info {
  min-width: 0;

  padding-left: 26px;

  border-left:
    1px solid
    rgba(0,0,0,.23);
}

.car-brand {
  margin-bottom: 12px;

  font-size: 34px;

  font-weight: 900;

  line-height: 1;
}

.car-name {
  font-size: 28px;

  font-weight: 750;

  line-height: 1.12;

  letter-spacing: -.3px;
}

.car-color {
  margin-top: 10px;

  font-size: 22px;

  font-weight: 600;

  line-height: 1.1;

  color: #444;

  text-transform: uppercase;
}


/* ==============================
   FOOTER
   ============================== */

.footer-divider {
  position: absolute;

  z-index: 8;

  left: 66px;
  right: 66px;

  bottom: 62px;

  height: 1px;

  background:
    rgba(0,0,0,.24);
}

.footer {
  position: absolute;

  z-index: 8;

  left: 44px;
  right: 44px;

  bottom: 10px;

  text-align: center;

  text-transform: uppercase;

  color: #111;

  line-height: 1.25;

  letter-spacing: 0;
}

.footer-top {
  font-size: 16px;

  font-weight: 700;
}

.footer-bottom {
  margin-top: 2px;

  font-size: 17px;

  font-weight: 750;
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


  <!-- DP / KM / LOW KM -->

  <section class="spec-row">


    <!-- DP -->

    <div class="spec">

      <div class="spec-icon">

        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.1"
        >

          <path
            d="M4 7h14a2 2 0 0 1 2 2v9H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z"
          />

          <path
            d="M5 7V5a2 2 0 0 1 2-2h10"
          />

          <path
            d="M15 11h5v4h-5a2 2 0 0 1 0-4Z"
          />

        </svg>

      </div>


      <div class="spec-copy">

        <div class="spec-label">
          DP MULAI
        </div>

        <div class="spec-value">
          ${esc(dpDisplay)}
        </div>

      </div>

    </div>



    <div class="vline"></div>



    <!-- KM -->

    <div class="spec">

      <div class="spec-icon">

        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.1"
        >

          <path
            d="M4 17a8 8 0 1 1 16 0"
          />

          <path
            d="M12 13l4-4"
          />

          <path
            d="M6 17h12"
          />

        </svg>

      </div>


      <div class="spec-copy">

        <div class="spec-label">
          KM
        </div>

        <div class="spec-value">
          ${esc(km)}
        </div>

      </div>

    </div>



    <div class="vline"></div>



    <!-- LOW KM / LOW USAGE KM -->

    <div class="low-km">

      <span>
        ${esc(
          mileageStatus || "-"
        )}
      </span>


      ${
        mileageStatus ===
        "LOW USAGE KM"
          ? `
            <span class="low-km-note">
              *average &lt;10.000KM /YEAR
            </span>
          `
          : ""
      }

    </div>


  </section>



  <div class="main-divider"></div>



  <!-- LOWER -->

  <section class="bottom-grid">


    <!-- OTR -->

    <div class="price-area">

      <div class="otr-label">
        OTR
      </div>


      <div class="otr">

        <span class="otr-number">
          ${esc(
            credit ?? "-"
          )}
        </span>


        ${
          credit
            ? `
              <span class="otr-jt">
                JT
              </span>
            `
            : ""
        }

      </div>


      <div class="cash">

        Cash

        <strong>
          ${esc(cashDisplay)}
        </strong>

      </div>

    </div>



    <!-- CAR INFO -->

    <div class="car-info">

      <div class="car-brand">
        ${esc(brand)}
      </div>


      <div class="car-name">
        ${esc(
          fullNameWithYear
        )}
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


  </section>



  <!-- FOOTER -->

  <div class="footer-divider"></div>


  <footer class="footer">

    <div class="footer-top">
      ${esc(footerTop)}
    </div>


    <div class="footer-bottom">
      ${esc(footerBottom)}
    </div>

  </footer>


</div>

</body>

</html>
`;
}
type CoverCar = {
  brand?: string | null;
  model?: string | null;
  variant?: string | null;
  year?: number | null;
  odometer?: number | null;
  credit_price?: number | null;
  cash_price?: number | null;
  dp?: number | null;
  cash_only?: boolean | null;
};

export type CoverFormat = "ig" | "meta";

function esc(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatJt(value?: number | null): string {
  if (!value) return "-";

  const jt = value / 1_000_000;

  return Number.isInteger(jt)
    ? String(jt)
    : jt.toLocaleString("id-ID", {
        maximumFractionDigits: 1,
      });
}

function formatPriceShort(
  value?: number | null
): {
  value: string;
  unit: string;
} {
  if (!value) {
    return {
      value: "-",
      unit: "",
    };
  }

  if (value >= 1_000_000_000) {
    const miliar =
      value / 1_000_000_000;

    return {
      value:
        miliar.toLocaleString(
          "id-ID",
          {
            maximumFractionDigits: 2,
          }
        ),
      unit: "M",
    };
  }

  const juta =
    value / 1_000_000;

  return {
    value:
      juta.toLocaleString(
        "id-ID",
        {
          maximumFractionDigits: 1,
        }
      ),
    unit: "JT",
  };
}

function formatKm(value?: number | null): string {
  if (!value) return "-";

  return `${Math.round(value / 1000)}RB`;
}

function splitVariant(
  variant?: string | null,
  year?: number | null
) {
  const raw = String(
    variant ?? ""
  )
    .trim()
    .toUpperCase();

  if (!raw) {
    return {
      primary: "",
      spec: String(year ?? ""),
    };
  }

  const tokens =
    raw.split(/\s+/);

  const specStart =
    tokens.findIndex((token) =>
      /^(4X2|4X4|AWD|FWD|RWD|AT|MT|CVT|DCT|HYBRID|DIESEL|BENSIN)$/.test(
        token
      )
    );

  if (specStart > 0) {
    return {
      primary:
        tokens
          .slice(0, specStart)
          .join(" "),

      spec:
        `${tokens
          .slice(specStart)
          .join(" ")} ${year ?? ""}`.trim(),
    };
  }

  return {
    primary: raw,
    spec: String(year ?? ""),
  };
}

export function buildGarage88CoverHtml(
  car: CoverCar,
  imageTopUrl: string,
  imageBottomUrl: string,
  format: CoverFormat
): string {
  const square =
    format === "meta";

  const height =
    square ? 1080 : 1350;

  const showMonetaryInfo =
    !square;

  const cashOnly =
    car.cash_only === true;

  const brand =
    String(
      car.brand ?? ""
    ).toUpperCase();

  const model =
    String(
      car.model ?? ""
    ).toUpperCase();

  const {
    primary,
    spec,
  } = splitVariant(
    car.variant,
    car.year
  );

  const credit =
    formatPriceShort(
      car.credit_price
    );

  const cash =
    formatPriceShort(
      car.cash_price
    );

  const dp =
    formatJt(
      car.dp
    );

  const km =
    formatKm(
      car.odometer
    );

  const mainPrice =
    cashOnly
      ? cash
      : credit;

  const mainPriceLabel =
    cashOnly
      ? "CASH ONLY"
      : square
        ? "OTR"
        : "HARGA KREDIT";

  const v =
    square
      ? {
          heroH: 680,
          heroOffsetY: -85,

          heroSeamTop: 555,
          heroSeamH: 175,

          secondaryTop: 565,
          secondaryW: 700,

          secondarySeamTop: 510,
          secondarySeamW: 820,
          secondarySeamH: 185,

          contentTop: 580,

          titleSize: 108,
          variantSize: 54,
          specSize: 29,

          pillSize: 22,

          priceSize: 102,
          jtSize: 42,

          footerH: 86,
          footerBottom: 20,

          footerPadY: 14,
          footerPadX: 16,

          iconSize: 36,

          metaLabel: 12,
          metaValue: 17,
        }
      : {
          heroH: 810,

          heroOffsetY: -25,

          heroSeamTop: 665,
          heroSeamH: 215,

          secondaryTop: 725,
          secondaryW: 812,

          secondarySeamTop: 600,
          secondarySeamW: 930,
          secondarySeamH: 200,

          contentTop: 605,

          titleSize: 124,
          variantSize: 66,
          specSize: 33,

          pillSize: 24,

          priceSize: 174,
          jtSize: 74,

          footerH: 102,
          footerBottom: 28,

          footerPadY: 18,
          footerPadX: 20,

          iconSize: 42,

          metaLabel: 14,
          metaValue: 24,
        };

  const variantNeedsTwoLines =
    square &&
    primary.length > 14;

  const contentTop =
    v.contentTop -
    (
      variantNeedsTwoLines
        ? 55
        : 0
    );

  return `<!doctype html>

<html lang="id">

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=1080, initial-scale=1"
>

<style>

*{
  box-sizing:border-box;
  margin:0;
  padding:0
}

html,
body{
  width:1080px;
  height:${height}px;
  overflow:hidden;
  background:#050505;
  font-family:Arial,Helvetica,sans-serif;
  color:#fff
}

.poster{
  position:relative;
  width:1080px;
  height:${height}px;
  overflow:hidden;

  background:
    radial-gradient(
      circle at 18% 62%,
      rgba(255,190,0,.10),
      transparent 26%
    ),
    radial-gradient(
      circle at 78% 84%,
      rgba(255,190,0,.05),
      transparent 22%
    ),
    #050505
}


/* =========================
   HERO PHOTO
   ========================= */

.hero-wrap{
  position:absolute;
  top:0;
  left:0;

  width:1080px;
  height:${v.heroH}px;

  z-index:1;

  overflow:hidden;

  -webkit-mask-image:
    linear-gradient(
      to bottom,
      #000 0%,
      #000 68%,
      rgba(0,0,0,.96) 76%,
      rgba(0,0,0,.76) 84%,
      rgba(0,0,0,.38) 93%,
      transparent 100%
    );

  mask-image:
    linear-gradient(
      to bottom,
      #000 0%,
      #000 68%,
      rgba(0,0,0,.96) 76%,
      rgba(0,0,0,.76) 84%,
      rgba(0,0,0,.38) 93%,
      transparent 100%
    )
}

.hero-wrap img{
  width:1080px;
  height:auto;

  display:block;

  transform:
    translateY(
      ${v.heroOffsetY}px
    );

  filter:
    contrast(1.05)
    saturate(1.03)
}

.hero-wrap:after{
  content:"";

  position:absolute;
  inset:0;

  pointer-events:none;

  background:
    radial-gradient(
      ellipse at center,
      transparent 46%,
      rgba(0,0,0,.08) 66%,
      rgba(0,0,0,.32) 100%
    ),
    linear-gradient(
      to right,
      rgba(0,0,0,.38) 0%,
      transparent 18%,
      transparent 84%,
      rgba(0,0,0,.22) 100%
    )
}

.hero-seam-blur{
  position:absolute;

  left:0;
  top:${v.heroSeamTop}px;

  width:1080px;
  height:${v.heroSeamH}px;

  z-index:3;

  pointer-events:none;

  backdrop-filter:
    blur(18px);

  -webkit-backdrop-filter:
    blur(18px);

  -webkit-mask-image:
    linear-gradient(
      to bottom,
      transparent 0%,
      rgba(0,0,0,.28) 18%,
      rgba(0,0,0,.85) 50%,
      rgba(0,0,0,.28) 82%,
      transparent 100%
    );

  mask-image:
    linear-gradient(
      to bottom,
      transparent 0%,
      rgba(0,0,0,.28) 18%,
      rgba(0,0,0,.85) 50%,
      rgba(0,0,0,.28) 82%,
      transparent 100%
    )
}


/* =========================
   SECOND PHOTO
   ========================= */

.secondary{
  position:absolute;

  right:0;
  top:${v.secondaryTop}px;

  width:${v.secondaryW}px;

  z-index:4;

  overflow:hidden;

  background:transparent
}

.secondary img{
  width:${v.secondaryW}px;
  height:auto;

  display:block;

  ${
    square
      ? ""
      : `
  translate:0 -41px;
  `
  }

  filter:
    contrast(1.04)
    saturate(1.02);

  -webkit-mask-image:
    linear-gradient(
      to bottom,
      transparent 0%,
      rgba(0,0,0,.18) 7%,
      rgba(0,0,0,.68) 17%,
      #000 29%,
      #000 100%
    );

  mask-image:
    linear-gradient(
      to bottom,
      transparent 0%,
      rgba(0,0,0,.18) 7%,
      rgba(0,0,0,.68) 17%,
      #000 29%,
      #000 100%
    )
}

.secondary:before{
  content:"";

  position:absolute;
  inset:0;

  z-index:2;

  pointer-events:none;

  background:
    linear-gradient(
      to right,
      rgba(5,5,5,.98) 0%,
      rgba(5,5,5,.88) 7%,
      rgba(5,5,5,.58) 15%,
      rgba(5,5,5,.22) 24%,
      rgba(5,5,5,0) 38%
    )
}

.secondary:after{
  content:"";

  position:absolute;
  inset:0;

  z-index:3;

  pointer-events:none;

  background:
    linear-gradient(
      to top,
      rgba(5,5,5,1) 0%,
      rgba(5,5,5,.92) 8%,
      rgba(5,5,5,.62) 18%,
      rgba(5,5,5,.24) 30%,
      rgba(5,5,5,0) 44%
    ),
    radial-gradient(
      ellipse at 72% 42%,
      transparent 50%,
      rgba(5,5,5,.08) 68%,
      rgba(5,5,5,.36) 88%,
      rgba(5,5,5,.68) 100%
    )
}

.secondary-seam-blur{
  position:absolute;

  right:0;
  top:${v.secondarySeamTop}px;

  width:${v.secondarySeamW}px;
  height:${v.secondarySeamH}px;

  z-index:6;

  pointer-events:none;

  backdrop-filter:
    blur(20px);

  -webkit-backdrop-filter:
    blur(20px);

  -webkit-mask-image:
    linear-gradient(
      to bottom,
      transparent 0%,
      rgba(0,0,0,.20) 14%,
      rgba(0,0,0,.82) 42%,
      #000 52%,
      rgba(0,0,0,.82) 64%,
      rgba(0,0,0,.20) 88%,
      transparent 100%
    );

  mask-image:
    linear-gradient(
      to bottom,
      transparent 0%,
      rgba(0,0,0,.20) 14%,
      rgba(0,0,0,.82) 42%,
      #000 52%,
      rgba(0,0,0,.82) 64%,
      rgba(0,0,0,.20) 88%,
      transparent 100%
    )
}


/* =========================
   INSTAGRAM HANDLE
   ========================= */

.handle{
  position:absolute;

  top:0;
  left:50%;

  transform:
    translateX(-50%);

  z-index:12;

  width:360px;
  height:66px;

  display:flex;

  align-items:center;
  justify-content:center;

  color:#0b0b0b;

  font-family:
    Arial Black,
    Arial,
    Helvetica,
    sans-serif;

  font-size:24px;
  font-weight:900;
  font-style:normal;

  letter-spacing:.1px;

  filter:
    drop-shadow(
      0 8px 12px
      rgba(0,0,0,.38)
    )
}

.handle svg{
  position:absolute;

  inset:0;

  width:100%;
  height:100%;

  z-index:-1
}

.handle span{
  position:relative;

  top:-2px;

  white-space:nowrap
}


/* =========================
   DARK PANEL
   ========================= */

.text-panel{
  position:absolute;

  left:0;

  top:
    ${square ? 515 : 635}px;

  width:
    ${square ? 390 : 430}px;

  height:
    ${square ? 405 : 470}px;

  z-index:8;

  pointer-events:none;

  ${
    square
      ? ""
      : `
  translate:-26px 4px;
  scale:1.2;
  `
  }

  background:
    radial-gradient(
      circle at 18% 35%,
      rgba(255,204,0,.10),
      transparent 38%
    ),
    linear-gradient(
      to right,
      rgba(5,5,5,1) 0%,
      rgba(5,5,5,.98) 62%,
      rgba(5,5,5,.82) 78%,
      rgba(5,5,5,.35) 92%,
      rgba(5,5,5,0) 100%
    );

  border-radius:
    0 24px 24px 0
}


/* =========================
   TEXT CONTENT
   ========================= */

.content{
  position:absolute;

  left:52px;
  top:${contentTop}px;

  width:570px;

  z-index:14;

  text-transform:
    uppercase
}

.brand{
  font-size:28px;

  font-weight:800;

  line-height:1;

  margin-bottom:8px;

  text-shadow:
    0 4px 12px
    rgba(0,0,0,.55)
}

.title-main{
  font-size:
    ${v.titleSize}px;

  line-height:.86;

  font-weight:1000;

  letter-spacing:-5px;

  color:#f3f3f3;

  text-shadow:
    0 4px 0 rgba(0,0,0,.20),
    0 12px 20px rgba(0,0,0,.72);

  margin-bottom:6px;

  max-width:570px;

  ${
    square
      ? ""
      : `
  translate:-143px -30px;
  scale:.5;
  `
  }
}

.variant{
  font-size:
    ${v.variantSize}px;

  line-height:.9;

  font-weight:1000;

  letter-spacing:-2px;

  color:#ffd21a;

  text-shadow:
    0 8px 18px
    rgba(0,0,0,.62);

  margin-bottom:6px;

  max-width:570px;

  ${
    square
      ? ""
      : `
  translate:2px -55px;
  `
  }
}

.spec{
  font-size:
    ${v.specSize}px;

  line-height:1;

  font-weight:900;

  letter-spacing:.5px;

  color:#f0f0f0;

  text-shadow:
    0 8px 18px
    rgba(0,0,0,.62);

  margin-bottom:18px;

  ${
    square
      ? ""
      : `
  translate:4px -42px;
  `
  }
}


/* =========================
   DP
   ========================= */

.dp-pill{
  display:inline-flex;

  align-items:center;

  gap:12px;

  padding:
    14px 24px;

  border-radius:
    999px;

  background:
    #ffd21a;

  color:
    #111;

  font-size:
    ${v.pillSize}px;

  font-weight:
    1000;

  line-height:
    1;

  box-shadow:
    0 10px 22px
    rgba(0,0,0,.28);

  margin-bottom:
    ${square ? 20 : 30}px;

  ${
    square
      ? ""
      : `
  translate:-7px -38px;
  `
  }
}

.dp-icon{
  width:22px;
  height:22px;

  border:
    3px solid #111;

  border-radius:
    4px;

  transform:
    rotate(45deg);

  position:
    relative;

  flex:
    0 0 auto
}

.dp-icon:after{
  content:"";

  position:absolute;

  width:5px;
  height:5px;

  border-radius:
    999px;

  background:
    #111;

  top:4px;
  left:4px
}


/* =========================
   PRICE
   ========================= */

.price-label{
  font-size:22px;

  font-weight:900;

  letter-spacing:.8px;

  margin-bottom:8px;

  text-shadow:
    0 4px 12px
    rgba(0,0,0,.6);

  ${
    square
      ? ""
      : `
  translate:2px -54px;
  `
  }
}

.price-value{
  font-size:
    ${v.priceSize}px;

  line-height:.82;

  font-weight:1000;

  letter-spacing:-10px;

  color:#ffd21a;

  text-shadow:
    0 4px 0 rgba(0,0,0,.18),
    0 10px 24px rgba(0,0,0,.7);

  ${
    square
      ? ""
      : `
  translate:-92px -79px;
  scale:.7;
  `
  }
}

.price-value .jt{
  font-size:
    ${v.jtSize}px;

  letter-spacing:
    -2px;

  margin-left:
    8px
}


/* =========================
   EFFECTS
   ========================= */

.glow{
  position:absolute;

  left:0;

  top:
    ${square ? 445 : 540}px;

  width:470px;

  height:
    ${square ? 450 : 550}px;

  z-index:2;

  pointer-events:none;

  background:
    radial-gradient(
      circle at 18% 38%,
      rgba(255,204,0,.20),
      transparent 58%
    );

  filter:
    blur(18px)
}

.global-vignette{
  position:absolute;

  inset:0;

  z-index:10;

  pointer-events:none;

  background:
    radial-gradient(
      ellipse at center,
      transparent 56%,
      rgba(0,0,0,.06) 72%,
      rgba(0,0,0,.22) 88%,
      rgba(0,0,0,.48) 100%
    )
}


/* =========================
   FOOTER
   ========================= */

.info-bar{
  position:absolute;

  left:36px;
  right:36px;

  bottom:
    ${v.footerBottom}px;

  height:
    ${v.footerH}px;

  z-index:16;

  display:grid;

  grid-template-columns:
    repeat(4,1fr);

  background:
    rgba(8,8,8,.64);

  border-radius:
    24px;

  border:
    1px solid
    rgba(255,255,255,.10);

  box-shadow:
    0 12px 30px
    rgba(0,0,0,.34);

  backdrop-filter:
    blur(10px);

  -webkit-backdrop-filter:
    blur(10px);

  overflow:hidden;

  ${
    square
      ? ""
      : `
  translate:0 1px;
  scale:.88;
  `
  }
}

.info-item{
  display:flex;

  align-items:center;

  gap:14px;

  padding:
    ${v.footerPadY}px
    ${v.footerPadX}px;

  position:relative
}

.info-item:not(:last-child):after{
  content:"";

  position:absolute;

  right:0;

  top:20px;
  bottom:20px;

  width:1px;

  background:
    rgba(255,255,255,.14)
}

.icon{
  width:
    ${v.iconSize}px;

  height:
    ${v.iconSize}px;

  border-radius:
    999px;

  border:
    2px solid #d8ae00;

  color:
    #ffd21a;

  display:flex;

  align-items:center;
  justify-content:center;

  font-weight:
    900;

  font-size:
    ${square ? 13 : 15}px;

  flex:
    0 0 auto
}

.meta .label{
  font-size:
    ${v.metaLabel}px;

  font-weight:
    700;

  letter-spacing:
    .5px;

  opacity:
    .92;

  margin-bottom:
    4px;

  text-transform:
    uppercase
}

.meta .value{
  font-size:
    ${v.metaValue}px;

  font-weight:
    1000;

  line-height:
    1.05;

  color:
    #ffd21a;

  text-transform:
    uppercase;

  white-space:
    nowrap
}

</style>

</head>


<body>

<div class="poster">

  <div class="hero-wrap">
    <img
      src="${esc(imageTopUrl)}"
      alt=""
    >
  </div>

  <div class="hero-seam-blur"></div>

  <div class="glow"></div>

  <div class="secondary">
    <img
      src="${esc(imageBottomUrl)}"
      alt=""
    >
  </div>

  <div class="secondary-seam-blur"></div>

  <div class="global-vignette"></div>

  <div class="text-panel"></div>


  <div class="handle">

    <svg
      viewBox="0 0 360 66"
      preserveAspectRatio="none"
      aria-hidden="true"
    >

      <path
        d="M0 0 H360 L338 48 Q334 62 318 62 H42 Q26 62 22 48 Z"
        fill="#ffd21a"
      />

      <path
        d="M23 48 Q28 59 42 59 H318 Q332 59 337 48"
        fill="none"
        stroke="rgba(0,0,0,.16)"
        stroke-width="3"
      />

    </svg>

    <span>
      @garage88jakarta
    </span>

  </div>


  <section class="content">

    <div class="brand">
      ${esc(brand)}
    </div>

    <div class="title-main">
      ${esc(model)}
    </div>

    ${
      primary
        ? `
    <div class="variant">
      ${esc(primary)}
    </div>
    `
        : ""
    }

    <div class="spec">
      ${esc(spec)}
    </div>


    ${
      showMonetaryInfo
        ? `

    <div class="dp-pill">

      <span class="dp-icon"></span>

      <span>
        ${
          cashOnly
            ? `CASH ONLY - KM ${esc(km)}`
            : `DP MULAI ${esc(dp)} JT - KM ${esc(km)}`
        }
      </span>

    </div>


    <div class="price-label">
      ${esc(mainPriceLabel)}
    </div>

    <div class="price-value">
      ${esc(mainPrice.value)}
      ${
        mainPrice.unit
          ? `
      <span class="jt">
        ${esc(mainPrice.unit)}
      </span>
      `
          : ""
      }
    </div>

    `
        : mainPrice.value !== "-"
          ? `

    <div class="price-label">
      ${esc(mainPriceLabel)}
    </div>

    <div class="price-value">
      ${esc(mainPrice.value)}
      ${
        mainPrice.unit
          ? `
      <span class="jt">
        ${esc(mainPrice.unit)}
      </span>
      `
          : ""
      }
    </div>

    `
          : ""
    }

  </section>


  ${
    showMonetaryInfo
      ? `

  <section class="info-bar">

    <div class="info-item">

      <div class="icon">
        Rp
      </div>

      <div class="meta">

        <div class="label">
          Harga Kredit
        </div>

        <div class="value">
          ${
            cashOnly
              ? "-"
              : `${esc(credit.value)} ${esc(credit.unit)}`
          }
        </div>

      </div>

    </div>


    <div class="info-item">

      <div class="icon">
        Rp
      </div>

      <div class="meta">

        <div class="label">
          Harga Cash
        </div>

        <div class="value">
          ${esc(cash.value)}
          ${esc(cash.unit)}
        </div>

      </div>

    </div>


    <div class="info-item">

      <div class="icon">
        DP
      </div>

      <div class="meta">

        <div class="label">
          DP Mulai Dari
        </div>

        <div class="value">
          ${
            cashOnly
              ? "-"
              : `${esc(dp)} JT`
          }
        </div>

      </div>

    </div>


    <div class="info-item">

      <div class="icon">
        KM
      </div>

      <div class="meta">

        <div class="label">
          KM
        </div>

        <div class="value">
          ${esc(km)}
        </div>

      </div>

    </div>

  </section>

  `
      : ""
  }

</div>

</body>

</html>`;
}
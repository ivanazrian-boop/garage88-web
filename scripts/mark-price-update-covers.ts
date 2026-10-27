import { createClient } from "@supabase/supabase-js";
import { loadEnvFile } from "node:process";

/* =====================================================
   ENV
   ===================================================== */

function tryLoadEnv(file: string) {
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
  throw new Error("SUPABASE_URL tidak ditemukan.");
}

if (!SUPABASE_SERVICE_KEY) {
  throw new Error("SUPABASE_SERVICE_KEY tidak ditemukan.");
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
   TYPES
   ===================================================== */

type CarRow = {
  id: string;
  brand: string | null;
  model: string | null;
  variant: string | null;
  year: number | null;
  credit_price: number | null;
  status: string | null;
  cover_needs_regenerate: boolean | null;
};

type Target = {
  label: string;
  year: number;
  keywords: string[];
  exclude?: string[];
};

/* =====================================================
   TARGETS

   TIDAK ADA UPDATE HARGA.
   HANYA CARI UNIT & SET COVER PENDING.

   Kalau ada 2 unit yang match:
   → dua-duanya dibuat pending.

   ===================================================== */

const targets: Target[] = [

  // CR-V
  {
    label: "CR-V 2.0 2019",
    year: 2019,
    keywords: ["CRV", "2.0"],
  },

  {
    label: "CR-V 2.0 2021",
    year: 2021,
    keywords: ["CRV", "2.0"],
  },

  {
    label: "CR-V 2.4 Prestige 2016",
    year: 2016,
    keywords: ["CRV", "2.4", "PRESTIGE"],
  },


  // HR-V
  {
    label: "HR-V Prestige 2018",
    year: 2018,
    keywords: ["HRV", "PRESTIGE"],
  },

  {
    label: "HR-V Prestige 2017",
    year: 2017,
    keywords: ["HRV", "PRESTIGE"],
  },


  // STARGAZER
  {
    label: "Stargazer X Prime 2023",
    year: 2023,
    keywords: ["STARGAZER", "X", "PRIME"],
  },

  {
    label: "Stargazer Prime 2023",
    year: 2023,
    keywords: ["STARGAZER", "PRIME"],
    exclude: ["X PRIME"],
  },


  // MITSUBISHI
  {
    label: "Xpander Ultimate 2022",
    year: 2022,
    keywords: ["XPANDER", "ULTIMATE"],
  },

  {
    label: "Outlander PX 2017",
    year: 2017,
    keywords: ["OUTLANDER", "PX"],
  },

  {
    label: "Pajero Dakar 2017",
    year: 2017,
    keywords: ["PAJERO", "DAKAR"],
  },


  // HONDA
  {
    label: "Honda City E 2017",
    year: 2017,
    keywords: ["CITY", "E"],
  },

  {
    label: "Honda City HB RS 2021",
    year: 2021,
    keywords: ["CITY", "RS"],
  },

  {
    label: "Honda Freed 2012",
    year: 2012,
    keywords: ["FREED"],
  },

  {
    label: "Honda Jazz RS 2019",
    year: 2019,
    keywords: ["JAZZ", "RS"],
  },

  {
    label: "Honda Brio E 2024",
    year: 2024,
    keywords: ["BRIO", "E"],
  },

  {
    label: "Honda Mobilio RS 2018",
    year: 2018,
    keywords: ["MOBILIO", "RS"],
  },


  // TOYOTA
  {
    label: "Yaris GR 2022",
    year: 2022,
    keywords: ["YARIS", "GR"],
  },

  {
    label: "Avanza/Veloz Q TSS 2022",
    year: 2022,
    keywords: ["VELOZ", "Q", "TSS"],
  },

  {
    label: "Fortuner 2.7 TRD 2014",
    year: 2014,
    keywords: ["FORTUNER", "2.7", "TRD"],
  },

  {
    label: "Vios G 2021",
    year: 2021,
    keywords: ["VIOS", "G"],
  },

  {
    label: "Innova Venturer 2.4 2022",
    year: 2022,
    keywords: ["VENTURER", "2.4"],
  },

  {
    label: "Zenix V Hybrid 2023",
    year: 2023,
    keywords: ["ZENIX", "V", "HYBRID"],
  },


  // WULING
  {
    label: "Alvez EX 2023",
    year: 2023,
    keywords: ["ALVEZ", "EX"],
  },

  {
    label: "Almaz RS Pro 2022",
    year: 2022,
    keywords: ["ALMAZ", "RS", "PRO"],
  },


  // MAZDA
  {
    label: "Mazda CX-3 GT 2018",
    year: 2018,
    keywords: ["CX3", "GT"],
  },

];

/* =====================================================
   NORMALIZE
   ===================================================== */

function normalize(value: unknown) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/-/g, "")
    .replace(/[^A-Z0-9.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function carText(car: CarRow) {
  return normalize(
    [
      car.brand,
      car.model,
      car.variant,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

/* =====================================================
   MATCH
   ===================================================== */

function isMatch(
  car: CarRow,
  target: Target
) {

  if (car.year !== target.year) {
    return false;
  }

  const text = carText(car);

  const includeOK =
    target.keywords.every(
      keyword =>
        text.includes(
          normalize(keyword)
        )
    );

  if (!includeOK) {
    return false;
  }

  const excluded =
    (target.exclude ?? []).some(
      keyword =>
        text.includes(
          normalize(keyword)
        )
    );

  return !excluded;
}

/* =====================================================
   MAIN
   ===================================================== */

async function main() {

  console.log("");
  console.log(
    "GARAGE88 — FLEXIBLE COVER PENDING"
  );

  console.log(
    "=================================="
  );

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
        credit_price,
        status,
        cover_needs_regenerate
      `)
      .eq("status", "READY");

  if (error) {
    throw new Error(
      error.message
    );
  }

  const cars =
    (data ?? []) as CarRow[];

  console.log(
    `READY database : ${cars.length}`
  );

  console.log(
    `Target rules   : ${targets.length}`
  );

  console.log("");

  /*
   * Pakai Set supaya satu unit yang match
   * beberapa rule tidak diproses dua kali.
   */

  const matchedIds =
    new Set<string>();

  let noMatch = 0;

  for (const target of targets) {

    const matches =
      cars.filter(
        car =>
          isMatch(
            car,
            target
          )
      );

    console.log(
      `▶ ${target.label}`
    );

    if (matches.length === 0) {

      console.log(
        "  ⚠️ Tidak ditemukan"
      );

      noMatch++;

      console.log("");

      continue;
    }

    console.log(
      `  Ditemukan: ${matches.length}`
    );

    for (const car of matches) {

      matchedIds.add(
        car.id
      );

      const price =
        car.credit_price
          ? `${Math.round(
              car.credit_price /
              1_000_000
            )}JT`
          : "-";

      console.log(
        `  ✓ ${carText(car)} | ${car.year} | ${price}`
      );
    }

    console.log("");
  }

  /* ===================================================
     MARK PENDING
     =================================================== */

  const carsToMark =
    cars.filter(
      car =>
        matchedIds.has(
          car.id
        )
    );

  console.log(
    "=================================="
  );

  console.log(
    `UNIQUE UNIT MATCH: ${carsToMark.length}`
  );

  console.log(
    "=================================="
  );

  console.log("");

  let success = 0;
  let failed = 0;

  for (const car of carsToMark) {

    const {
      error: updateError,
    } =
      await supabase
        .from("cars")
        .update({
          cover_needs_regenerate:
            true,
        })
        .eq(
          "id",
          car.id
        );

    if (updateError) {

      failed++;

      console.log(
        `❌ ${carText(car)}`
      );

      console.log(
        `   ${updateError.message}`
      );

      continue;
    }

    success++;

    console.log(
      `✅ PENDING — ${carText(car)} ${car.year}`
    );
  }

  console.log("");
  console.log(
    "=================================="
  );

  console.log(
    `✅ Pending       : ${success}`
  );

  console.log(
    `⚠️ Rule no match : ${noMatch}`
  );

  console.log(
    `❌ Failed        : ${failed}`
  );

  console.log(
    "=================================="
  );

  console.log("");
  console.log(
    "Harga / credit_price TIDAK diubah."
  );

  console.log("");
}

main()
  .catch(
    error => {

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
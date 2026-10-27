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
   TYPE
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
  price: number;
  mustInclude: string[];
  mustNotInclude?: string[];
};

/* =====================================================
   TARGET UNIT
   Harga di bawah HANYA untuk matching.
   TIDAK akan diubah.
   Pakai OTR WEBSITE SAAT INI.
   ===================================================== */

const targets: Target[] = [

  // KEBAYORAN
  {
    label: "CR-V 2.0 2019 — Kebayoran",
    year: 2019,
    price: 240_000_000,
    mustInclude: ["CRV", "2.0"],
  },
  {
    label: "Stargazer X Prime 2023 — Kebayoran",
    year: 2023,
    price: 230_000_000,
    mustInclude: ["STARGAZER", "X", "PRIME"],
  },
  {
    label: "Xpander Ultimate 2022 — Kebayoran",
    year: 2022,
    price: 235_000_000,
    mustInclude: ["XPANDER", "ULTIMATE"],
  },

  // CIATER
  {
    label: "Honda City E Facelift 2017 — Ciater",
    year: 2017,
    price: 168_000_000,
    mustInclude: ["CITY", "E"],
  },
  {
    label: "Honda Freed 2012 — Ciater",
    year: 2012,
    price: 115_000_000,
    mustInclude: ["FREED"],
  },
  {
    label: "Honda Jazz RS 2019 — Ciater",
    year: 2019,
    price: 220_000_000,
    mustInclude: ["JAZZ", "RS"],
  },
  {
    label: "Stargazer Prime 2023 — Ciater",
    year: 2023,
    price: 190_000_000,
    mustInclude: ["STARGAZER", "PRIME"],
    mustNotInclude: ["X PRIME"],
  },
  {
    label: "Stargazer X Prime 2023 — Ciater",
    year: 2023,
    price: 225_000_000,
    mustInclude: ["STARGAZER", "X", "PRIME"],
  },
  {
    label: "Outlander PX 2017 — Ciater",
    year: 2017,
    price: 162_000_000,
    mustInclude: ["OUTLANDER", "PX"],
  },
  {
    label: "Yaris GR 2022 — Ciater",
    year: 2022,
    price: 195_000_000,
    mustInclude: ["YARIS", "GR"],
  },
  {
    label: "Wuling Alvez EX 2023 — Ciater",
    year: 2023,
    price: 178_000_000,
    mustInclude: ["ALVEZ", "EX"],
  },

  // BASURA
  {
    label: "CR-V 2.0 2021 — Basura",
    year: 2021,
    price: 270_000_000,
    mustInclude: ["CRV", "2.0"],
  },
  {
    label: "HR-V Prestige 2018 — Basura",
    year: 2018,
    price: 215_000_000,
    mustInclude: ["HRV", "PRESTIGE"],
  },
  {
    label: "Avanza Veloz Q TSS 2022 — Basura",
    year: 2022,
    price: 226_000_000,
    mustInclude: ["VELOZ", "Q", "TSS"],
  },

  // AHA GALLERY
  {
    label: "HR-V Prestige 2017 — Gallery",
    year: 2017,
    price: 215_000_000,
    mustInclude: ["HRV", "PRESTIGE"],
  },
  {
    label: "Pajero Dakar 2017 — Gallery",
    year: 2017,
    price: 335_000_000,
    mustInclude: ["PAJERO", "DAKAR"],
  },
  {
    label: "Fortuner G 2.7 Lux TRD 2014 — Gallery",
    year: 2014,
    price: 233_000_000,
    mustInclude: ["FORTUNER", "2.7", "TRD"],
  },

  // AHA ADEX
  {
    label: "Honda Brio E 2024 — ADEX",
    year: 2024,
    price: 170_000_000,
    mustInclude: ["BRIO", "E"],
  },
  {
    label: "CR-V 2.4 Prestige 2016 — ADEX",
    year: 2016,
    price: 197_000_000,
    mustInclude: ["CRV", "2.4", "PRESTIGE"],
  },
  {
    label: "Mobilio RS 2018 — ADEX",
    year: 2018,
    price: 150_000_000,
    mustInclude: ["MOBILIO", "RS"],
  },
  {
    label: "Toyota Vios G 2021 — ADEX",
    year: 2021,
    price: 170_000_000,
    mustInclude: ["VIOS", "G"],
  },

  // AHA GM CIPETE
  {
    label: "CR-V 2.0 2019 — GM Cipete",
    year: 2019,
    price: 235_000_000,
    mustInclude: ["CRV", "2.0"],
  },
  {
    label: "City HB RS 2021 — GM Cipete",
    year: 2021,
    price: 200_000_000,
    mustInclude: ["CITY", "RS"],
  },
  {
    label: "Almaz RS Pro 2022 — GM Cipete",
    year: 2022,
    price: 193_000_000,
    mustInclude: ["ALMAZ", "RS", "PRO"],
  },

  // MAPPING CABANG BELUM PASTI
  {
    label: "Mazda CX-3 GT 2018",
    year: 2018,
    price: 213_000_000,
    mustInclude: ["CX", "3", "GT"],
  },
  {
    label: "Innova Venturer 2.4 AT 2022",
    year: 2022,
    price: 410_000_000,
    mustInclude: ["INNOVA", "VENTURER", "2.4"],
  },
  {
    label: "Zenix V Hybrid Modellista 2023",
    year: 2023,
    price: 410_000_000,
    mustInclude: ["ZENIX", "V", "HYBRID"],
  },
];

/* =====================================================
   HELPERS
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

function matchesText(
  text: string,
  target: Target
) {
  const includeOK =
    target.mustInclude.every((keyword) =>
      text.includes(normalize(keyword))
    );

  if (!includeOK) {
    return false;
  }

  const excluded =
    (target.mustNotInclude ?? []).some(
      (keyword) =>
        text.includes(normalize(keyword))
    );

  return !excluded;
}

/* =====================================================
   MAIN
   ===================================================== */

async function main() {

  console.log("");
  console.log(
    "GARAGE88 — MARK OTR COVER PENDING"
  );
  console.log(
    "=================================="
  );

  const { data, error } =
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
    throw new Error(error.message);
  }

  const cars =
    (data ?? []) as CarRow[];

  console.log(
    `READY : ${cars.length}`
  );

  console.log(
    `Target: ${targets.length}`
  );

  console.log("");

  let marked = 0;
  let skipped = 0;
  let failed = 0;

  for (const target of targets) {

    console.log(
      `▶ ${target.label}`
    );

    const candidates =
      cars.filter((car) => {

        if (
          car.year !== target.year
        ) {
          return false;
        }

        if (
          Number(car.credit_price) !==
          target.price
        ) {
          return false;
        }

        return matchesText(
          carText(car),
          target
        );
      });

    if (
      candidates.length === 0
    ) {
      console.log(
        "  ⚠️ SKIP — tidak ditemukan"
      );

      skipped++;
      console.log("");
      continue;
    }

    if (
      candidates.length > 1
    ) {
      console.log(
        `  ⚠️ SKIP — ${candidates.length} kandidat`
      );

      for (
        const car of candidates
      ) {
        console.log(
          `     ${car.id} | ${carText(car)}`
        );
      }

      skipped++;
      console.log("");
      continue;
    }

    const car =
      candidates[0];

    console.log(
      `  MATCH: ${carText(car)}`
    );

    /*
     * HANYA MARK PENDING.
     * TIDAK MENGUBAH HARGA.
     */
    const {
      error: updateError,
    } =
      await supabase
        .from("cars")
        .update({
          cover_needs_regenerate:
            true,
        })
        .eq("id", car.id);

    if (updateError) {

      failed++;

      console.log(
        `  ❌ ${updateError.message}`
      );

      console.log("");
      continue;
    }

    marked++;

    console.log(
      "  ✅ COVER → PENDING"
    );

    console.log("");
  }

  console.log(
    "=================================="
  );

  console.log(
    `✅ Pending : ${marked}`
  );

  console.log(
    `⚠️ Skip    : ${skipped}`
  );

  console.log(
    `❌ Failed  : ${failed}`
  );

  console.log("");
}

main().catch((error) => {

  console.error(
    "FATAL ERROR:"
  );

  console.error(error);

  process.exit(1);
});
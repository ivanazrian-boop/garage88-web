import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const SITE_URL = "https://garage88.site";

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error(
    "SUPABASE_URL / SUPABASE_SERVICE_KEY belum ada di .env"
  );
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  {
    auth: {
      persistSession: false,
    },
  }
);

function isGeneratedOrBlank(
  url?: string | null
) {
  if (!url || url.trim() === "") {
    return true;
  }

  return url.includes(
    "/generated/ig-cover.jpg"
  );
}

function sleep(ms: number) {
  return new Promise((resolve) =>
    setTimeout(resolve, ms)
  );
}

async function main() {
  console.log(
    "CHECK IG COVER START"
  );

  const {
    data: cars,
    error,
  } = await supabase
    .from("cars")
    .select(
      `
      id,
      brand,
      model,
      variant,
      ig_image_url,
      meta_image_url,
      status
      `
    )
    .order(
      "created_at",
      {
        ascending: false,
      }
    );

  if (error) {
    console.error(
      "SUPABASE ERROR:",
      error.message
    );

    return;
  }

  const allCars =
    cars ?? [];

  const targets =
    allCars.filter(
      (car) =>
        isGeneratedOrBlank(
          car.ig_image_url
        )
    );

  console.log(
    `TOTAL CARS: ${allCars.length}`
  );

  console.log(
    `TARGET TO GENERATE: ${targets.length}`
  );

  console.log(
    `SKIPPED MANUAL COVER: ${
      allCars.length -
      targets.length
    }`
  );

  if (
    targets.length === 0
  ) {
    console.log(
      "NO TARGET"
    );

    return;
  }

  let success = 0;
  let failed = 0;

  for (
    const car of targets
  ) {
    const label = [
      car.brand,
      car.model,
      car.variant,
    ]
      .filter(Boolean)
      .join(" ");

    console.log(
      `\nGENERATE: ${label} | ${car.id}`
    );

    try {
      const response =
        await fetch(
          `${SITE_URL}/api/generate-covers/${car.id}`,
          {
            method: "POST",

            headers: {
              Origin:
                SITE_URL,

              Referer:
                `${SITE_URL}/admin/cars`,

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({}),
          }
        );

      const text =
        await response.text();

      if (!response.ok) {
        failed++;

        console.error(
          `FAILED: ${label}`
        );

        console.error(
          text
        );
      } else {
        success++;

        console.log(
          `OK: ${label}`
        );
      }
    } catch (err) {
      failed++;

      console.error(
        `ERROR: ${label}`
      );

      console.error(
        err
      );
    }

    await sleep(1500);
  }

  console.log(
    "\nDONE"
  );

  console.log(
    `SUCCESS: ${success}`
  );

  console.log(
    `FAILED: ${failed}`
  );
}

main();
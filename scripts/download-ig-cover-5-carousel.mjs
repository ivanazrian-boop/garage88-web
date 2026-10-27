import { createClient } from "@supabase/supabase-js";
import { loadEnvFile } from "node:process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/* =====================================================
   ENV
   ===================================================== */

function tryLoadEnv(file) {
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
  throw new Error("SUPABASE_URL tidak ditemukan");
}

if (!SUPABASE_SERVICE_KEY) {
  throw new Error("SUPABASE_SERVICE_KEY tidak ditemukan");
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
   LIST 5 CAROUSEL x 5 MOBIL

   Menggunakan ID agar tidak tertukar dengan unit
   model sama yang berada di cabang berbeda.
   ===================================================== */

const CAROUSELS = [
  {
    number: 1,
    range: "125-135JT",
    cars: [
      {
        slide: 1,
        id: "6b005b6a-1d6d-41ff-8388-a1168a487ec2",
      },
      {
        slide: 2,
        id: "f5a69d48-8682-47f1-b5c8-760c2c203113",
      },
      {
        slide: 3,
        id: "ad67d222-85c7-4f59-977c-26f8d5414c5a",
      },
      {
        slide: 4,
        id: "95c54af0-dbbf-48e9-9a79-a5a103b9752c",
      },
      {
        slide: 5,
        id: "85f8ba7a-bf79-4d36-90ac-672129ef58cc",
      },
    ],
  },

  {
    number: 2,
    range: "178-200JT",
    cars: [
      {
        slide: 1,
        id: "c5647dee-87f0-4eec-8607-9cd9ed9356b7",
      },
      {
        slide: 2,
        id: "272be65f-33f8-46b6-9888-e42b6cc49647",
      },
      {
        slide: 3,
        id: "f2b7755d-d7a3-44ed-b9f7-ef31b1388b13",
      },
      {
        slide: 4,
        id: "685cebfd-6fae-4bf4-8912-3a69657cbc74",
      },
      {
        slide: 5,
        id: "fc94f88c-8ca8-473b-a8cc-6647872516bf",
      },
    ],
  },

  {
    number: 3,
    range: "220-235JT",
    cars: [
      {
        slide: 1,
        id: "0a661d2b-dab8-4106-8f47-b52200cd8a68",
      },
      {
        slide: 2,
        id: "c4774000-6746-4e9c-ab3e-d9297e827702",
      },
      {
        slide: 3,
        id: "f7f8da4f-0a25-4035-bbea-a087427525be",
      },
      {
        slide: 4,
        id: "98f02a35-cac8-489f-84fa-7a8d915bbf7d",
      },
      {
        slide: 5,
        id: "cb187b67-30d9-49b5-9637-f511f7bd7339",
      },
    ],
  },

  {
    number: 4,
    range: "325-335JT",
    cars: [
      {
        slide: 1,
        id: "a00a0548-c7d7-4fce-8fef-2401e6c1e4eb",
      },
      {
        slide: 2,
        id: "923682f4-b089-4fcb-9c4f-41148f116a29",
      },
      {
        slide: 3,
        id: "bfe55cba-189e-472b-b9cc-beabf42c7476",
      },
      {
        slide: 4,
        id: "80d6696c-4e53-4567-b162-d024eba46177",
      },
      {
        slide: 5,
        id: "4104c8eb-5d31-4bf4-92d4-8782da9197dc",
      },
    ],
  },

  {
    number: 5,
    range: "335-680JT",
    cars: [
      {
        // Toyota Alphard G ATPM TSS 2022
        slide: 1,
        id: "e55f5c36-72fb-4742-8c73-584c53744619",
      },
      {
        slide: 2,
        id: "44cf9ed2-b233-49dd-99b7-3fc013a59c37",
      },
      {
        slide: 3,
        id: "5e28b053-7307-4234-b592-1a5d0a2f3aaa",
      },
      {
        slide: 4,
        id: "6cbe6550-934d-4b2a-b77f-d3768af4ca0b",
      },
      {
        slide: 5,
        id: "7250ecad-adbb-4b70-a093-af0c7e1f5d95",
      },
    ],
  },
];

/* =====================================================
   HELPERS
   ===================================================== */

function pad(value, length = 2) {
  return String(value).padStart(length, "0");
}

function timestamp() {
  return new Date()
    .toISOString()
    .replaceAll(":", "-")
    .replace("T", "_")
    .replace(/\.\d{3}Z$/, "");
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function safeFilename(value) {
  return cleanText(value)
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

function carName(car) {
  return cleanText(
    [
      car.brand,
      car.model,
      car.variant,
      car.year,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function csvValue(value) {
  return `"${String(value ?? "").replaceAll(
    '"',
    '""'
  )}"`;
}

function extensionFrom(contentType, url) {
  const type =
    String(contentType ?? "").toLowerCase();

  if (type.includes("png")) {
    return ".png";
  }

  if (type.includes("webp")) {
    return ".webp";
  }

  if (type.includes("avif")) {
    return ".avif";
  }

  if (
    type.includes("jpeg") ||
    type.includes("jpg")
  ) {
    return ".jpg";
  }

  try {
    const ext =
      path
        .extname(new URL(url).pathname)
        .toLowerCase();

    const allowed = [
      ".jpg",
      ".jpeg",
      ".png",
      ".webp",
      ".avif",
    ];

    if (allowed.includes(ext)) {
      return ext === ".jpeg"
        ? ".jpg"
        : ext;
    }
  } catch {}

  return ".jpg";
}

async function downloadImage(url) {
  const response =
    await fetch(url, {
      cache: "no-store",
      headers: {
        "user-agent":
          "Garage88-IG-Cover-Downloader/1.0",
      },
    });

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}`
    );
  }

  return {
    buffer: Buffer.from(
      await response.arrayBuffer()
    ),

    extension: extensionFrom(
      response.headers.get("content-type"),
      url
    ),
  };
}

/* =====================================================
   SUPABASE
   ===================================================== */

async function getSelectedCars() {
  const ids =
    CAROUSELS.flatMap((carousel) =>
      carousel.cars.map(
        (item) => item.id
      )
    );

  const {
    data,
    error,
  } =
    await supabase
      .from("cars")
      .select(`
        id,
        branch,
        brand,
        model,
        variant,
        year,
        odometer,
        credit_price,
        status,
        ig_image_url
      `)
      .in("id", ids);

  if (error) {
    throw new Error(
      `Supabase error: ${error.message}`
    );
  }

  return new Map(
    (data ?? []).map(
      (car) => [
        car.id,
        car,
      ]
    )
  );
}

/* =====================================================
   MAIN
   ===================================================== */

async function main() {
  console.log("");

  console.log(
    "GARAGE88 — DOWNLOAD 5 CAROUSEL IG COVER"
  );

  console.log(
    "========================================"
  );

  const carMap =
    await getSelectedCars();

  const outputFolder =
    path.resolve(
      `exports/ig-carousel-5x5-${timestamp()}`
    );

  await mkdir(
    outputFolder,
    {
      recursive: true,
    }
  );

  const manifest = [
    [
      "CAROUSEL",
      "RANGE_HARGA",
      "SLIDE",
      "CAR_ID",
      "MOBIL",
      "CABANG",
      "HARGA_KREDIT",
      "STATUS",
      "IG_IMAGE_URL",
      "FILE",
      "HASIL",
    ],
  ];

  let success = 0;
  let failed = 0;

  for (
    const carousel
    of CAROUSELS
  ) {
    const folderName =
      `${pad(
        carousel.number
      )}_CAROUSEL_${carousel.range}`;

    const carouselFolder =
      path.join(
        outputFolder,
        folderName
      );

    await mkdir(
      carouselFolder,
      {
        recursive: true,
      }
    );

    console.log("");

    console.log(
      `CAROUSEL ${carousel.number} — ${carousel.range}`
    );

    for (
      const item
      of carousel.cars
    ) {
      const car =
        carMap.get(item.id);

      if (!car) {
        failed++;

        console.log(
          `  ❌ Slide ${item.slide}: ID tidak ditemukan (${item.id})`
        );

        manifest.push([
          carousel.number,
          carousel.range,
          item.slide,
          item.id,
          "",
          "",
          "",
          "",
          "",
          "",
          "ID TIDAK DITEMUKAN",
        ]);

        continue;
      }

      const name =
        carName(car);

      if (
        String(car.status)
          .toUpperCase() !==
        "READY"
      ) {
        failed++;

        console.log(
          `  ❌ Slide ${item.slide}: ${name} bukan READY`
        );

        manifest.push([
          carousel.number,
          carousel.range,
          item.slide,
          car.id,
          name,
          car.branch,
          car.credit_price,
          car.status,
          car.ig_image_url,
          "",
          "STATUS BUKAN READY",
        ]);

        continue;
      }

      if (
        !cleanText(
          car.ig_image_url
        )
      ) {
        failed++;

        console.log(
          `  ❌ Slide ${item.slide}: ${name} belum ada IG cover`
        );

        manifest.push([
          carousel.number,
          carousel.range,
          item.slide,
          car.id,
          name,
          car.branch,
          car.credit_price,
          car.status,
          "",
          "",
          "IG COVER KOSONG",
        ]);

        continue;
      }

      try {
        const image =
          await downloadImage(
            car.ig_image_url
          );

        const filename =
          `${pad(
            item.slide
          )}__${safeFilename(
            name
          )}${image.extension}`;

        const filePath =
          path.join(
            carouselFolder,
            filename
          );

        await writeFile(
          filePath,
          image.buffer
        );

        success++;

        console.log(
          `  ✅ Slide ${item.slide}: ${filename}`
        );

        manifest.push([
          carousel.number,
          carousel.range,
          item.slide,
          car.id,
          name,
          car.branch,
          car.credit_price,
          car.status,
          car.ig_image_url,
          path.join(
            folderName,
            filename
          ),
          "BERHASIL",
        ]);
      } catch (error) {
        failed++;

        console.log(
          `  ❌ Slide ${item.slide}: ${name} — ${error.message}`
        );

        manifest.push([
          carousel.number,
          carousel.range,
          item.slide,
          car.id,
          name,
          car.branch,
          car.credit_price,
          car.status,
          car.ig_image_url,
          "",
          `GAGAL: ${error.message}`,
        ]);
      }
    }
  }

  const csv =
    manifest
      .map(
        (row) =>
          row
            .map(csvValue)
            .join(",")
      )
      .join("\n");

  await writeFile(
    path.join(
      outputFolder,
      "manifest.csv"
    ),
    csv,
    "utf8"
  );

  console.log("");

  console.log(
    "========================================"
  );

  console.log(
    `✅ Berhasil: ${success}`
  );

  console.log(
    `❌ Gagal: ${failed}`
  );

  console.log(
    `📁 Output: ${outputFolder}`
  );

  console.log("");
}

main().catch(
  (error) => {
    console.error("");

    console.error(
      "FATAL ERROR:"
    );

    console.error(error);

    process.exit(1);
  }
);


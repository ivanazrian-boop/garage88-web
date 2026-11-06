
import type { APIRoute } from "astro";
import { supabase } from "../lib/supabase";

export const prerender = false;

const SITE_URL = "https://garage88.site";

/*
 * FORCE META IMAGE REFRESH
 */
const FORCE_META_IMAGE_VERSION = "force-20260828-2";

type CarImage = {
  image_url: string | null;
  sort_order: number | null;
};

type Car = {
  id: string;
  slug: string | null;
  meta_image_url: string | null;
  brand: string | null;
  model: string | null;
  variant: string | null;
  year: number | null;
  color: string | null;
  fuel: string | null;
  transmission: string | null;
  odometer: number | null;
  credit_price: number | null;
  cash_price: number | null;
  dp: number | null;
  description: string | null;
  status: string | null;
  created_at: string | null;
  car_images: CarImage[] | null;
};

/*
 * CLEAN TEXT
 */
function cleanText(value: unknown): string {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\\r\\n/g, " ")
    .replace(/\\n/g, " ")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/*
 * CSV CELL
 */
function csvCell(value: unknown): string {
  const text = cleanText(value).replace(/"/g, '""');
  return `"${text}"`;
}

/*
 * FORMAT RUPIAH TO JUTA
 * Example: 5000000 => 5 JT
 */
function formatJuta(value: number | null): string {
  if (
    value === null ||
    !Number.isFinite(Number(value))
  ) {
    return "-";
  }

  return `${(
    Number(value) / 1_000_000
  ).toLocaleString("id-ID", {
    maximumFractionDigits: 1,
  })} JT`;
}

/*
 * GET FIRST ORIGINAL IMAGE
 * Fallback jika meta_image_url kosong.
 */
function getCoverImage(
  images: CarImage[] | null
): string {
  if (!images?.length) {
    return "";
  }

  const coverImage = [...images]
    .filter((image) => Boolean(image.image_url))
    .sort(
      (a, b) =>
        (a.sort_order ?? Number.MAX_SAFE_INTEGER) -
        (b.sort_order ?? Number.MAX_SAFE_INTEGER)
    )[0];

  return coverImage?.image_url ?? "";
}

/*
 * FORCE IMAGE REFRESH
 */
function forceMetaImageRefresh(url: string): string {
  const cleanUrl = String(url ?? "").trim();

  if (!cleanUrl) {
    return "";
  }

  const separator = cleanUrl.includes("?") ? "&" : "?";

  return (
    `${cleanUrl}${separator}` +
    `v=${encodeURIComponent(FORCE_META_IMAGE_VERSION)}`
  );
}

/*
 * META CATALOG CSV
 */
export const GET: APIRoute = async () => {
  /*
   * GET READY CARS
   */
  const {
    data,
    error,
  } = await supabase
    .from("cars")
    .select(`
      id,
      slug,
      meta_image_url,
      brand,
      model,
      variant,
      year,
      color,
      fuel,
      transmission,
      odometer,
      credit_price,
      cash_price,
      dp,
      description,
      status,
      created_at,
      car_images (
        image_url,
        sort_order
      )
    `)
    .eq("status", "READY")
    .order("created_at", {
      ascending: false,
    });

  /*
   * ERROR
   */
  if (error) {
    console.error(
      "Gagal mengambil data katalog Meta:",
      error
    );

    return new Response(
      `Supabase error: ${error.message}`,
      {
        status: 500,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
      }
    );
  }

  const cars = (data ?? []) as Car[];

  /*
   * CSV HEADER
   */
  const headers = [
    "id",
    "image_link",
    "description",
    "title",
    "price",
    "link",
    "availability",
    "condition",
    "brand",
  ];

  /*
   * BUILD ROWS
   */
  const rows = cars.flatMap((car) => {
    /*
     * TITLE
     */
    const title = cleanText(
      [
        car.brand,
        car.model,
        car.variant,
        car.year,
      ]
        .filter(Boolean)
        .join(" ")
    );

    /*
     * RAW IMAGE
     *
     * PRIORITY:
     * 1. META COVER
     * 2. FOTO ASLI PERTAMA
     */
    const rawImageLink =
      car.meta_image_url ||
      getCoverImage(car.car_images);

    /*
     * FORCE REFRESH IMAGE
     */
    const imageLink =
      forceMetaImageRefresh(rawImageLink);

    /*
     * META PRICE
     *
     * Catalog memakai Harga Kredit.
     */
    const catalogPrice = Number(car.credit_price);

    /*
     * DESCRIPTION
     *
     * FORMAT:
     * DP MULAI 5 JT |
     * HARGA CREDIT 170 JT / CASH 180 JT |
     * KM 83.000
     *
     * Tidak menggunakan nama mobil,
     * warna, transmisi, fuel, atau deskripsi panjang.
     */
    const description = [
      `DP MULAI ${formatJuta(car.dp)}`,
      `HARGA CREDIT ${formatJuta(car.credit_price)} / CASH ${formatJuta(car.cash_price)}`,
      `KM ${
        car.odometer !== null
          ? Number(car.odometer).toLocaleString("id-ID")
          : "-"
      }`,
    ].join(" | ");

    /*
     * VALIDATION
     */
    if (
      !car.id ||
      !car.slug ||
      !title ||
      !imageLink ||
      !Number.isFinite(catalogPrice) ||
      catalogPrice <= 0
    ) {
      console.warn(
        "Mobil dilewati:",
        {
          id: car.id,
          title,
          imageLink,
          catalogPrice,
        }
      );

      return [];
    }

    /*
     * CSV ROW
     */
    const row = [
      car.id,
      imageLink,
      description,
      title,
      `${Math.round(catalogPrice)} IDR`,
      `${SITE_URL}/detail/${car.slug}`,
      "in stock",
      "used",
      car.brand,
    ];

    return [
      row.map(csvCell).join(","),
    ];
  });

  /*
   * FINAL CSV
   */
  const csv = [
    headers.join(","),
    ...rows,
  ].join("\n");

  /*
   * RESPONSE
   *
   * no-store agar Cloudflare/browser
   * tidak memberikan CSV lama.
   */
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",

      "Content-Disposition":
        'inline; filename="garage88-meta-catalog.csv"',

      "Cache-Control":
        "no-store, no-cache, must-revalidate",

      "Pragma": "no-cache",

      "Expires": "0",
    },
  });
};

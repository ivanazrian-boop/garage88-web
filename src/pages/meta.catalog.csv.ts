import type { APIRoute } from "astro";
import { supabase } from "../lib/supabase";

export const prerender = false;

const SITE_URL = "https://garage88.site";

/*
 * =====================================================
 * FORCE META IMAGE REFRESH
 * =====================================================
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
 * =====================================================
 * CLEAN TEXT
 * =====================================================
 */

function cleanText(value: unknown): string {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x20;/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/*
 * =====================================================
 * FORMAT PRICE TO JUTA
 * =====================================================
 */

function formatJuta(value: number | null): string {
  if (value === null || !Number.isFinite(Number(value))) {
    return "";
  }

  const juta = Number(value) / 1_000_000;

  return `${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 1,
  }).format(juta)} JT`;
}

/*
 * =====================================================
 * PARSE DP FROM DESCRIPTION
 * =====================================================
 */

function parseDpAmount(value: string, suffix?: string): number | null {
  const normalized = value.trim();

  if (!normalized) return null;

  if (suffix) {
    const decimalValue = Number(
      normalized.replace(/\./g, "").replace(",", ".")
    );

    return Number.isFinite(decimalValue) && decimalValue > 0
      ? decimalValue * 1_000_000
      : null;
  }

  const rawValue = Number(normalized.replace(/[.,]/g, ""));

  return Number.isFinite(rawValue) && rawValue > 0
    ? rawValue
    : null;
}

function getDpMulai(car: Car): number | null {
  const candidates: number[] = [];

  if (car.dp !== null && Number(car.dp) > 0) {
    candidates.push(Number(car.dp));
  }

  const matches = cleanText(car.description).matchAll(
    /(?:tdp|dp)\s*[:\-]?\s*(?:rp\.?\s*)?([\d.,]+)\s*(jt|juta)?/gi
  );

  for (const match of matches) {
    const amount = parseDpAmount(match[1], match[2]);

    if (amount !== null) {
      candidates.push(amount);
    }
  }

  return candidates.length
    ? Math.min(...candidates)
    : null;
}

/*
 * =====================================================
 * CSV CELL
 * =====================================================
 */

function csvCell(value: unknown): string {
  const text = cleanText(value).replace(/"/g, '""');

  return `"${text}"`;
}

/*
 * =====================================================
 * GET FIRST ORIGINAL IMAGE
 * =====================================================
 */

function getCoverImage(images: CarImage[] | null): string {
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
 * =====================================================
 * FORCE IMAGE REFRESH
 * =====================================================
 */

function forceMetaImageRefresh(url: string): string {
  const cleanUrl = String(url ?? "").trim();

  if (!cleanUrl) {
    return "";
  }

  const separator = cleanUrl.includes("?") ? "&" : "?";

  return (
    `${cleanUrl}` +
    `${separator}` +
    `v=${encodeURIComponent(FORCE_META_IMAGE_VERSION)}`
  );
}

/*
 * =====================================================
 * META CATALOG CSV
 * =====================================================
 */

export const GET: APIRoute = async () => {
  /*
   * ===================================================
   * GET READY CARS
   * ===================================================
   */

  const { data, error } = await supabase
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
   * ===================================================
   * ERROR
   * ===================================================
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
   * ===================================================
   * CSV HEADER
   * ===================================================
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
   * ===================================================
   * BUILD ROWS
   * ===================================================
   */

  const rows = cars.flatMap((car) => {
    /*
     * -------------------------------------------------
     * TITLE
     * -------------------------------------------------
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
     * -------------------------------------------------
     * RAW IMAGE
     *
     * PRIORITY:
     * 1. META COVER
     * 2. FOTO ASLI PERTAMA
     * -------------------------------------------------
     */

    const rawImageLink =
      car.meta_image_url ||
      getCoverImage(car.car_images);

    /*
     * -------------------------------------------------
     * FORCE REFRESH IMAGE
     * -------------------------------------------------
     */

    const imageLink = forceMetaImageRefresh(rawImageLink);

    /*
     * -------------------------------------------------
     * META PRICE
     *
     * Catalog memakai Harga Kredit.
     * -------------------------------------------------
     */

    const catalogPrice = Number(car.credit_price);

    /*
     * -------------------------------------------------
     * DESCRIPTION
     *
     * FORMAT:
     * Nama Mobil | DP Mulai | CREDIT | CASH | KM
     * -------------------------------------------------
     */

    const dpMulai = getDpMulai(car);

    const carName = cleanText(
      [
        car.brand,
        car.model,
        car.variant,
        car.year,
        car.color,
      ]
        .filter(Boolean)
        .join(" ")
    );

    const description = [
      carName,

      dpMulai !== null
        ? `DP Mulai ${formatJuta(dpMulai)}`
        : "",

      car.credit_price !== null
        ? `CREDIT ${formatJuta(car.credit_price)}`
        : "",

      car.cash_price !== null
        ? `CASH ${formatJuta(car.cash_price)}`
        : "",

      car.odometer !== null
        ? `KM ${Number(car.odometer).toLocaleString("id-ID")}`
        : "",
    ]
      .filter(Boolean)
      .join(" | ");

    /*
     * -------------------------------------------------
     * VALIDATION
     * -------------------------------------------------
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
     * -------------------------------------------------
     * CSV ROW
     * -------------------------------------------------
     */

    const row = [
      car.id,
      imageLink,
      description || title,
      title,
      `${Math.round(catalogPrice)} IDR`,
      `${SITE_URL}/detail/${car.slug}`,
      "in stock",
      "used",
      car.brand,
    ];

    return [
      row
        .map(csvCell)
        .join(","),
    ];
  });

  /*
   * ===================================================
   * FINAL CSV
   * ===================================================
   */

  const csv = [
    headers.join(","),
    ...rows,
  ].join("\n");

  /*
   * ===================================================
   * RESPONSE
   *
   * no-store sementara agar Cloudflare/browser
   * tidak memberikan CSV lama.
   * ===================================================
   */

  return new Response(
    csv,
    {
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
    }
  );
};
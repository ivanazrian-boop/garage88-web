import type { APIRoute } from "astro";

import { supabase } from "../lib/supabase";

export const prerender = false;


const SITE_URL = "https://garage88.site";


/*
 * =====================================================
 * FORCE META IMAGE REFRESH
 *
 * Untuk case sekali ini.
 *
 * Meta kadang cache image_link walaupun file JPG
 * pada URL yang sama sudah diganti.
 *
 * Dengan version ini:
 *
 * meta-cover.jpg
 *
 * menjadi:
 *
 * meta-cover.jpg?v=force-20260828
 *
 * Meta akan melihatnya sebagai URL gambar baru.
 *
 * Tidak perlu diganti lagi setelah sync berhasil.
 * =====================================================
 */

const FORCE_META_IMAGE_VERSION = "force-20260828";


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
    .replace(/\\r\\n/g, " ")
    .replace(/\\n/g, " ")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


/*
 * =====================================================
 * CSV CELL
 * =====================================================
 */

function csvCell(value: unknown): string {
  const text = cleanText(value)
    .replace(/"/g, '""');

  return `"${text}"`;
}


/*
 * =====================================================
 * GET FIRST ORIGINAL CAR IMAGE
 *
 * Fallback jika Meta Cover tidak tersedia.
 * =====================================================
 */

function getCoverImage(
  images: CarImage[] | null
): string {
  if (!images?.length) {
    return "";
  }

  const coverImage = [...images]
    .filter(
      (image) =>
        Boolean(image.image_url)
    )
    .sort(
      (a, b) =>
        (a.sort_order ?? Number.MAX_SAFE_INTEGER)
        -
        (b.sort_order ?? Number.MAX_SAFE_INTEGER)
    )[0];

  return coverImage?.image_url ?? "";
}


/*
 * =====================================================
 * FORCE REFRESH IMAGE URL
 *
 * Support URL yang:
 * - belum punya query string
 * - sudah punya query string
 * =====================================================
 */

function forceMetaImageRefresh(
  url: string
): string {
  const cleanUrl = String(url ?? "").trim();

  if (!cleanUrl) {
    return "";
  }

  const separator =
    cleanUrl.includes("?")
      ? "&"
      : "?";

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
    .eq(
      "status",
      "READY"
    )
    .order(
      "created_at",
      {
        ascending: false,
      }
    );


  /*
   * ===================================================
   * SUPABASE ERROR
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
          "Content-Type":
            "text/plain; charset=utf-8",
        },
      }
    );
  }


  const cars =
    (data ?? []) as Car[];


  /*
   * ===================================================
   * CSV HEADERS
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

  const rows =
    cars.flatMap((car) => {

      /*
       * -------------------------------------------------
       * TITLE
       * -------------------------------------------------
       */

      const title =
        cleanText(
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
       * IMAGE
       *
       * PRIORITY:
       *
       * 1. META COVER
       * 2. FOTO ASLI
       *
       * Setelah dapat URL:
       * tambahkan cache-buster agar Meta download ulang.
       * -------------------------------------------------
       */

      const rawImageLink =
        car.meta_image_url
        ||
        getCoverImage(
          car.car_images
        );


      const imageLink =
        forceMetaImageRefresh(
          rawImageLink
        );


      /*
       * -------------------------------------------------
       * META PRICE
       *
       * Catalog menggunakan Harga Kredit.
       * -------------------------------------------------
       */

      const cashPrice =
        Number(
          car.credit_price
        );


      /*
       * -------------------------------------------------
       * SPECIFICATIONS
       * -------------------------------------------------
       */

      const specifications = [
        car.transmission
          ? `Transmisi: ${cleanText(car.transmission)}`
          : "",

        car.fuel
          ? `Bahan bakar: ${cleanText(car.fuel)}`
          : "",

        car.odometer !== null
          ? `Odometer: ${Number(
              car.odometer
            ).toLocaleString("id-ID")} km`
          : "",

        car.color
          ? `Warna: ${cleanText(car.color)}`
          : "",

        car.credit_price !== null
          ? `Harga kredit: Rp${Number(
              car.credit_price
            ).toLocaleString("id-ID")}`
          : "",

        car.dp !== null
          ? `DP: Rp${Number(
              car.dp
            ).toLocaleString("id-ID")}`
          : "",
      ]
        .filter(Boolean)
        .join(" | ");


      /*
       * -------------------------------------------------
       * DESCRIPTION
       * -------------------------------------------------
       */

      const description =
        cleanText(
          [
            car.description,
            specifications,
          ]
            .filter(Boolean)
            .join(" | ")
        );


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
        !Number.isFinite(cashPrice) ||
        cashPrice <= 0
      ) {
        console.warn(
          "Mobil dilewati:",
          {
            id: car.id,
            title,
            imageLink,
            cashPrice,
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

        `${Math.round(cashPrice)} IDR`,

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
   * ===================================================
   */

  return new Response(
    csv,
    {
      status: 200,

      headers: {
        "Content-Type":
          "text/csv; charset=utf-8",

        "Content-Disposition":
          'inline; filename="garage88-meta-catalog.csv"',

        "Cache-Control":
          "public, max-age=300, s-maxage=300",
      },
    }
  );
};
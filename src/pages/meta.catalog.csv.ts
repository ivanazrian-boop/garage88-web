import type { APIRoute } from "astro";
import { supabase } from "../lib/supabase";

export const prerender = false;

const SITE_URL = "https://garage88.site";

type CarImage = {
  image_url: string | null;
  sort_order: number | null;
};

type Car = {
  id: string;
  slug: string | null;
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

function cleanText(value: unknown): string {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\\r\\n/g, " ")
    .replace(/\\n/g, " ")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function csvCell(value: unknown): string {
  const text = cleanText(value).replace(/"/g, '""');
  return `"${text}"`;
}

function getCoverImage(images: CarImage[] | null): string {
  if (!images?.length) {
    return "";
  }

  const coverImage = [...images]
    .filter((image) => Boolean(image.image_url))
    .sort(
      (a, b) =>
        (a.sort_order ?? Number.MAX_SAFE_INTEGER) -
        (b.sort_order ?? Number.MAX_SAFE_INTEGER),
    )[0];

  return coverImage?.image_url ?? "";
}

export const GET: APIRoute = async () => {
  const { data, error } = await supabase
    .from("cars")
    .select(`
      id,
      slug,
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
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Gagal mengambil data katalog Meta:", error);

    return new Response(`Supabase error: ${error.message}`, {
      status: 500,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  const cars = (data ?? []) as Car[];

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

  const rows = cars.flatMap((car) => {
    const title = cleanText(
      [car.brand, car.model, car.variant, car.year]
        .filter(Boolean)
        .join(" "),
    );

    const imageLink = getCoverImage(car.car_images);
    const cashPrice = Number(car.cash_price);

    const specifications = [
      car.transmission
        ? `Transmisi: ${cleanText(car.transmission)}`
        : "",
      car.fuel
        ? `Bahan bakar: ${cleanText(car.fuel)}`
        : "",
      car.odometer !== null
        ? `Odometer: ${Number(car.odometer).toLocaleString("id-ID")} km`
        : "",
      car.color
        ? `Warna: ${cleanText(car.color)}`
        : "",
      car.credit_price !== null
        ? `Harga kredit: Rp${Number(car.credit_price).toLocaleString("id-ID")}`
        : "",
      car.dp !== null
        ? `DP: Rp${Number(car.dp).toLocaleString("id-ID")}`
        : "",
    ]
      .filter(Boolean)
      .join(" | ");

    const description = cleanText(
      [car.description, specifications]
        .filter(Boolean)
        .join(" | "),
    );

    if (
      !car.id ||
      !car.slug ||
      !title ||
      !imageLink ||
      !Number.isFinite(cashPrice) ||
      cashPrice <= 0
    ) {
      console.warn("Mobil dilewati karena data belum lengkap:", {
        id: car.id,
        slug: car.slug,
        title,
        imageLink,
        cashPrice,
      });

      return [];
    }

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

    return [row.map(csvCell).join(",")];
  });

  const csv = [headers.join(","), ...rows].join("\n");

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        'inline; filename="garage88-meta-catalog.csv"',
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
};
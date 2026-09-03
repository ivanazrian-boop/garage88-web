import type { APIRoute } from "astro";
import { supabase } from "../lib/supabase";

export const prerender = false;

type Car = {
  id: string;
  branch: string | null;
  brand: string | null;
  model: string | null;
  variant: string | null;
  year: number | null;
  odometer: number | null;
  status: string | null;
  credit_price: number | null;
  created_at: string | null;
};

function cleanText(value: unknown): string {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function csvCell(value: unknown): string {
  const text = cleanText(value).replace(/"/g, '""');
  return `"${text}"`;
}

function getMileageStatus(car: Car): string {
  if (
    !car.year ||
    car.odometer === null ||
    car.odometer === undefined ||
    !Number.isFinite(car.odometer)
  ) {
    return "";
  }

  const currentYear = new Date().getFullYear();
  const age = Math.max(1, currentYear - car.year);
  const averagePerYear = car.odometer / age;

  if (
    averagePerYear < 10_000 &&
    car.odometer < 100_000
  ) {
    return "LOW KM";
  }

  if (
    averagePerYear < 10_000 &&
    car.odometer >= 100_000
  ) {
    return "LOW USAGE KM";
  }

  return "";
}

function getAverageKmPerYear(car: Car): number | null {
  if (
    !car.year ||
    car.odometer === null ||
    car.odometer === undefined ||
    !Number.isFinite(car.odometer)
  ) {
    return null;
  }

  const currentYear = new Date().getFullYear();
  const age = Math.max(1, currentYear - car.year);

  return Math.round(car.odometer / age);
}

export const GET: APIRoute = async () => {
  const { data, error } = await supabase
    .from("cars")
    .select(`
      id,
      branch,
      brand,
      model,
      variant,
      year,
      odometer,
      status,
      credit_price,
      created_at
    `)
    .eq("status", "READY")
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    console.error(
      "Gagal mengambil stock analysis:",
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

  const cars = (data ?? []) as Car[];

  const headers = [
    "id",
    "branch",
    "brand",
    "model",
    "variant",
    "year",
    "odometer",
    "average_km_per_year",
    "mileage_status",
    "credit_price",
    "status",
    "created_at",
  ];

  const rows = cars.map((car) => {
    const averageKmPerYear =
      getAverageKmPerYear(car);

    const mileageStatus =
      getMileageStatus(car);

    return [
      car.id,
      car.branch ?? "",
      car.brand ?? "",
      car.model ?? "",
      car.variant ?? "",
      car.year ?? "",
      car.odometer ?? "",
      averageKmPerYear ?? "",
      mileageStatus,
      car.credit_price ?? "",
      car.status ?? "",
      car.created_at ?? "",
    ]
      .map(csvCell)
      .join(",");
  });

  const csv = [
    headers.join(","),
    ...rows,
  ].join("\n");

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type":
        "text/csv; charset=utf-8",

      "Content-Disposition":
        'inline; filename="garage88-stock-analysis.csv"',

      "Cache-Control":
        "no-store, no-cache, must-revalidate",
    },
  });
};
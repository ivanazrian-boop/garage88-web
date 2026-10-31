import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { createSupabaseServerClient } from "../../../lib/supabaseServer";

function getServerSecret(name: string): string {
  const cloudflareValue = (env as Record<string, unknown>)[name];

  if (
    typeof cloudflareValue === "string" &&
    cloudflareValue.trim()
  ) {
    return cloudflareValue.trim();
  }

  const localValue = (import.meta.env as Record<string, unknown>)[name];

  if (
    typeof localValue === "string" &&
    localValue.trim()
  ) {
    return localValue.trim();
  }

  throw new Error(`Server secret ${name} belum dikonfigurasi.`);
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const cleaned = value.trim();
  return cleaned || null;
}

function validOptionalInteger(value: unknown): number | null | undefined {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);

  if (
    !Number.isSafeInteger(number) ||
    number < 0
  ) {
    return undefined;
  }

  return number;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    // 1. Validasi API secret khusus BorongBoil.
    const expectedSecret = getServerSecret(
      "BORONGBOIL_LEADS_API_SECRET"
    );

    const authorization = request.headers.get("Authorization") ?? "";
    const suppliedSecret = authorization.startsWith("Bearer ")
      ? authorization.slice(7).trim()
      : "";

    if (!suppliedSecret || suppliedSecret !== expectedSecret) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Unauthorized",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 2. Baca dan validasi JSON.
    let body: Record<string, unknown>;

    try {
      body = await request.json() as Record<string, unknown>;
    } catch {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Format JSON tidak valid.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const ownerName = cleanText(body.owner_name);
    const whatsapp = cleanText(body.whatsapp);
    const carBrand = cleanText(body.car_brand);
    const carModel = cleanText(body.car_model);
    const carColor = cleanText(body.car_color);

    const carYear = validOptionalInteger(body.car_year);
    const carKilometer = validOptionalInteger(body.car_kilometer);
    const expectedPrice = validOptionalInteger(body.expected_price);

    if (
      !ownerName ||
      !whatsapp ||
      !carBrand ||
      !carModel ||
      !carColor ||
      carYear === null ||
      carYear === undefined ||
      carYear < 1900 ||
      carYear > new Date().getFullYear() + 1 ||
      carKilometer === undefined ||
      expectedPrice === undefined
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Data wajib tidak lengkap atau format angka tidak valid.",
        }),
        {
          status: 422,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 3. Simpan ke Supabase menggunakan server-side Service Role.
    const supabase = createSupabaseServerClient();

    const { data, error } = await supabase
      .from("car_purchase_leads")
      .insert({
        source: "borongboil",
        owner_name: ownerName,
        whatsapp,
        car_brand: carBrand,
        car_model: carModel,
        car_year: carYear,
        car_color: carColor,
        car_kilometer: carKilometer,
        transmission: cleanText(body.transmission),
        car_location: cleanText(body.car_location),
        expected_price: expectedPrice,
        notes: cleanText(body.notes),
        status: "NEW",
      })
      .select("id")
      .single();

    if (error) {
      console.error("BorongBoil leads insert failed:", error.message);

      return new Response(
        JSON.stringify({
          success: false,
          message: "Gagal menyimpan data leads.",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 4. Berikan konfirmasi kepada BorongBoil.
    return new Response(
      JSON.stringify({
        success: true,
        message: "Leads berhasil disimpan.",
        id: data.id,
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error(
      "BorongBoil leads API error:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return new Response(
      JSON.stringify({
        success: false,
        message: "Konfigurasi atau server sedang bermasalah.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};

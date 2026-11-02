
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { createClient } from "@supabase/supabase-js";

function getRequiredEnv(name: string): string {
  const cloudflareValue =
    (env as Record<string, unknown>)[name];

  if (
    typeof cloudflareValue === "string" &&
    cloudflareValue.trim()
  ) {
    return cloudflareValue.trim();
  }

  const localValue =
    (import.meta.env as Record<string, unknown>)[name];

  if (
    typeof localValue === "string" &&
    localValue.trim()
  ) {
    return localValue.trim();
  }

  throw new Error(`Missing Cloudflare env: ${name}`);
}

export const POST: APIRoute = async ({ params }) => {
  try {
    const id = params.id;

    if (!id) {
      return Response.json(
        { ok: false, error: "ID mobil tidak ditemukan" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      getRequiredEnv("SUPABASE_URL"),
      getRequiredEnv("SUPABASE_SERVICE_KEY"),
      { auth: { persistSession: false } }
    );

    const bindings = env as Record<string, unknown>;
    const bucket = bindings.R2_BUCKET as R2BucketBinding | undefined;

    if (!bucket) {
      throw new Error("R2_BUCKET binding tidak tersedia");
    }

    const publicBase = getRequiredEnv("R2_PUBLIC_URL").replace(/\/+$/, "");
    const briaToken = getRequiredEnv("BRIA_API_TOKEN");

    // Ambil foto asli pertama berdasarkan sort_order.
    const { data: images, error: imagesError } = await supabase
      .from("car_images")
      .select("image_url, sort_order")
      .eq("car_id", id)
      .order("sort_order", { ascending: true });

    if (imagesError) {
      throw new Error(`Gagal mengambil foto mobil: ${imagesError.message}`);
    }

    const sourceImageUrl = String(
      images?.find((image) => image.image_url)?.image_url ?? ""
    ).trim();

    if (!sourceImageUrl) {
      return Response.json(
        { ok: false, error: "Foto asli mobil belum tersedia." },
        { status: 400 }
      );
    }

    // MASTER STUDIO STYLE:
    // Semua kendaraan harus memiliki environment studio yang sama.
    // Warna mobil tidak boleh memengaruhi warna background,
    // lighting, floor, reflection, maupun shadow.

    const sceneDescription = `
PREMIUM AUTOMOTIVE PHOTOGRAPHY.
STRICT AND CONSISTENT WHITE STUDIO ENVIRONMENT.

MASTER VISUAL REFERENCE:
A premium luxury automotive dealership product photograph
inside a bright, clean, seamless white photography studio.

1. BACKGROUND - ABSOLUTELY CONSISTENT

Pure clean white background (#FFFFFF).
Seamless white infinity cyclorama studio.
Bright, evenly illuminated white environment.
No visible horizon line, wall edges, corners or seams.

The background MUST ALWAYS remain neutral white,
regardless of the vehicle's original paint color.

Do not sample, derive, or adapt background colors
from the vehicle paint, body panels, windows or reflections.

2. LIGHTING - NEUTRAL WHITE

Professional softbox-style diffused studio lighting.
Neutral white light, approximately 5500K.
Soft, balanced illumination from multiple directions.
Even exposure across the entire studio environment.

No blue lighting.
No warm yellow lighting.
No colored light.
No dramatic cinematic lighting.
No colored ambient light bouncing onto the floor.

The lighting must remain identical for white, black,
silver, grey, red, blue and every other vehicle color.

3. FLOOR - WHITE GLOSSY STUDIO FLOOR

Clean, bright white glossy floor.
The floor must visually blend into the white background.

Keep the floor predominantly white.
Never generate a dark grey, black, blue or colored floor.

4. REFLECTION - SUBTLE AND CONTROLLED

Create a subtle, realistic floor reflection directly
beneath the vehicle.

Reflection appearance:
- Neutral light grey.
- Soft and semi-transparent.
- Approximately 15-20% visual opacity.
- Naturally inverted vehicle silhouette.
- Correct perspective and alignment.
- Gradually fading into pure white.

The reflection must be secondary to the vehicle.
It must never become a strong mirror image.

Do NOT create dark black reflections.
Do NOT create blue-tinted reflections.
Do NOT use the vehicle paint color as the reflection tint.
Do NOT allow reflection colors to determine floor colors.

The reflection must have consistent neutral grey tones
for every vehicle, regardless of its paint color.

5. SHADOW - SOFT NATURAL CONTACT SHADOW

Create a subtle, soft neutral grey contact shadow
directly beneath the tires and vehicle.

The shadow should be:
- Light grey.
- Soft-edged.
- Natural and realistic.
- Close to the vehicle.
- Gradually fading into the white floor.

No harsh black shadows.
No oversized dark shadows.
No colored shadows.
No dramatic high-contrast shadows.

6. VEHICLE PRESERVATION - CRITICAL

Preserve the exact original vehicle identity.

Maintain:
- Original body shape and proportions.
- Original paint color.
- Original wheels and tires.
- Original headlights and taillights.
- Original grille and badges.
- Original windows and mirrors.
- Original license plate.
- All original vehicle details.

Do not redesign, replace, distort or modify the vehicle.
Do not invent vehicle accessories or details.
Do not change the vehicle's original paint color.

The vehicle must remain sharp, realistic and photorealistic.

7. CAMERA AND COMPOSITION

Preserve the original camera perspective and viewing angle.
Maintain a natural front three-quarter automotive view
when supported by the original photograph.

Keep the vehicle naturally grounded on the floor.
Preserve realistic proportions and perspective.
Maintain a clean premium dealership composition.

8. STRICT COLOR CONSISTENCY RULE

This is the MOST IMPORTANT REQUIREMENT.

The studio environment must be independent
of the vehicle's paint color.

A white vehicle, black vehicle, blue vehicle,
silver vehicle or red vehicle MUST all receive
exactly the same white studio background.

Never allow vehicle color to influence:
- Background color.
- Floor color.
- Lighting temperature.
- Ambient lighting.
- Reflection color.
- Shadow color.

Only the vehicle itself may retain its original color.

9. FINAL OUTPUT STYLE

Premium luxury automotive dealership photography.
Bright, minimal, elegant and sophisticated.
Clean pure white studio.
Neutral lighting.
Soft grey reflection.
Soft natural contact shadow.

The final result must visually resemble
a professionally photographed vehicle
inside one consistent premium white automotive studio.

ABSOLUTELY NO:
Blue background.
Grey gradient background.
Dark background.
Black reflective floor.
Colored studio lighting.
Colored floor reflection.
Excessive mirror reflection.
Dark dramatic shadows.
Visible lighting equipment.
People, props or additional vehicles.
Added text or invented logos.
`;

    // Generate image using Bria AI.
    const briaResponse = await fetch(
      "https://engine.prod.bria-api.com/v1/product/vehicle/shot_by_text",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          api_token: briaToken,
        },
        body: JSON.stringify({
          image_url: sourceImageUrl,
          mode: "high_control",
          scene_description: sceneDescription,
          placement_type: "custom_coordinates",
          foreground_image_size: [810, 607],
          foreground_image_location: [135, 400],
          shot_size: [1080, 1350],
          num_results: 1,
          original_quality: true,
          optimize_description: false,
          sync: true,
        }),
      }
    );

    const briaBody = await briaResponse.json().catch(() => null) as {
      result?: unknown;
      message?: string;
      error?: string;
    } | null;

    if (!briaResponse.ok) {
      throw new Error(
        `Bria gagal (${briaResponse.status}): ${
          briaBody?.message ??
          briaBody?.error ??
          JSON.stringify(briaBody)
        }`
      );
    }

    const result = briaBody?.result;
    const firstResult = Array.isArray(result) ? result[0] : null;
    const generatedUrl = Array.isArray(firstResult)
      ? firstResult[0]
      : firstResult;

    if (
      typeof generatedUrl !== "string" ||
      !/^https:\/\/[^\s]+$/i.test(generatedUrl)
    ) {
      throw new Error(
        `URL hasil Bria tidak ditemukan: ${JSON.stringify(briaBody)}`
      );
    }

    // Unduh hasil Bria sebelum URL sementara kedaluwarsa.
    const imageResponse = await fetch(generatedUrl);

    if (!imageResponse.ok) {
      throw new Error(
        `Gagal mengunduh hasil Bria (${imageResponse.status})`
      );
    }

    const contentType = (
      imageResponse.headers.get("content-type") ?? ""
    ).split(";")[0].trim().toLowerCase();

    const formats: Record<string, string> = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp",
    };

    const ext = formats[contentType];

    if (!ext) {
      throw new Error(
        `Format gambar tidak didukung: ${contentType || "unknown"}`
      );
    }

    const bytes = new Uint8Array(await imageResponse.arrayBuffer());

    if (!bytes.length) {
      throw new Error("Hasil gambar Bria kosong");
    }

    // Simpan dengan nama unik; jangan hapus gambar lama.
    const path =
      `cars/${id}/cover-source/adigsi-ai-${Date.now()}-${crypto.randomUUID()}.${ext}`;

    await bucket.put(path, bytes, {
      httpMetadata: {
        contentType,
        cacheControl: "public, max-age=31536000, immutable",
      },
    });

    const publicUrl = `${publicBase}/${path}`;

    // Update hanya kolom PhotoRoom Polos yang sudah dipakai sistem.
    const { error: updateError } = await supabase
      .from("cars")
      .update({ cover_source_image_url: publicUrl })
      .eq("id", id);

    if (updateError) {
      throw new Error(
        `Gambar tersimpan di R2 tetapi database gagal diperbarui: ${updateError.message}`
      );
    }

    return Response.json({
      ok: true,
      cover_source_image_url: publicUrl,
      message: "ADIGSI-AI berhasil dibuat",
    });
  } catch (error) {
    console.error("generate-adigsi-ai:", error);

    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
};

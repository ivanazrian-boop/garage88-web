
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
PREMIUM AUTOMOTIVE ADVERTISING PHOTOGRAPHY.
STRICT AND CONSISTENT BLACK LUXURY STUDIO ENVIRONMENT.

MASTER VISUAL REFERENCE:
A high-end luxury automotive advertising photograph
inside a dark, seamless black automotive photography studio.

1. BACKGROUND - PURE BLACK

Pure deep black background.
Seamless black studio environment.
Clean, minimal and completely uncluttered.

The background must remain deep black
regardless of the vehicle's original paint color.

No white background.
No grey background.
No gradient background.
No visible walls.
No corners.
No horizon line.
No studio equipment.
No scenery.

Leave generous clean black negative space
above the vehicle for a premium advertising composition.

2. LIGHTING - PREMIUM DRAMATIC STUDIO LIGHTING

Professional high-end automotive studio lighting.

Use controlled softbox lighting from the upper front
and subtle directional lighting from the sides.

Create elegant highlights across:
- hood
- roof
- windshield
- grille
- headlights
- side body panels

Create subtle rim lighting around the vehicle silhouette
to separate the vehicle from the black background.

Lighting should be dramatic and cinematic
but remain realistic and commercially photographed.

Maintain accurate original vehicle paint color.

Do NOT use colored lighting.
Do NOT use blue lighting.
Do NOT use red lighting.
Do NOT use purple lighting.
Do NOT use neon lighting.
Do NOT create artificial glowing edges.

3. FLOOR - BLACK GLOSSY AUTOMOTIVE STUDIO FLOOR

Use a deep black glossy studio floor.

The floor must visually blend seamlessly
with the black background.

Create a premium polished automotive photography floor
with realistic controlled reflections.

The floor must remain black
regardless of the vehicle paint color.

4. VEHICLE REFLECTION - REALISTIC AND CONTROLLED

Create a realistic reflection of the vehicle
directly underneath it on the glossy black floor.

Reflection characteristics:
- realistic
- subtle but clearly visible
- horizontally aligned with the vehicle
- correct perspective
- naturally fading into darkness
- slightly softer than the actual vehicle

The reflection should look like
a real polished automotive studio floor.

Do NOT create an exaggerated mirror reflection.
Do NOT duplicate the vehicle.
Do NOT create a second vehicle.
Do NOT make the reflection brighter than the vehicle.

5. CONTACT SHADOW

Create a natural soft contact shadow
directly beneath the tires and vehicle.

The shadow should be:
- realistic
- soft-edged
- dark but controlled
- close to the vehicle
- naturally blending into the black floor

No oversized shadow.
No artificial black blob.
No colored shadow.

6. VEHICLE PRESERVATION - CRITICAL

Preserve the exact original vehicle identity.

Maintain:
- original body shape and proportions
- original paint color
- original wheels and tires
- original headlights and taillights
- original grille and badges
- original windows and mirrors
- original license plate
- all original vehicle details

Do not redesign the vehicle.
Do not replace the vehicle.
Do not change the vehicle model.
Do not change the wheels.
Do not change the headlights.
Do not change the grille.
Do not add accessories.
Do not remove original details.
Do not change the original paint color.

The vehicle must remain photorealistic
and highly detailed.

7. CAMERA AND COMPOSITION

Premium automotive advertising composition.

Maintain a natural front three-quarter view
when supported by the source image.

The vehicle should be positioned
in the lower-middle portion of the composition.

The complete vehicle must remain clearly visible.

Keep generous black negative space
above the vehicle.

The vehicle should feel powerful,
premium and visually dominant.

Use realistic automotive photography perspective.

Do not crop important parts of the vehicle.

8. COLOR CONSISTENCY

The studio environment must remain identical
for every vehicle.

A white vehicle, black vehicle, silver vehicle,
grey vehicle, red vehicle or blue vehicle
must all receive the same black luxury studio.

Only the vehicle itself retains its original color.

Vehicle paint color must NOT influence:
- background color
- floor color
- lighting color
- ambient light color
- reflection color
- shadow color

9. FINAL OUTPUT STYLE

High-end luxury automotive advertising photography.

Premium dealership campaign.
Black-on-black luxury aesthetic.
Photorealistic.
Sharp vehicle details.
Realistic paint reflections.
Realistic glass.
Realistic chrome.
Professional studio lighting.
Elegant cinematic contrast.
Clean commercial automotive photography.

The final image should look like
a professionally photographed luxury vehicle
inside an expensive black automotive photography studio.

ABSOLUTELY NO:
White background.
Grey background.
Grey gradient.
Blue background.
Colored background.
White floor.
Grey floor.
Blue floor.
Colored floor.
Colored studio lighting.
Neon lighting.
Excessive mirror reflection.
Duplicated vehicle.
Second vehicle.
People.
Props.
Showroom.
Road.
Outdoor scenery.
Visible lighting equipment.
Text.
Price.
Specifications.
Watermark.
Invented logos.
Modified vehicle.
Changed vehicle color.
Changed wheels.
Changed vehicle model.
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


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
STRICT VEHICLE PRESERVATION WITH A PREMIUM DARK AUTOMOTIVE STUDIO.

MASTER VISUAL REFERENCE:
A high-end luxury automotive advertising photograph
inside a premium dark charcoal and black automotive photography studio.

1. VEHICLE SCALE AND COMPOSITION - ABSOLUTELY CRITICAL

The original vehicle image is the PRIMARY COMPOSITION REFERENCE.

PRESERVE THE EXACT ORIGINAL VEHICLE SCALE, SIZE, POSITION,
CAMERA DISTANCE, FRAMING AND PROPORTIONS FROM THE SOURCE IMAGE.

DO NOT zoom in.
DO NOT zoom out.
DO NOT enlarge the vehicle.
DO NOT shrink the vehicle.
DO NOT move the vehicle significantly.
DO NOT change the camera distance.
DO NOT change the camera perspective.
DO NOT crop the vehicle differently.

The generated vehicle must occupy approximately
THE SAME PIXEL AREA AND VISUAL SIZE as the original source vehicle.

The vehicle's:
- overall width
- overall height
- wheel position
- roof position
- front bumper position
- rear position
- distance from image edges

must remain consistent with the source image.

The source photograph already has the correct automotive composition.
ONLY replace the surrounding environment.

Do NOT reinterpret the composition.

2. VEHICLE PRESERVATION - CRITICAL

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

3. BACKGROUND - PREMIUM DARK CHARCOAL STUDIO

Create a premium dark automotive photography studio.

The background should be:
- very dark charcoal
- near black
- clean
- seamless
- elegant
- minimal
- slightly brighter than pure black

Use a subtle natural studio gradient.

The upper background should be dark charcoal/black,
with a soft gradual transition toward the floor.

DO NOT make the entire background completely crushed black.

The background should retain subtle tonal separation
so the studio environment remains visible.

No visible walls.
No corners.
No horizon line.
No showroom.
No outdoor scenery.
No props.
No people.
No additional vehicles.

4. LIGHTING - PREMIUM SOFT AUTOMOTIVE LIGHTING

Use realistic professional automotive studio lighting.

Soft diffused lighting from above and from the front,
with subtle directional highlights from the sides.

Create realistic highlights on:
- hood
- roof
- windshield
- grille
- headlights
- side body panels

The lighting should create elegant separation
between the vehicle and the dark background.

Use soft highlights rather than harsh dramatic spotlights.

No colored lighting.
No blue lighting.
No red lighting.
No purple lighting.
No neon lighting.

5. FLOOR - DARK GLOSSY STUDIO FLOOR

Create a dark charcoal to black glossy automotive studio floor.

The floor should be clearly visible,
similar to a premium professional automotive photography studio.

The floor should have:
- subtle dark grey/black tonal variation
- realistic polished texture
- soft studio light falloff
- natural reflections

Do not make the floor completely black.

The floor should visually transition naturally
into the dark background.

6. VEHICLE REFLECTION - CONTROLLED

Create a realistic subtle reflection
directly underneath the vehicle.

The reflection must follow the exact vehicle position,
scale and perspective.

Reflection should be:
- subtle
- realistic
- slightly blurred
- darker than the actual vehicle
- naturally fading into the floor

DO NOT create a giant mirror reflection.

DO NOT duplicate the vehicle.

DO NOT create a second vehicle.

The reflection must not visually change
the perceived size or position of the actual vehicle.

7. CONTACT SHADOW

Create a natural soft contact shadow
directly beneath the tires.

The shadow should be:
- realistic
- soft-edged
- subtle
- close to the vehicle
- naturally blending into the glossy floor

8. CAMERA AND FRAMING

The camera perspective MUST remain consistent
with the original source image.

Preserve the original:
- camera angle
- focal perspective
- vehicle scale
- vehicle position
- framing
- proportions

The vehicle should remain at the same approximate
vertical and horizontal position as the source.

DO NOT recompose the photograph.

DO NOT create a different camera shot.

DO NOT move the vehicle toward the camera.

DO NOT make the vehicle larger than the source.

9. FINAL OUTPUT STYLE

High-end luxury automotive advertising photography.

Premium dealership campaign.
Dark charcoal and black luxury aesthetic.
Photorealistic.
Sharp vehicle details.
Realistic paint reflections.
Realistic glass.
Realistic chrome.
Professional soft studio lighting.
Elegant contrast.
Dark but clearly visible studio environment.
Premium glossy automotive floor.

The final image should look like
the SAME VEHICLE PHOTOGRAPH
with the original vehicle scale and composition preserved,
while replacing the original environment
with a premium dark automotive studio.

ABSOLUTELY NO:
White background.
Bright background.
Pure crushed-black background with no tonal separation.
Grey gradient that looks artificial.
Colored background.
Colored lighting.
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
Zoomed vehicle.
Shrunken vehicle.
Reframed vehicle.
Different camera distance.
Different vehicle position.
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

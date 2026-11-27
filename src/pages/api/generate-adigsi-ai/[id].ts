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

    const sceneDescription = `
PREMIUM AUTOMOTIVE ADVERTISING PHOTOGRAPHY.
PREMIUM DARK CHARCOAL AND BLACK AUTOMOTIVE STUDIO.

1. VEHICLE SCALE AND POSITION - CRITICAL

The vehicle must be slightly smaller than a typical close-up
automotive advertising composition.

Reduce the vehicle visual scale by approximately 5%.

Keep the complete vehicle clearly visible.
Do not crop the vehicle.

Position the vehicle slightly higher
within the portrait composition.

Maintain generous negative space above the vehicle.

Do not enlarge the vehicle.
Do not create an oversized vehicle.
Do not create an extreme close-up.

The vehicle should remain naturally grounded
on the glossy studio floor.

2. VEHICLE IDENTITY - ABSOLUTELY CRITICAL

Preserve the exact original vehicle.

Maintain:
- original body shape
- original proportions
- original paint color
- original wheels
- original tires
- original headlights
- original taillights
- original grille
- original badges
- original windows
- original mirrors
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

3. CAMERA AND VIEW

Use the same natural front three-quarter
automotive viewing angle as the source vehicle.

Do not create a different camera angle.
Do not rotate the vehicle.
Do not dramatically change perspective.

Do not make the vehicle appear closer
or farther away than necessary.

The vehicle must look like a professionally
photographed real vehicle.

4. BACKGROUND - DARK AUTOMOTIVE STUDIO WITH SOFT SMOKE

Create a premium dark automotive photography studio.

The background should be:
- very dark charcoal
- near black
- elegant
- cinematic
- smooth
- premium

Keep the overall background dark.

Add soft atmospheric smoke behind the vehicle
to create depth and separation.

The smoke should be approximately 40% LESS DENSE
than a strong cinematic smoke effect.

The smoke should remain clearly visible,
but soft, transparent and naturally diffused.

Smoke should appear primarily:
- behind the roof
- behind the upper body
- around the left and right sides of the vehicle

Keep the center area behind the vehicle
slightly illuminated by soft atmospheric diffusion,
but maintain a predominantly dark background.

The smoke should have:
- soft edges
- low opacity
- natural diffusion
- subtle grey-charcoal tones
- realistic studio atmosphere

The smoke must remain BEHIND the vehicle.

Do not cover the vehicle with smoke.

Do not place smoke in front of the vehicle.

Do not create thick dense smoke clouds.

Do not create dramatic fog.

Do not create a bright white background.

Do not create a bright blue background.

Do not create a large spotlight behind the vehicle.

Do not make the smoke brighter than the vehicle.

The smoke should feel like a subtle premium
automotive studio atmosphere,
not a smoke scene.

No visible wall.
No corner.
No horizon line.
No showroom.
No outdoor scenery.
No road.
No people.
No props.
No additional vehicles.

5. LIGHTING - PREMIUM SOFT STUDIO LIGHTING

Use professional automotive studio lighting.

Soft large diffused light from above and slightly in front.

Create controlled highlights on:
- hood
- roof
- windshield
- grille
- headlights
- side panels

Use subtle rim lighting to separate
the vehicle from the dark background.

Lighting must remain realistic and commercial.

The vehicle should be well exposed and clearly visible.

Do not make the vehicle disappear into the black background.

Do not create extreme cinematic darkness.

Do not use colored lighting.

No blue lighting.
No red lighting.
No purple lighting.
No neon lighting.
No artificial glowing edges.

6. FLOOR - DARK GLOSSY AUTOMOTIVE FLOOR

Create a dark charcoal/black glossy studio floor.

The floor must remain visible.

Use subtle realistic studio reflections.

The floor should have slightly lighter tonal variation
than the darkest parts of the background.

Do NOT make the entire floor pure black.

The floor should visually connect naturally
with the background.

7. REFLECTION - SHORT AND SUBTLE

Create a subtle realistic floor reflection
directly beneath the vehicle.

The reflection must be SHORT and LIMITED.

The visible reflection should extend only approximately
30-40% of the vehicle's visual height.

DO NOT create a full-length reflection.

DO NOT create a complete mirrored vehicle.

The reflection should fade out quickly
as it extends away from the vehicle.

The reflection should:
- remain directly underneath the vehicle
- follow the vehicle perspective
- be slightly blurred
- have reduced opacity
- gradually fade into the glossy floor
- remain secondary to the actual vehicle

The reflection should primarily show
a soft impression of the lower body,
wheels and headlights.

Do NOT reflect the entire vehicle body.

Do NOT extend the reflection far into
the foreground.

DO NOT create a large mirror reflection.

DO NOT create a duplicated vehicle.

DO NOT create a second vehicle.

The actual vehicle must remain clearly dominant.

The reflection should look like
a natural short studio-floor reflection,
approximately 30-40% of the vehicle height,
not a full mirror.

8. CONTACT SHADOW

Create a soft natural contact shadow
directly beneath the tires.

The shadow should be:
- realistic
- soft
- subtle
- close to the vehicle
- naturally blended into the floor

No oversized dark blob.
No artificial shadow.
No colored shadow.

9. COMPOSITION

Use a clean premium portrait automotive composition.

The vehicle should sit in the lower-middle
portion of the 1080x1350 frame.

Keep generous negative space above the vehicle.

Do not place the roof too close to the top edge.

Do not push the vehicle against the left or right edges.

Keep the entire vehicle comfortably inside the frame.

The composition should feel balanced,
luxurious and commercially photographed.

10. FINAL VISUAL STYLE

High-end luxury automotive dealership photography.

Dark charcoal and black luxury aesthetic.

Photorealistic.
Sharp vehicle details.
Realistic paint.
Realistic glass.
Realistic chrome.
Realistic headlights.
Professional soft studio lighting.
Premium glossy floor.
Short subtle realistic reflection.
Elegant dark background.
Soft atmospheric smoke behind the vehicle.
Clean commercial automotive advertising.

The smoke should remain subtle,
transparent and secondary to the vehicle.

The reflection should remain short,
controlled and secondary to the vehicle.

The final image should have a dark luxury
automotive mood with soft atmospheric depth.

The result should look like
a professionally photographed vehicle
inside a premium dark automotive studio.

ABSOLUTELY NO:
Oversized vehicle.
Extreme close-up.
Vehicle filling the entire frame.
Vehicle cropped.
Pure crushed-black background.
Flat black background with no tonal separation.
Bright background.
Bright grey background.
White background.
Blue background.
Colored background.
Large bright gradient.
Bright spotlight behind vehicle.
Blue glow.
White glow.
Colored lighting.
Neon lighting.
Excessive reflection.
Full-length reflection.
Full vehicle mirror reflection.
Giant mirror reflection.
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
          foreground_image_size: [720, 540],
          foreground_image_location: [155, 390],
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
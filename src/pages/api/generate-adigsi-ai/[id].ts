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

4. BACKGROUND - DARK BLACK STUDIO WITH MINIMAL ATMOSPHERIC DEPTH

Create a premium dark automotive photography studio.

The background must remain predominantly:
- deep black
- very dark charcoal
- subtle
- elegant
- low contrast

Keep the background dark and understated.

There must be NO obvious smoke,
NO visible smoke clouds,
NO fog,
NO dramatic atmosphere.

Add only an extremely subtle atmospheric diffusion
behind the vehicle.

The atmospheric diffusion should be barely visible
and function only as soft tonal separation
between the vehicle and the black background.

It should appear as a very faint dark-grey
softness immediately behind the vehicle.

The effect must be extremely restrained,
approximately 2-5% visual intensity.

Most of the background must remain deep black.

The atmospheric effect must:
- remain behind the vehicle
- stay soft and diffuse
- have no defined shape
- have no visible smoke trails
- have no curling smoke
- have no clouds
- have no fog banks
- have no bright areas

The vehicle must remain the dominant
and brightest subject.

The background must NEVER become brighter
than the vehicle.

Do not create a light source behind the vehicle.

Do not create a spotlight behind the vehicle.

Do not create a white glow.

Do not create a blue glow.

Do not create a grey glowing background.

Do not create cinematic fog.

Do not create visible smoke.

Do not create atmospheric clouds.

The final background should look almost black
at first glance, with only a very subtle
soft tonal separation behind the vehicle.

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

7. REFLECTION - SUBTLE AND REALISTIC

Create a controlled realistic reflection
directly beneath the vehicle.

The reflection should:
- follow the vehicle position
- follow the vehicle perspective
- be slightly blurred
- be darker than the actual vehicle
- gradually fade into the floor

The reflection must remain secondary.

DO NOT create a giant mirror reflection.

DO NOT create a duplicated vehicle.

DO NOT create a second vehicle.

DO NOT let the reflection become larger
or more visually dominant than the actual vehicle.

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
Subtle realistic reflection.
Elegant dark background.
Barely visible atmospheric depth.
Clean commercial automotive advertising.

The background must remain dark and understated.

The atmospheric effect is only a subtle
tonal separation and must never become
a visible smoke effect.

The final image should have a dark luxury
automotive mood with an almost imperceptible
atmospheric softness behind the vehicle.

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
Visible smoke.
Smoke clouds.
Thick smoke.
Fog.
Fog banks.
Curling smoke.
Smoke trails.
Atmospheric clouds.
Excessive reflection.
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
          foreground_image_size: [760, 570],
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
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
PREMIUM DARK CHARCOAL AUTOMOTIVE STUDIO.

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

4. BACKGROUND - DARK CHARCOAL WITH SOFT ATMOSPHERIC DEPTH

Create a premium dark charcoal automotive studio.

The background should be:
- dark charcoal
- near black
- smooth
- elegant
- minimal
- seamless

Do NOT make the background completely crushed black.

Maintain subtle tonal separation in the background.

Add a very subtle soft atmospheric studio haze
behind the vehicle.

The haze should appear primarily:
- behind the roof
- behind the upper body
- around the sides of the vehicle

Use soft dark-grey to charcoal atmospheric diffusion.

The haze should gently brighten and separate
the background from the vehicle.

It should look like subtle professional studio atmosphere,
NOT visible smoke from a fire.

No smoke clouds covering the vehicle.
No thick fog.
No dramatic smoke.
No smoke in front of the vehicle.
No visible smoke trails.

The vehicle must remain sharp and unobstructed.

The background should have subtle depth,
similar to an expensive automotive photography studio.

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
Clean commercial automotive advertising.

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
White background.
Bright grey background.
Blue background.
Colored background.
Colored lighting.
Neon lighting.
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
          foreground_image_size: [770, 577],
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
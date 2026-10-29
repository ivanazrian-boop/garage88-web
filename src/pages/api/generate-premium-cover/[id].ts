
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { createClient } from "@supabase/supabase-js";

import {
  buildPremiumCoverHtml,
  getPremiumTopPhotoUrls,
} from "../../../lib/premiumCoverTemplate";

import {
  buildGarage88MetaSquareHtml,
} from "../../../lib/metaSquareTemplate";

export const prerender = false;

type BrowserBinding = {
  quickAction: (
    action: "screenshot",
    options: Record<string, unknown>
  ) => Promise<Response>;
};

type R2BucketBinding = {
  put: (
    key: string,
    value: Uint8Array,
    options?: {
      httpMetadata?: {
        contentType?: string;
        cacheControl?: string;
      };
    }
  ) => Promise<unknown>;
};

function getRequiredEnv(name: string): string {
  // Cloudflare Worker environment (production).
  const cloudflareValue =
    (env as Record<string, unknown>)[name];

  if (
    typeof cloudflareValue === "string" &&
    cloudflareValue.trim()
  ) {
    return cloudflareValue.trim();
  }

  // Local Astro environment fallback.
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function renderJpeg(
  browser: BrowserBinding,
  html: string,
  width: number,
  height: number,
  label: string
): Promise<Uint8Array> {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await browser.quickAction("screenshot", {
      html,
      viewport: {
        width,
        height,
        deviceScaleFactor: 1,
      },
      screenshotOptions: {
        type: "jpeg",
        quality: 95,
        fullPage: false,
      },
      gotoOptions: {
        waitUntil: "networkidle0",
        timeout: 30000,
      },
    });

    if (response.ok) {
      const jpeg = new Uint8Array(await response.arrayBuffer());

      if (jpeg.length === 0) {
        throw new Error(`${label}: hasil JPEG kosong`);
      }

      return jpeg;
    }

    if (response.status === 429 && attempt < maxAttempts) {
      console.warn(
        `${label}: browser rate limit, retry ${attempt}/${maxAttempts}`
      );

      await sleep(11000);
      continue;
    }

    throw new Error(
      `${label} gagal (${response.status}): ${await response.text()}`
    );
  }

  throw new Error(`${label} gagal setelah retry`);
}

export const POST: APIRoute = async ({ params, request }) => {
  try {
    const id = params.id;

    if (!id) {
      return Response.json(
        { ok: false, error: "Missing car id" },
        { status: 400 }
      );
    }

    let heroFromAdmin: string | null = null;

    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const body = (await request.json().catch(() => null)) as
        | { hero_title?: unknown }
        | null;

      if (body && Object.prototype.hasOwnProperty.call(body, "hero_title")) {
        heroFromAdmin =
          typeof body.hero_title === "string"
            ? body.hero_title.trim()
            : "";
      }
    }

    const supabase = createClient(
      getRequiredEnv("SUPABASE_URL"),
      getRequiredEnv("SUPABASE_SERVICE_KEY"),
      {
        auth: {
          persistSession: false,
        },
      }
    );

    const bindings = env as Record<string, unknown>;

    const browser = bindings.BROWSER as BrowserBinding | undefined;
    const bucket = bindings.R2_BUCKET as R2BucketBinding | undefined;

    if (!browser) {
      throw new Error("Missing Cloudflare BROWSER binding");
    }

    if (!bucket) {
      throw new Error("R2_BUCKET binding tidak tersedia");
    }

    const publicBase = getRequiredEnv("R2_PUBLIC_URL").replace(/\/+$/, "");

    const { data: car, error: carError } = await supabase
      .from("cars")
      .select("*")
      .eq("id", id)
      .single();

    if (carError || !car) {
      throw new Error(carError?.message || "Car not found");
    }

    const sourceImageUrl = String(
      car.cover_source_image_url ?? ""
    ).trim();

    if (!sourceImageUrl) {
      return Response.json(
        {
          ok: false,
          error: "Upload PHOTOROOM POLOS terlebih dahulu",
        },
        { status: 400 }
      );
    }

    const { data: images, error: imagesError } = await supabase
      .from("car_images")
      .select("image_url, sort_order")
      .eq("car_id", id)
      .order("sort_order", { ascending: true });

    if (imagesError) {
      throw new Error(
        `Gagal mengambil foto tambahan: ${imagesError.message}`
      );
    }

    const existingHero = String(
      car.cover_hero_title ?? ""
    ).trim();

    let resolvedHero: string;

    if (heroFromAdmin !== null) {
      resolvedHero = heroFromAdmin || existingHero;
    } else {
      resolvedHero = existingHero;
    }

    const carForCover = {
      ...car,
      cover_hero_title: resolvedHero,
    };

    const topPhotoUrls = getPremiumTopPhotoUrls(images ?? []);

    // IG menggunakan template Premium yang sudah ada.
    const premiumHtml = buildPremiumCoverHtml(
      carForCover,
      sourceImageUrl,
      topPhotoUrls
    );

    // Meta menggunakan template Meta yang sudah ada.
    const metaHtml = buildGarage88MetaSquareHtml(
      carForCover,
      sourceImageUrl
    );

    console.log("Render Premium IG Cover:", id);

    const premiumJpeg = await renderJpeg(
      browser,
      premiumHtml,
      1080,
      1350,
      "Premium IG Cover"
    );

    // Jeda untuk mengurangi risiko browser rate limit.
    await sleep(11000);

    console.log("Render Meta Cover:", id);

    const metaJpeg = await renderJpeg(
      browser,
      metaHtml,
      1080,
      1080,
      "Meta Cover"
    );

    const igPath = `cars/${id}/generated/ig-cover.jpg`;
    const metaPath = `cars/${id}/generated/meta-cover.jpg`;

    const igUrl = `${publicBase}/${igPath}`;
    const metaUrl = `${publicBase}/${metaPath}`;

    // Simpan kedua hasil ke R2.
    await Promise.all([
      bucket.put(igPath, premiumJpeg, {
        httpMetadata: {
          contentType: "image/jpeg",
          cacheControl: "public, max-age=3600",
        },
      }),
      bucket.put(metaPath, metaJpeg, {
        httpMetadata: {
          contentType: "image/jpeg",
          cacheControl: "public, max-age=3600",
        },
      }),
    ]);

    // Update database setelah kedua hasil berhasil di-render dan disimpan.
    const updateData: Record<string, unknown> = {
      ig_image_url: igUrl,
      meta_image_url: metaUrl,
      cover_needs_regenerate: false,
    };

    if (resolvedHero) {
      updateData.cover_hero_title = resolvedHero;
    }

    const { error: updateError } = await supabase
      .from("cars")
      .update(updateData)
      .eq("id", id);

    if (updateError) {
      throw new Error(`DB update gagal: ${updateError.message}`);
    }

    console.log("Premium IG Cover tersimpan:", igUrl);
    console.log("Meta Cover tersimpan:", metaUrl);

    return Response.json({
      ok: true,
      car_id: id,
      cover_hero_title: resolvedHero,
      ig_image_url: igUrl,
      meta_image_url: metaUrl,
    });
  } catch (error) {
    console.error("generate-premium-cover:", error);

    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
};

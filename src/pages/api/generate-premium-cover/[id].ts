import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { createClient } from "@supabase/supabase-js";

import {
  buildPremiumCoverHtml,
  getPremiumTopPhotoUrls,
} from "../../../lib/premiumCoverTemplate";

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
      };
    }
  ) => Promise<unknown>;
};

function getRequiredEnv(name: string): string {
  const value = (env as Record<string, unknown>)[name];

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing Cloudflare env: ${name}`);
  }

  return value;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function renderPremiumJpeg(
  browser: BrowserBinding,
  html: string
): Promise<Uint8Array> {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await browser.quickAction("screenshot", {
      html,
      viewport: {
        width: 1080,
        height: 1350,
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
        throw new Error("Browser menghasilkan file JPEG kosong");
      }

      return jpeg;
    }

    if (response.status === 429 && attempt < maxAttempts) {
      console.warn(
        `Browser rate limit. Retry ${attempt}/${maxAttempts}`
      );

      await sleep(11000);
      continue;
    }

    throw new Error(
      `Premium screenshot gagal (${response.status}): ${await response.text()}`
    );
  }

  throw new Error("Premium screenshot gagal setelah retry");
}

export const POST: APIRoute = async ({ params, request }) => {
  try {
    const id = params.id;

    if (!id) {
      return new Response("Missing car id", { status: 400 });
    }

    // Baca judul hero dari admin bila dikirim.
    let heroFromAdmin: string | null = null;

    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const body = (await request.json().catch(() => null)) as
        | { hero_title?: unknown }
        | null;

      if (
        body &&
        Object.prototype.hasOwnProperty.call(body, "hero_title")
      ) {
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

    const browser = bindings.BROWSER as
      | BrowserBinding
      | undefined;

    const bucket = bindings.R2_BUCKET as
      | R2BucketBinding
      | undefined;

    if (!browser) {
      throw new Error("Missing Cloudflare BROWSER binding");
    }

    if (!bucket) {
      throw new Error(
        "R2_BUCKET binding tidak tersedia. Periksa wrangler.jsonc."
      );
    }

    const publicBase = getRequiredEnv("R2_PUBLIC_URL")
      .replace(/\/+$/, "");

    // Ambil data mobil.
    const { data: car, error: carError } = await supabase
      .from("cars")
      .select("*")
      .eq("id", id)
      .single();

    if (carError || !car) {
      throw new Error(carError?.message || "Car not found");
    }

    // Foto utama dari hasil PhotoRoom.
    const sourceImageUrl = String(
      car.cover_source_image_url ?? ""
    ).trim();

    if (!sourceImageUrl) {
      return new Response(
        "Upload PHOTOROOM POLOS terlebih dahulu",
        { status: 400 }
      );
    }

    // Ambil foto tambahan berdasarkan urutan database.
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

    // Tentukan judul hero.
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

    // Bangun HTML dengan desain Premium asli.
    const html = buildPremiumCoverHtml(
      carForCover,
      sourceImageUrl,
      topPhotoUrls
    );

    console.log("Render Premium Cover:", id);
    console.log("Hero:", resolvedHero);
    console.log("Foto tambahan:", topPhotoUrls.length);

    const jpeg = await renderPremiumJpeg(browser, html);

    // Premium menimpa IG Cover utama.
    // Meta Cover tidak disentuh.
    const igPath = `${id}/generated/ig-cover.jpg`;
    const igUrl = `${publicBase}/${igPath}`;

    await bucket.put(igPath, jpeg, {
      httpMetadata: {
        contentType: "image/jpeg",
      },
    });

    // Perbarui URL IG dan judul hero saja.
    const updateData: Record<string, unknown> = {
      ig_image_url: igUrl,
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

    console.log("Premium Cover tersimpan:", igUrl);

    return Response.json({
      ok: true,
      car_id: id,
      cover_hero_title: resolvedHero,
      ig_image_url: igUrl,
      meta_unchanged: true,
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

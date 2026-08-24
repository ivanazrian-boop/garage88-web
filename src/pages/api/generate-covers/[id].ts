import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { createClient } from "@supabase/supabase-js";
import { buildGarage88CoverHtml } from "../../../lib/coverTemplates";

export const prerender = false;

type BrowserBinding = {
  quickAction: (
    action: "screenshot",
    options: Record<string, unknown>
  ) => Promise<Response>;
};

function getRequiredEnv(name: string): string {
  const value = (env as Record<string, unknown>)[name];
  if (!value || typeof value !== "string") {
    throw new Error(`Missing Cloudflare env: ${name}`);
  }
  return value;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function renderJpeg(
  browser: BrowserBinding,
  html: string,
  width: number,
  height: number
): Promise<Uint8Array> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await browser.quickAction("screenshot", {
      html,
      viewport: {
        width,
        height,
        deviceScaleFactor: 1,
      },
      screenshotOptions: {
        type: "jpeg",
        quality: 92,
        fullPage: false,
      },
      gotoOptions: {
        waitUntil: "networkidle0",
        timeout: 30000,
      },
    });

    if (response.ok) {
      return new Uint8Array(await response.arrayBuffer());
    }

    if (response.status === 429 && attempt < 2) {
      const retryAfter = Number(response.headers.get("retry-after") || "10");
      const waitMs = Math.max(11_000, retryAfter * 1000 + 1000);
      console.log(`Browser Run rate limited. Retry in ${waitMs}ms`);
      await sleep(waitMs);
      continue;
    }

    throw new Error(
      `Browser Run screenshot failed (${response.status}): ${await response.text()}`
    );
  }

  throw new Error("Browser Run screenshot failed after retries");
}

export const POST: APIRoute = async ({ params }) => {
  try {
    const id = params.id;
    if (!id) {
      return new Response("Missing car id", { status: 400 });
    }

    const supabaseUrl = getRequiredEnv("SUPABASE_URL");
    const serviceKey = getRequiredEnv("SUPABASE_SERVICE_KEY");
    const browser = (env as Record<string, unknown>).BROWSER as BrowserBinding | undefined;

    if (!browser) {
      throw new Error("Missing Cloudflare BROWSER binding");
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const [{ data: car, error: carError }, { data: images, error: imagesError }] =
      await Promise.all([
        supabase.from("cars").select("*").eq("id", id).single(),
        supabase
          .from("car_images")
          .select("image_url,sort_order")
          .eq("car_id", id)
          .order("sort_order", { ascending: true }),
      ]);

    if (carError || !car) {
      throw new Error(carError?.message || "Car not found");
    }

    if (imagesError) {
      throw new Error(imagesError.message);
    }

    if (!images?.length) {
      return new Response("Mobil belum punya foto", { status: 400 });
    }

    const imageTop = images[0].image_url;
    const imageBottom = images[1]?.image_url ?? images[0].image_url;

    const igHtml = buildGarage88CoverHtml(car, imageTop, imageBottom, "ig");
    const metaHtml = buildGarage88CoverHtml(car, imageTop, imageBottom, "meta");

    // Render sequentially.
    // Cloudflare Workers Free allows only one Quick Action every 10 seconds,
    // so never fire the IG + Meta screenshots in parallel.
    const igJpeg = await renderJpeg(browser, igHtml, 1080, 1350);

    await sleep(11_000);

    const metaJpeg = await renderJpeg(browser, metaHtml, 1080, 1080);

    // Keep fixed filenames and upsert.
    // Admin preview already cache-busts meta with ?v=Date.now().
    const igPath = `${id}/generated/ig-cover.jpg`;
    const metaPath = `${id}/generated/meta-cover.jpg`;

    const [igUpload, metaUpload] = await Promise.all([
      supabase.storage.from("cars").upload(igPath, igJpeg, {
        contentType: "image/jpeg",
        cacheControl: "0",
        upsert: true,
      }),
      supabase.storage.from("cars").upload(metaPath, metaJpeg, {
        contentType: "image/jpeg",
        cacheControl: "0",
        upsert: true,
      }),
    ]);

    if (igUpload.error) throw new Error(`IG upload: ${igUpload.error.message}`);
    if (metaUpload.error) throw new Error(`Meta upload: ${metaUpload.error.message}`);

    const igUrl = supabase.storage.from("cars").getPublicUrl(igPath).data.publicUrl;
    const metaUrl = supabase.storage.from("cars").getPublicUrl(metaPath).data.publicUrl;

    const { error: updateError } = await supabase
      .from("cars")
      .update({
        ig_image_url: igUrl,
        meta_image_url: metaUrl,
      })
      .eq("id", id);

    if (updateError) {
      throw new Error(`DB update: ${updateError.message}`);
    }

    return Response.json({
      ok: true,
      car_id: id,
      ig_image_url: igUrl,
      meta_image_url: metaUrl,
    });
  } catch (error) {
    console.error("generate-covers:", error);

    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
};

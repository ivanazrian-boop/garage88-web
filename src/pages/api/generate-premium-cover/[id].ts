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

  list: (options?: {
    prefix?: string;
  }) => Promise<{
    objects: Array<{
      key: string;
    }>;
  }>;

  delete: (keys: string | string[]) => Promise<void>;
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
      const jpeg = new Uint8Array(
        await response.arrayBuffer()
      );

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

/**
 * Cari semua Meta Cover versi lama untuk mobil ini.
 *
 * Yang dicari:
 *   cars/{id}/generated/meta-cover-*.jpg
 *
 * Sekaligus mendukung file legacy:
 *   cars/{id}/generated/meta-cover.jpg
 */
async function getOldMetaCoverKeys(
  bucket: R2BucketBinding,
  id: string
): Promise<string[]> {
  const prefix = `cars/${id}/generated/`;

  const result = await bucket.list({
    prefix,
  });

  return result.objects
    .map((object) => object.key)
    .filter((key) => {
      return (
        key === `${prefix}meta-cover.jpg` ||
        /^cars\/.+\/generated\/meta-cover-v\d+\.jpg$/.test(key)
      );
    });
}

/**
 * Tentukan nomor versi berikutnya berdasarkan file yang sudah ada.
 *
 * Contoh:
 *   meta-cover-v1.jpg
 *   meta-cover-v2.jpg
 *   meta-cover-v5.jpg
 *
 * hasil:
 *   6
 */
function getNextMetaVersion(keys: string[]): number {
  let highestVersion = 0;

  for (const key of keys) {
    const match = key.match(
      /meta-cover-v(\d+)\.jpg$/
    );

    if (!match) {
      continue;
    }

    const version = Number(match[1]);

    if (
      Number.isFinite(version) &&
      version > highestVersion
    ) {
      highestVersion = version;
    }
  }

  return highestVersion + 1;
}

export const POST: APIRoute = async ({
  params,
  request,
}) => {
  try {
    const id = params.id;

    if (!id) {
      return Response.json(
        {
          ok: false,
          error: "Missing car id",
        },
        {
          status: 400,
        }
      );
    }

    let heroFromAdmin: string | null = null;

    const contentType =
      request.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const body = (await request
        .json()
        .catch(() => null)) as
        | {
            hero_title?: unknown;
          }
        | null;

      if (
        body &&
        Object.prototype.hasOwnProperty.call(
          body,
          "hero_title"
        )
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

    const bindings =
      env as Record<string, unknown>;

    const browser =
      bindings.BROWSER as
        | BrowserBinding
        | undefined;

    const bucket =
      bindings.R2_BUCKET as
        | R2BucketBinding
        | undefined;

    if (!browser) {
      throw new Error(
        "Missing Cloudflare BROWSER binding"
      );
    }

    if (!bucket) {
      throw new Error(
        "R2_BUCKET binding tidak tersedia"
      );
    }

    const publicBase =
      getRequiredEnv("R2_PUBLIC_URL").replace(
        /\/+$/,
        ""
      );

    const { data: car, error: carError } =
      await supabase
        .from("cars")
        .select("*")
        .eq("id", id)
        .single();

    if (carError || !car) {
      throw new Error(
        carError?.message || "Car not found"
      );
    }

    const sourceImageUrl = String(
      car.cover_source_image_url ?? ""
    ).trim();

    if (!sourceImageUrl) {
      return Response.json(
        {
          ok: false,
          error:
            "Upload PHOTOROOM POLOS terlebih dahulu",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data: images,
      error: imagesError,
    } = await supabase
      .from("car_images")
      .select("image_url, sort_order")
      .eq("car_id", id)
      .order("sort_order", {
        ascending: true,
      });

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
      resolvedHero =
        heroFromAdmin || existingHero;
    } else {
      resolvedHero = existingHero;
    }

    const carForCover = {
      ...car,
      cover_hero_title: resolvedHero,
    };

    const topPhotoUrls =
      getPremiumTopPhotoUrls(images ?? []);

    // IG menggunakan template Premium yang sudah ada.
    const premiumHtml =
      buildPremiumCoverHtml(
        carForCover,
        sourceImageUrl,
        topPhotoUrls
      );

    // Meta menggunakan template Meta yang sudah ada.
    const metaHtml =
      buildGarage88MetaSquareHtml(
        carForCover,
        sourceImageUrl
      );

    console.log(
      "Render Premium IG Cover:",
      id
    );

    const premiumJpeg =
      await renderJpeg(
        browser,
        premiumHtml,
        1080,
        1350,
        "Premium IG Cover"
      );

    // Jeda untuk mengurangi risiko browser rate limit.
    await sleep(11000);

    console.log(
      "Render Meta Cover:",
      id
    );

    const metaJpeg =
      await renderJpeg(
        browser,
        metaHtml,
        1080,
        1080,
        "Meta Cover"
      );

    /*
     * =====================================================
     * IG COVER
     * =====================================================
     *
     * IG tetap menggunakan nama file yang sama.
     */
    const igPath =
      `cars/${id}/generated/ig-cover.jpg`;

    const igUrl =
      `${publicBase}/${igPath}`;


    /*
     * =====================================================
     * META COVER VERSIONING
     * =====================================================
     *
     * Setiap generate:
     *
     *   v1
     *   v2
     *   v3
     *   ...
     *
     * URL selalu berubah sehingga Commerce Manager
     * melihat image_link sebagai URL baru.
     */

    const oldMetaKeys =
      await getOldMetaCoverKeys(
        bucket,
        id
      );

    const nextVersion =
      getNextMetaVersion(
        oldMetaKeys
      );

    const metaPath =
      `cars/${id}/generated/meta-cover-v${nextVersion}.jpg`;

    const metaUrl =
      `${publicBase}/${metaPath}`;

    console.log(
      "Meta Cover version:",
      nextVersion
    );

    console.log(
      "Meta Cover path:",
      metaPath
    );


    /*
     * =====================================================
     * UPLOAD
     * =====================================================
     *
     * Upload versi baru terlebih dahulu.
     *
     * File lama JANGAN dihapus sebelum upload berhasil.
     */
    await Promise.all([
      bucket.put(
        igPath,
        premiumJpeg,
        {
          httpMetadata: {
            contentType: "image/jpeg",
            cacheControl:
              "public, max-age=3600",
          },
        }
      ),

      bucket.put(
        metaPath,
        metaJpeg,
        {
          httpMetadata: {
            contentType: "image/jpeg",
            cacheControl:
              "public, max-age=3600",
          },
        }
      ),
    ]);


    /*
     * =====================================================
     * UPDATE DATABASE
     * =====================================================
     *
     * meta_image_url sekarang menunjuk ke URL baru.
     */
    const updateData:
      Record<string, unknown> = {
      ig_image_url: igUrl,
      meta_image_url: metaUrl,
      cover_needs_regenerate: false,
    };

    if (resolvedHero) {
      updateData.cover_hero_title =
        resolvedHero;
    }

    const {
      error: updateError,
    } = await supabase
      .from("cars")
      .update(updateData)
      .eq("id", id);

    if (updateError) {
      /*
       * DB gagal → jangan hapus cover lama.
       *
       * Kita hapus file baru agar DB tidak
       * meninggalkan URL yang tidak dipakai.
       */
      try {
        await bucket.delete(metaPath);
      } catch (cleanupError) {
        console.error(
          "Gagal cleanup Meta Cover baru:",
          cleanupError
        );
      }

      throw new Error(
        `DB update gagal: ${updateError.message}`
      );
    }


    /*
     * =====================================================
     * DELETE META COVER LAMA
     * =====================================================
     *
     * Dilakukan SETELAH:
     *
     * 1. Render berhasil
     * 2. Upload berhasil
     * 3. DB berhasil menunjuk ke URL baru
     *
     * Jadi versi lama aman sampai versi baru benar-benar aktif.
     */
    const metaKeysToDelete =
      oldMetaKeys.filter(
        (key) => key !== metaPath
      );

    if (metaKeysToDelete.length > 0) {
      try {
        await bucket.delete(
          metaKeysToDelete
        );

        console.log(
          "Meta Cover lama dihapus:",
          metaKeysToDelete
        );
      } catch (deleteError) {
        /*
         * Kalau delete gagal, proses utama tetap sukses.
         *
         * DB sudah menunjuk ke cover baru.
         * File lama hanya menjadi orphan sementara
         * dan bisa dibersihkan kemudian.
         */
        console.error(
          "Gagal menghapus Meta Cover lama:",
          deleteError
        );
      }
    }


    console.log(
      "Premium IG Cover tersimpan:",
      igUrl
    );

    console.log(
      "Meta Cover tersimpan:",
      metaUrl
    );

    return Response.json({
      ok: true,
      car_id: id,
      cover_hero_title:
        resolvedHero,
      ig_image_url:
        igUrl,
      meta_image_url:
        metaUrl,
      meta_version:
        nextVersion,
      deleted_old_meta_covers:
        metaKeysToDelete,
    });

  } catch (error) {
    console.error(
      "generate-premium-cover:",
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status: 500,
      }
    );
  }
};
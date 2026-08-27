import type {
  APIRoute,
} from "astro";

import {
  env,
} from "cloudflare:workers";

import {
  createClient,
} from "@supabase/supabase-js";

import {
  buildGarage88IgCoverHtml,
  buildGarage88AutoHeroTitle,
} from "../../../lib/igCoverTemplate";

import {
  buildGarage88MetaSquareHtml,
} from "../../../lib/metaSquareTemplate";


export const prerender =
  false;


type BrowserBinding = {
  quickAction: (
    action: "screenshot",
    options: Record<string, unknown>
  ) => Promise<Response>;
};


function getRequiredEnv(
  name: string
): string {

  const value =
    (
      env as Record<
        string,
        unknown
      >
    )[name];


  if (
    !value ||
    typeof value !== "string"
  ) {
    throw new Error(
      `Missing Cloudflare env: ${name}`
    );
  }


  return value;
}


function sleep(
  ms: number
) {
  return new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        ms
      )
  );
}


async function renderJpeg(
  browser: BrowserBinding,
  html: string,
  width: number,
  height: number
): Promise<Uint8Array> {

  const maxAttempts = 3;


  for (
    let attempt = 1;
    attempt <= maxAttempts;
    attempt++
  ) {

    const response =
      await browser.quickAction(
        "screenshot",
        {
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
            waitUntil:
              "networkidle0",

            timeout:
              30000,
          },
        }
      );


    if (response.ok) {

      return new Uint8Array(
        await response.arrayBuffer()
      );

    }


    if (
      response.status === 429 &&
      attempt < maxAttempts
    ) {

      console.log(
        `Browser rate limit. Retry ${attempt}/${maxAttempts}`
      );


      await sleep(
        11_000
      );


      continue;
    }


    throw new Error(
      `Browser screenshot failed (${response.status}): ${await response.text()}`
    );
  }


  throw new Error(
    "Browser screenshot failed after retries"
  );
}


export const POST:
  APIRoute =
  async ({
    params,
    request,
  }) => {

  try {

    const id =
      params.id;


    if (!id) {

      return new Response(
        "Missing car id",
        {
          status: 400,
        }
      );

    }


    /* =================================
       READ HERO FROM ADMIN
       ================================= */

    let heroFromAdmin:
      string | null =
      null;


    const contentType =
      request.headers.get(
        "content-type"
      ) ?? "";


    if (
      contentType.includes(
        "application/json"
      )
    ) {

      try {

        const body =
          await request.json() as {
            hero_title?: unknown;
          };


        /*
         * null = field tidak dikirim.
         *
         * "" = user mengosongkan field,
         * berarti kembali ke AUTO.
         */

        if (
          Object.prototype.hasOwnProperty.call(
            body,
            "hero_title"
          )
        ) {

          heroFromAdmin =
            typeof body.hero_title ===
            "string"
              ? body.hero_title.trim()
              : "";

        }

      } catch {

        heroFromAdmin =
          null;

      }

    }


    /* =================================
       ENV
       ================================= */

    const supabaseUrl =
      getRequiredEnv(
        "SUPABASE_URL"
      );


    const serviceKey =
      getRequiredEnv(
        "SUPABASE_SERVICE_KEY"
      );


    const browser =
      (
        env as Record<
          string,
          unknown
        >
      ).BROWSER as
        BrowserBinding |
        undefined;


    if (!browser) {

      throw new Error(
        "Missing Cloudflare BROWSER binding"
      );

    }


    const supabase =
      createClient(
        supabaseUrl,
        serviceKey,
        {
          auth: {
            persistSession:
              false,
          },
        }
      );


    /* =================================
       GET CAR
       ================================= */

    const {
      data: car,
      error: carError,
    } =
      await supabase
        .from("cars")
        .select("*")
        .eq(
          "id",
          id
        )
        .single();


    if (
      carError ||
      !car
    ) {

      throw new Error(
        carError?.message ||
        "Car not found"
      );

    }


    /* =================================
       PHOTOROOM
       ================================= */

    const sourceImageUrl =
      String(
        car.cover_source_image_url ??
        ""
      ).trim();


    if (!sourceImageUrl) {

      return new Response(
        "Upload PHOTOROOM POLOS terlebih dahulu",
        {
          status: 400,
        }
      );

    }


    /* =================================
       HERO
       ================================= */

    const existingHero =
      String(
        car.cover_hero_title ??
        ""
      ).trim();


    let resolvedHero =
      "";


    /*
     * Kalau admin mengirim field:
     *
     * ada isi -> pakai isi admin
     * kosong   -> buat AUTO lagi
     */

    if (
      heroFromAdmin !== null
    ) {

      resolvedHero =
        heroFromAdmin ||
        buildGarage88AutoHeroTitle(
          car
        );

    }

    /*
     * Kalau request lama / script lain:
     *
     * gunakan yang sudah tersimpan.
     */

    else if (existingHero) {

      resolvedHero =
        existingHero;

    }

    /*
     * Belum pernah punya Hero:
     * generate otomatis.
     */

    else {

      resolvedHero =
        buildGarage88AutoHeroTitle(
          car
        );

    }


    resolvedHero =
      resolvedHero
        .replace(/\s+/g, " ")
        .trim()
        .toUpperCase();


    console.log(
      "Cover Hero:",
      resolvedHero
    );


    /*
     * Yang diberikan ke kedua template.
     */

    const carForCover = {
      ...car,

      cover_hero_title:
        resolvedHero,
    };


    /* =================================
       BUILD HTML
       ================================= */

    const igHtml =
      buildGarage88IgCoverHtml(
        carForCover,
        sourceImageUrl
      );


    const metaHtml =
      buildGarage88MetaSquareHtml(
        carForCover,
        sourceImageUrl
      );


    /* =================================
       IG
       ================================= */

    console.log(
      "Render IG Cover..."
    );


    const igJpeg =
      await renderJpeg(
        browser,
        igHtml,
        1080,
        1350
      );


    await sleep(
      11_000
    );


    /* =================================
       META
       ================================= */

    console.log(
      "Render Meta Cover..."
    );


    const metaJpeg =
      await renderJpeg(
        browser,
        metaHtml,
        1080,
        1080
      );


    /* =================================
       STORAGE
       ================================= */

    const igPath =
      `${id}/generated/ig-cover.jpg`;


    const metaPath =
      `${id}/generated/meta-cover.jpg`;


    const [
      igUpload,
      metaUpload,
    ] =
      await Promise.all([

        supabase
          .storage
          .from("cars")
          .upload(
            igPath,
            igJpeg,
            {
              contentType:
                "image/jpeg",

              cacheControl:
                "0",

              upsert:
                true,
            }
          ),


        supabase
          .storage
          .from("cars")
          .upload(
            metaPath,
            metaJpeg,
            {
              contentType:
                "image/jpeg",

              cacheControl:
                "0",

              upsert:
                true,
            }
          ),

      ]);


    if (
      igUpload.error
    ) {

      throw new Error(
        `IG upload: ${igUpload.error.message}`
      );

    }


    if (
      metaUpload.error
    ) {

      throw new Error(
        `Meta upload: ${metaUpload.error.message}`
      );

    }


    /* =================================
       URL
       ================================= */

    const igUrl =
      supabase
        .storage
        .from("cars")
        .getPublicUrl(
          igPath
        )
        .data
        .publicUrl;


    const metaUrl =
      supabase
        .storage
        .from("cars")
        .getPublicUrl(
          metaPath
        )
        .data
        .publicUrl;


    /* =================================
       SAVE EVERYTHING
       ================================= */

    const {
      error: updateError,
    } =
      await supabase
        .from("cars")
        .update({

          cover_hero_title:
            resolvedHero,

          cover_needs_regenerate:
            false,

          ig_image_url:
            igUrl,

          meta_image_url:
            metaUrl,

        })
        .eq(
          "id",
          id
        );


    if (
      updateError
    ) {

      throw new Error(
        `DB update: ${updateError.message}`
      );

    }


    return Response.json({

      ok: true,

      car_id:
        id,

      cover_hero_title:
        resolvedHero,

      source_image_url:
        sourceImageUrl,

      ig_image_url:
        igUrl,

      meta_image_url:
        metaUrl,

    });


  } catch (error) {

    console.error(
      "generate-covers:",
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
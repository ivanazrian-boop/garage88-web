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
      env as unknown as Record<
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


    /*
     * Cloudflare Browser Free:
     * minimum sekitar 10 detik
     * antar Quick Action.
     */

    if (
      response.status === 429 &&
      attempt < maxAttempts
    ) {
      console.log(
        `Browser rate limit. Retry ${attempt}/${maxAttempts}...`
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
        env as unknown as Record<
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
       PHOTOROOM SOURCE

       IG + META sekarang
       menggunakan source yang sama.
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
       BUILD HTML
       ================================= */

    const igHtml =
      buildGarage88IgCoverHtml(
        car,
        sourceImageUrl
      );


    const metaHtml =
      buildGarage88MetaSquareHtml(
        car,
        sourceImageUrl
      );


    /* =================================
       RENDER IG
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


    /*
     * Cloudflare Browser Free
     * jangan render kedua langsung.
     */

    await sleep(
      11_000
    );


    /* =================================
       RENDER META
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
       STORAGE PATH
       ================================= */

    const igPath =
      `${id}/generated/ig-cover.jpg`;


    const metaPath =
      `${id}/generated/meta-cover.jpg`;


    /* =================================
       UPLOAD
       ================================= */

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
       PUBLIC URL
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
       DATABASE
       ================================= */

    const {
      error:
        updateError,
    } =
      await supabase
        .from("cars")
        .update({
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


    /* =================================
       DONE
       ================================= */

    return Response.json({
      ok: true,

      car_id:
        id,

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
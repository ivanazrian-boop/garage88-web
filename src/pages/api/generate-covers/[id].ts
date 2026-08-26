import type { APIRoute } from "astro";

import { env } from "cloudflare:workers";

import {
  createClient,
} from "@supabase/supabase-js";

import {
  buildGarage88CoverHtml,
} from "../../../lib/coverTemplates";

import {
  buildGarage88IgCoverHtml,
} from "../../../lib/igCoverTemplate";


export const prerender = false;



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
    (env as Record<string, unknown>)[name];


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
      setTimeout(resolve, ms)
  );

}



async function renderJpeg(

  browser: BrowserBinding,

  html: string,

  width: number,

  height: number

): Promise<Uint8Array> {


  for (
    let attempt = 0;
    attempt < 3;
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

            quality: 94,

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
      attempt < 2
    ) {

      const retryAfter =
        Number(
          response.headers.get(
            "retry-after"
          ) || "10"
        );


      const waitMs =
        Math.max(
          11_000,
          retryAfter * 1000 + 1000
        );


      console.log(
        `Browser Run rate limited. Retry in ${waitMs}ms`
      );


      await sleep(waitMs);

      continue;

    }


    throw new Error(

      `Browser Run screenshot failed (${response.status}): ${await response.text()}`

    );

  }


  throw new Error(
    "Browser Run screenshot failed after retries"
  );

}



export const POST: APIRoute =
async ({ params }) => {


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
            persistSession: false,
          },

        }
      );



    // ==============================
    // LOAD CAR + GALLERY
    // ==============================

    const [

      {
        data: car,
        error: carError,
      },

      {
        data: images,
        error: imagesError,
      },

    ] =
      await Promise.all([


        supabase
          .from("cars")
          .select("*")
          .eq("id", id)
          .single(),


        supabase
          .from("car_images")
          .select(
            "image_url,sort_order"
          )
          .eq(
            "car_id",
            id
          )
          .order(
            "sort_order",
            {
              ascending: true,
            }
          ),

      ]);



    if (
      carError ||
      !car
    ) {

      throw new Error(
        carError?.message ||
        "Car not found"
      );

    }



    if (imagesError) {

      throw new Error(
        imagesError.message
      );

    }



    // ==============================
    // PHOTOROOM WAJIB UNTUK IG
    // ==============================

    if (
      !car.cover_source_image_url ||
      String(
        car.cover_source_image_url
      ).trim() === ""
    ) {

      return new Response(

        "Upload PHOTOROOM POLOS terlebih dahulu",

        {
          status: 400,
        }

      );

    }



    // ==============================
    // GALLERY WAJIB UNTUK META
    // ==============================

    if (
      !images ||
      images.length === 0
    ) {

      return new Response(

        "Mobil belum punya foto gallery",

        {
          status: 400,
        }

      );

    }



    const imageTop =
      images[0].image_url;


    const imageBottom =
      images[1]?.image_url ??
      images[0].image_url;



    // ==============================
    // BUILD IG BARU
    // ==============================

    const igHtml =
      buildGarage88IgCoverHtml(

        car,

        car.cover_source_image_url

      );



    // ==============================
    // META TETAP TEMPLATE LAMA
    // ==============================

    const metaHtml =
      buildGarage88CoverHtml(

        car,

        imageTop,

        imageBottom,

        "meta"

      );



    // ==============================
    // RENDER IG
    // ==============================

    console.log(
      "Render IG PhotoRoom 1080x1350..."
    );


    const igJpeg =
      await renderJpeg(

        browser,

        igHtml,

        1080,

        1350

      );



    // Cloudflare Browser Free:
    // hindari screenshot paralel

    await sleep(
      11_000
    );



    // ==============================
    // RENDER META
    // ==============================

    console.log(
      "Render Meta 1080x1080..."
    );


    const metaJpeg =
      await renderJpeg(

        browser,

        metaHtml,

        1080,

        1080

      );



    // ==============================
    // PATH
    // ==============================

    const igPath =
      `${id}/generated/ig-cover.jpg`;


    const metaPath =
      `${id}/generated/meta-cover.jpg`;



    // ==============================
    // UPLOAD
    // ==============================

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



    // ==============================
    // PUBLIC URL
    // ==============================

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



    // ==============================
    // UPDATE DATABASE
    // ==============================

    const {
      error: updateError,
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



    return Response.json({

      ok:
        true,

      car_id:
        id,

      cover_source_image_url:
        car.cover_source_image_url,

      ig_image_url:
        igUrl,

      meta_image_url:
        metaUrl,

    });



  }

  catch (error) {


    console.error(
      "generate-covers:",
      error
    );


    return Response.json(

      {

        ok:
          false,

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
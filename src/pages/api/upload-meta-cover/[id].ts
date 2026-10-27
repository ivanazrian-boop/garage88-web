import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { createClient } from "@supabase/supabase-js";


export const prerender = false;



function getRequiredEnv(name: string): string {
  const value = (env as Record<string, unknown>)[name];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing Cloudflare env: ${name}`);
  }
  return value;
}

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



export const POST: APIRoute = async ({ params, request }) => {


  try {


    const id = params.id;


    if (!id) {

      return new Response(
        "Missing ID",
        {
          status: 400
        }
      );

    }



    const formData =
      await request.formData();



    const file =
      formData.get("file") as File;



    if (!file) {

      return new Response(
        "No file",
        {
          status: 400
        }
      );

    }



    const buffer = new Uint8Array(await file.arrayBuffer());

    const bindings = env as Record<string, unknown>;
    const bucket = bindings.R2_BUCKET as R2BucketBinding | undefined;

    if (!bucket) {
      throw new Error("R2_BUCKET binding tidak tersedia");
    }

    const publicBase = getRequiredEnv("R2_PUBLIC_URL").replace(/\/+$/, "");
    const fileName = `${id}/generated/meta-cover.jpg`;

    await bucket.put(fileName, buffer, {
      httpMetadata: {
        contentType: file.type || "image/jpeg",
        cacheControl: "public, max-age=3600",
      },
    });

    const imageUrl = `${publicBase}/${fileName}`;

    const update =
      await supabase
      .from("cars")
      .update({

        meta_image_url:
        imageUrl

      })
      .eq(
        "id",
        id
      );





    if (update.error) {


      console.error(
        update.error
      );


      return new Response(

        JSON.stringify({
          error:update.error.message
        }),

        {
          status:500
        }

      );

    }





    return new Response(

      JSON.stringify({

        success:true,

        url:
        imageUrl

      }),

      {
        status:200
      }

    );




  } catch(error) {


    console.error(
      error
    );


    return new Response(

      JSON.stringify({

        error:
        String(error)

      }),

      {
        status:500
      }

    );


  }


};

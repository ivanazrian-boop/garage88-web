import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";


export const prerender = false;



const supabase = createClient(
  import.meta.env.SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_KEY
);



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



    // Cloudflare compatible
    const buffer =
      await file.arrayBuffer();



    const fileName =
      `${id}.jpg`;



    const upload =
      await supabase.storage
      .from("meta_covers")
      .upload(

        fileName,

        buffer,

        {
          contentType: file.type || "image/jpeg",
          upsert: true
        }

      );



    if (upload.error) {


      console.error(
        upload.error
      );


      return new Response(

        JSON.stringify({
          error: upload.error.message
        }),

        {
          status: 500
        }

      );

    }





    const {
      data: publicUrl
    } =
    supabase.storage
    .from("meta_covers")
    .getPublicUrl(
      fileName
    );





    const update =
      await supabase
      .from("cars")
      .update({

        meta_image_url:
        publicUrl.publicUrl

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
        publicUrl.publicUrl

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
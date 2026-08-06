import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";


export const prerender = false;


const supabase = createClient(
  import.meta.env.SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_KEY
);



export const POST: APIRoute = async ({ params }) => {


  try {


    const id = params.id;


    if(!id){

      return new Response(
        "Missing ID",
        {
          status:400
        }
      );

    }



    console.log(
      "QUEUE META COVER:",
      id
    );



    const {
      data:existing
    } =
    await supabase

    .from("meta_cover_jobs")

    .select("id,status")

    .eq(
      "car_id",
      id
    )

    .in(
      "status",
      [
        "pending",
        "processing"
      ]
    )

    .maybeSingle();




    if(existing){

      return new Response(

        JSON.stringify({

          success:true,

          message:"Already queued"

        }),

        {
          headers:{
            "Content-Type":
            "application/json"
          }
        }

      );

    }




    const {
      error
    } =
    await supabase

    .from("meta_cover_jobs")

    .insert({

      car_id:id,

      status:"pending"

    });





    if(error){

      console.error(error);


      return new Response(

        JSON.stringify(error),

        {
          status:500,
          headers:{
            "Content-Type":
            "application/json"
          }
        }

      );

    }




    return new Response(

      JSON.stringify({

        success:true,

        message:"Added to queue"

      }),

      {
        headers:{
          "Content-Type":
          "application/json"
        }
      }

    );



  }
  catch(error){


    console.error(error);


    return new Response(

      JSON.stringify({

        error:String(error)

      }),

      {
        status:500,
        headers:{
          "Content-Type":
          "application/json"
        }
      }

    );


  }


};
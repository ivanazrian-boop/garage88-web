import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";


export const POST: APIRoute = async ({
  request
}) => {


  try {


    const body =
      await request.json();



    const {
      images
    } = body;



    if(
      !images ||
      !Array.isArray(images)
    ){

      return new Response(
        JSON.stringify({
          error:"Invalid data"
        }),
        {
          status:400
        }
      );

    }




    for(
      const item of images
    ){


      await supabase
        .from("car_images")
        .update({

          sort_order:
            item.sort_order

        })
        .eq(
          "id",
          item.id
        );


    }





    return new Response(
      JSON.stringify({
        success:true
      }),
      {
        status:200
      }
    );



  } catch(error){


    console.error(
      error
    );


    return new Response(
      JSON.stringify({
        error:"Server error"
      }),
      {
        status:500
      }
    );


  }


};
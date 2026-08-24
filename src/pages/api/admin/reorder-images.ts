import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";


export const POST: APIRoute = async ({
  request
}) => {


  try {


    const body =
  (await request.json()) as {
    images?: Array<{
      id: string;
      sort_order: number;
    }>;
  };

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
          status:400,
          headers:{
            "Content-Type":"application/json"
          }
        }
      );

    }




    for(
      const item of images
    ){


      const {
        error
      } =
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



      if(error){


        console.error(
          "Reorder error:",
          error
        );


        return new Response(
          JSON.stringify({
            error:error.message
          }),
          {
            status:500,
            headers:{
              "Content-Type":"application/json"
            }
          }
        );


      }


    }





    return new Response(
      JSON.stringify({
        success:true
      }),
      {
        status:200,
        headers:{
          "Content-Type":"application/json"
        }
      }
    );



  } catch(error){


    console.error(
      "Reorder server error:",
      error
    );


    return new Response(
      JSON.stringify({
        error:"Server error"
      }),
      {
        status:500,
        headers:{
          "Content-Type":"application/json"
        }
      }
    );


  }


};
import type { APIRoute } from "astro";
import {
  getCarsPaginated,
  searchCarsPaginated,
} from "../../services/cars.service";


export const GET: APIRoute = async ({ url }) => {


  const page =
    Number(
      url.searchParams.get("page") ?? "1"
    );


  const q =
    url.searchParams.get("q") ?? "";



  let result;



  if(q){

    result =
      await searchCarsPaginated(
        q,
        page
      );

  } else {


    result =
      await getCarsPaginated(
        page
      );

  }



  return new Response(

    JSON.stringify({

      data: result.cars,

      page,

      totalPages:
        result.totalPages

    }),

    {
      status:200,

      headers:{
        "Content-Type":
        "application/json"
      }

    }

  );


};
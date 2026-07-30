import type { APIRoute } from "astro";

import {
  getCarsPaginated,
  searchCarsPaginated,
  filterCarsPaginated,
} from "../../services/cars.service";

import CarCard from "../../components/CarCard.astro";

import { experimental_AstroContainer } from "astro/container";



export const GET: APIRoute = async ({ url }) => {


  const page =
    Number(
      url.searchParams.get("page") ?? "1"
    );


  const q =
    url.searchParams.get("q") ?? "";


  const price =
    url.searchParams.get("price") ?? "";



  let result;



  /*
    PRIORITAS:
    1. Price
    2. Search
    3. Semua
  */


  if(price){


    result =
      await filterCarsPaginated(
        price,
        page
      );


  }
  else if(q){


    result =
      await searchCarsPaginated(
        q,
        page
      );


  }
  else {


    result =
      await getCarsPaginated(
        page
      );


  }





  const container =
    await experimental_AstroContainer.create();




  const html =
    await Promise.all(

      result.cars.map(
        async(car)=>{


          return await container.renderToString(
            CarCard,
            {
              props:{
                car
              }
            }
          );


        }

      )

    );





  return new Response(

    JSON.stringify({

      html:
        html.join(""),


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
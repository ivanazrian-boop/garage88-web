import { supabase } from "../lib/supabase";
import type { Car } from "../types/car";


const CAR_SELECT = `
  *,
  images:car_images (
    id,
    car_id,
    image_url,
    sort_order,
    created_at
  )
`;



export async function getCars(): Promise<Car[]> {


  const { data, error } =
    await supabase
      .from("cars")
      .select(CAR_SELECT)
      .eq("status", "READY")
      .order(
        "created_at",
        {
          ascending:false
        }
      );


  if(error){

    console.error(
      "getCars:",
      error
    );

    return [];

  }


  return (data ?? []) as Car[];

}





export async function getCarsPaginated(
  page = 1
) {


  const limit = 21;


  const from =
    (page - 1) * limit;


  const to =
    from + limit - 1;



  const {
    data,
    count,
    error
  } =
    await supabase
      .from("cars")
      .select(
        CAR_SELECT,
        {
          count:"exact"
        }
      )
      .eq(
        "status",
        "READY"
      )
      .order(
        "featured",
        {
          ascending:false
        }
      )
      .order(
        "created_at",
        {
          ascending:false
        }
      )
      .range(
        from,
        to
      );



  if(error){

    console.error(
      "getCarsPaginated:",
      error
    );

    return {
      cars:[],
      totalPages:1
    };

  }



  return {

    cars:(data ?? []) as Car[],

    totalPages:
      Math.ceil(
        (count ?? 0) / limit
      )

  };

}





export async function searchCars(
  keyword:string
):Promise<Car[]>{


  const words =
    keyword
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);



  if(words.length === 0){

    return getCars();

  }



  const { data,error } =
    await supabase
      .from("cars")
      .select(CAR_SELECT);



  if(error){

    console.error(
      "searchCars:",
      error
    );

    return [];

  }




  return (data ?? [])
  .filter((car)=>{


    const text = [

      car.brand,
      car.model,
      car.variant,
      car.color,
      car.fuel,
      car.transmission,
      car.year,
      car.odometer,
      car.description

    ]
    .join(" ")
    .toLowerCase();




    return words.every(
      word =>
        text.includes(word)
    );


  }) as Car[];

}



export async function searchCarsPaginated(
  keyword:string,
  page = 1
){


  const limit = 21;


  const words =
    keyword
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);



  const {
    data,
    error
  } =
    await supabase
      .from("cars")
      .select(CAR_SELECT)
      .eq(
        "status",
        "READY"
      )
      .order(
        "featured",
        {
          ascending:false
        }
      )
      .order(
        "created_at",
        {
          ascending:false
        }
      );



  if(error){

    console.error(
      error
    );


    return {
      cars:[],
      totalPages:1
    };

  }



  const filtered =
    (data ?? [])
    .filter((car)=>{


      const searchable = [

        car.brand,
        car.model,
        car.variant,
        car.color,
        car.fuel,
        car.transmission,
        car.year,
        car.odometer

      ]
      .join(" ")
      .toLowerCase();



      return words.every(
        word =>
          searchable.includes(word)
      );


    });



  const from =
    (page - 1) * limit;



  return {


    cars:
      filtered
      .slice(
        from,
        from + limit
      ) as Car[],


    totalPages:
      Math.ceil(
        filtered.length / limit
      )


  };


}





export async function filterCarsPaginated(
  price:string,
  page = 1
){


  const limit = 21;


  const from =
    (page - 1) * limit;


  const to =
    from + limit - 1;



  let min = 0;

  let max = 9999999999;



  switch(price){


    case "0-150":

      min = 0;
      max = 150000000;

      break;



    case "150-250":

      min = 150000000;
      max = 250000000;

      break;



    case "250-300":

      min = 250000000;
      max = 300000000;

      break;



    case "300-up":

      min = 300000000;

      break;


  }



  const {
    data,
    count,
    error
  } =
    await supabase
      .from("cars")
      .select(
        CAR_SELECT,
        {
          count:"exact"
        }
      )
      .eq(
        "status",
        "READY"
      )
      .gte(
        "credit_price",
        min
      )
      .lte(
        "credit_price",
        max
      )
      .order(
        "featured",
        {
          ascending:false
        }
      )
      .order(
        "created_at",
        {
          ascending:false
        }
      )
      .range(
        from,
        to
      );



  if(error){

    console.error(
      "filterCarsPaginated:",
      error
    );


    return {
      cars:[],
      totalPages:1
    };

  }



  return {


    cars:(data ?? []) as Car[],


    totalPages:
      Math.ceil(
        (count ?? 0) / limit
      )


  };


}





export async function getFeaturedCars():Promise<Car[]> {


  const { data,error } =
    await supabase
      .from("cars")
      .select(CAR_SELECT)
      .eq(
        "status",
        "READY"
      )
      .eq(
        "featured",
        true
      )
      .order(
        "created_at",
        {
          ascending:false
        }
      );



  if(error){

    console.error(
      error
    );

    return [];

  }



  return (data ?? []) as Car[];

}





export async function getCarBySlug(
  slug:string
):Promise<Car | null>{


  const { data,error } =
    await supabase
      .from("cars")
      .select(CAR_SELECT)
      .eq(
        "slug",
        slug
      )
      .eq(
        "status",
        "READY"
      )
      .single();



  if(error){

    console.error(
      error
    );

    return null;

  }



  return data as Car;

}





export async function getBrands()
:Promise<string[]>{


  const { data,error } =
    await supabase
      .from("cars")
      .select("brand")
      .eq(
        "status",
        "READY"
      );



  if(error){

    console.error(
      error
    );

    return [];

  }



  return [
    ...new Set(
      (data ?? [])
      .map(x=>x.brand)
    )
  ]
  .sort();


}

export async function getNonFeaturedCars(): Promise<Car[]> {


  const {
    data,
    error
  } =
    await supabase
      .from("cars")
      .select(CAR_SELECT)
      .eq(
        "status",
        "READY"
      )
      .eq(
        "featured",
        false
      )
      .order(
        "created_at",
        {
          ascending:false
        }
      );



  if(error){

    console.error(
      "getNonFeaturedCars:",
      error
    );

    return [];

  }



  return (data ?? []) as Car[];

}
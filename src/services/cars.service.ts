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

  const { data, error } = await supabase
    .from("cars")
    .select(CAR_SELECT)
    .eq("status", "READY")
    .order("featured", {
      ascending: false
    })
    .order("created_at", {
      ascending: false
    });


  if (error) {

    console.error(
      "getCars:",
      error
    );

    return [];

  }


  return (data ?? []) as Car[];

}





export async function searchCars(
  keyword: string
): Promise<Car[]> {


  const q =
    keyword.trim();


  if (!q) {

    return getCars();

  }



  const words =
    q
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);



  const { data, error } =
    await supabase
      .from("cars")
      .select(CAR_SELECT)
      .eq("status","READY")
      .order("featured", {
        ascending:false
      })
      .order("created_at", {
        ascending:false
      });



  if(error){

    console.error(
      "searchCars:",
      error
    );

    return [];

  }



  const cars =
    (data ?? []) as Car[];



  const results =
    cars.filter((car)=>{


      const searchable = [

        car.brand,

        car.model,

        car.variant,

        car.color,

        car.fuel,

        car.transmission,

        String(car.year),

        String(car.odometer ?? "")

      ]
      .join(" ")
      .toLowerCase();



      return words.every(
        word =>
          searchable.includes(word)
      );


    });



  return results;

}





export async function getFeaturedCars(): Promise<Car[]> {


  const { data, error } =
    await supabase
      .from("cars")
      .select(CAR_SELECT)
      .eq("status","READY")
      .eq("featured",true)
      .order("created_at", {
        ascending:false
      });



  if(error){

    console.error(
      "getFeaturedCars:",
      error
    );

    return [];

  }



  return (data ?? []) as Car[];

}





export async function getCarBySlug(
  slug:string
): Promise<Car | null> {


  const { data,error } =
    await supabase
      .from("cars")
      .select(CAR_SELECT)
      .eq("slug",slug)
      .eq("status","READY")
      .single();



  if(error){

    console.error(
      "getCarBySlug:",
      error
    );

    return null;

  }



  return data as Car;

}





export async function getBrands()
: Promise<string[]> {


  const { data,error } =
    await supabase
      .from("cars")
      .select("brand")
      .eq("status","READY");



  if(error){

    console.error(
      "getBrands:",
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
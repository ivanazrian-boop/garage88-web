import { supabase } from "../lib/supabase";
import type { CarImage } from "../types/car-image";

export async function getImages(carId: string): Promise<CarImage[]> {
  const { data, error } = await supabase
    .from("car_images")
    .select("*")
    .eq("car_id", carId)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Error loading car images:", error);
    return [];
  }

  return data as CarImage[];
}

export async function getMainImage(carId: string): Promise<CarImage | null> {
  const { data, error } = await supabase
    .from("car_images")
    .select("*")
    .eq("car_id", carId)
    .order("sort_order", { ascending: true })
    .limit(1)
    .single();

  if (error) {
    return null;
  }

  return data as CarImage;
}

export async function getCarBySlug(slug: string) {
  const { data, error } = await supabase
    .from("cars")
    .select("*")
    .eq("slug", slug)
    .eq("status", "READY")
    .single();

  if (error) {
    console.error(error);
    return null;
  }

  return data;
}
import type { CarImage } from "./car-image";

export interface Car {

  id: string;

  slug: string;

  brand: string;

  model: string;

  variant: string | null;

  year: number;

  branch: string | null;

  color: string | null;

  fuel: string | null;

  transmission: string | null;

  odometer: number | null;

  credit_price: number | null;

  cash_price: number | null;

  dp: number | null;

  plate_number: string | null;

  tax_valid_until: string | null;

  description: string | null;

  status: string;

  featured: boolean;

  created_at: string;

  updated_at: string;

  cover_source_image_url: string | null;

  meta_image_url: string | null;

  ig_image_url: string | null;

  images: CarImage[];

}
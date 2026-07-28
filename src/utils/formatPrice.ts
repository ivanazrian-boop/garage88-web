export function formatPrice(price: number | null): string {
  if (!price) return "-";

  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(price);
}
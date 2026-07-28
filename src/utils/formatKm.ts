export function formatKm(km: number): string {
  return new Intl.NumberFormat("id-ID").format(km);
}
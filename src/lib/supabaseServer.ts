
import { env } from "cloudflare:workers";
import { createClient } from "@supabase/supabase-js";

function getServerEnv(name: string): string {
  // Prioritas: binding/secret Cloudflare Worker.
  const cloudflareValue =
    (env as Record<string, unknown>)[name];

  if (
    typeof cloudflareValue === "string" &&
    cloudflareValue.trim()
  ) {
    return cloudflareValue.trim();
  }

  // Fallback: environment lokal Astro/Vite.
  const localValue =
    (import.meta.env as Record<string, unknown>)[name];

  if (
    typeof localValue === "string" &&
    localValue.trim()
  ) {
    return localValue.trim();
  }

  throw new Error(
    `Konfigurasi server ${name} belum tersedia. Periksa .env atau secret Cloudflare.`
  );
}

export function createSupabaseServerClient() {
  return createClient(
    getServerEnv("SUPABASE_URL"),
    getServerEnv("SUPABASE_SERVICE_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

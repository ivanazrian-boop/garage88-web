import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

function getRequiredEnv(name: string): string {
  const value = (env as unknown as Record<string, unknown>)[name];

  if (!value || typeof value !== "string") {
    throw new Error(`Missing Cloudflare env: ${name}`);
  }

  return value;
}

export const POST: APIRoute = async ({ params, request }) => {
  try {
    const id = params.id;

    if (!id) {
      return new Response("Missing car id", {
        status: 400,
      });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const slotValue = formData.get("slot");

    if (
      slotValue !== null &&
      slotValue !== "1" &&
      slotValue !== "2"
    ) {
      return new Response("Slot upload tidak valid", {
        status: 400,
      });
    }

    // Default slot 1 untuk menjaga kompatibilitas upload lama.
    const slot = slotValue === "2" ? 2 : 1;

    if (!(file instanceof File)) {
      return new Response("Gambar tidak ditemukan", {
        status: 400,
      });
    }

    if (!file.type.startsWith("image/")) {
      return new Response("File harus berupa gambar", {
        status: 400,
      });
    }

    const supabase = createClient(
      getRequiredEnv("SUPABASE_URL"),
      getRequiredEnv("SUPABASE_SERVICE_KEY"),
      {
        auth: {
          persistSession: false,
        },
      }
    );

    const ext =
      file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
        ? "webp"
        : "jpg";

    // Nama object tetap: upload berikutnya menimpa object yang sama.
    const filename =
      slot === 2
        ? `photoroom-2.${ext}`
        : `photoroom.${ext}`;

    const path = `cars/${id}/cover-source/${filename}`;

    const bytes = new Uint8Array(await file.arrayBuffer());
    const bindings = env as Record<string, unknown>;

    const bucket = bindings.R2_BUCKET as
      | {
          put: (
            key: string,
            value: Uint8Array,
            options?: {
              httpMetadata?: {
                contentType?: string;
                cacheControl?: string;
              };
            }
          ) => Promise<unknown>;
        }
      | undefined;

    if (!bucket) {
      throw new Error("R2_BUCKET binding tidak tersedia");
    }

    const publicBase = getRequiredEnv("R2_PUBLIC_URL").replace(/\/+$/, "");

    // Overwrite object yang sama dan minta browser/CDN selalu revalidate.
    await bucket.put(path, bytes, {
      httpMetadata: {
        contentType: file.type,
        cacheControl: "no-store, no-cache, max-age=0, must-revalidate",
      },
    });

    // Query parameter hanya untuk cache-busting URL, bukan membuat object/version baru.
    const publicUrl = `${publicBase}/${path}?t=${Date.now()}`;

    const column =
      slot === 2
        ? "cover_source_image_url_2"
        : "cover_source_image_url";

    const updateData: Record<string, string> = {
      [column]: publicUrl,
    };

    const { error: updateError } = await supabase
      .from("cars")
      .update(updateData)
      .eq("id", id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return Response.json({
      ok: true,
      slot,
      [column]: publicUrl,
    });
  } catch (error) {
    console.error("upload-cover-source:", error);

    return new Response(
      error instanceof Error ? error.message : String(error),
      {
        status: 500,
      }
    );
  }
};

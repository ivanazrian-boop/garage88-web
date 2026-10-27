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

    const path =
      `${id}/cover-source/photoroom.${ext}`;

    const bytes =
      new Uint8Array(await file.arrayBuffer());

    const bindings = env as Record<string, unknown>;

    const bucket = bindings.R2_BUCKET as {
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
    } | undefined;

    if (!bucket) {
      throw new Error("R2_BUCKET binding tidak tersedia");
    }

    const publicBase = getRequiredEnv("R2_PUBLIC_URL").replace(/\/+$/, "");

    await bucket.put(path, bytes, {
      httpMetadata: {
        contentType: file.type,
        cacheControl: "public, max-age=3600",
      },
    });

    const publicUrl = `${publicBase}/${path}`;

    const { error: updateError } =
      await supabase
        .from("cars")
        .update({
          cover_source_image_url: publicUrl,
        })
        .eq("id", id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return Response.json({
      ok: true,
      cover_source_image_url: publicUrl,
    });

  } catch (error) {
    console.error("upload-cover-source:", error);

    return new Response(
      error instanceof Error
        ? error.message
        : String(error),
      {
        status: 500,
      }
    );
  }
};

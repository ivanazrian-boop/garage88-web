import type {
  APIRoute,
} from "astro";

import {
  env,
} from "cloudflare:workers";

import {
  createClient,
} from "@supabase/supabase-js";


export const prerender =
  false;


const ADMIN_KEY =
  "garage88";


type BulkHeroItem = {
  id: string;
  cover_hero_title: string;
};


function getRequiredEnv(
  name: string
): string {

  const value =
    (
      env as Record<
        string,
        unknown
      >
    )[name];


  if (
    !value ||
    typeof value !== "string"
  ) {

    throw new Error(
      `Missing Cloudflare env: ${name}`
    );

  }


  return value;
}


function normalizeHero(
  value: unknown
): string {

  return String(
    value ?? ""
  )
    .replace(
      /\s+/g,
      " "
    )
    .trim()
    .toUpperCase();
}


function isUuid(
  value: string
): boolean {

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );

}


export const POST:
  APIRoute =
  async ({
    request,
  }) => {

  try {

    const body =
      await request.json() as {
        key?: unknown;
        items?: unknown;
      };


    if (
      body.key !==
      ADMIN_KEY
    ) {

      return Response.json(
        {
          ok: false,
          error:
            "Unauthorized",
        },
        {
          status: 401,
        }
      );

    }


    if (
      !Array.isArray(
        body.items
      )
    ) {

      return Response.json(
        {
          ok: false,
          error:
            "items harus berupa array",
        },
        {
          status: 400,
        }
      );

    }


    if (
      body.items.length >
      300
    ) {

      return Response.json(
        {
          ok: false,
          error:
            "Maksimal 300 item sekali save",
        },
        {
          status: 400,
        }
      );

    }


    const items:
      BulkHeroItem[] =
      [];


    for (
      const raw of
      body.items
    ) {

      if (
        !raw ||
        typeof raw !==
          "object"
      ) {
        continue;
      }


      const row =
        raw as Record<
          string,
          unknown
        >;


      const id =
        String(
          row.id ?? ""
        ).trim();


      if (
        !isUuid(id)
      ) {
        continue;
      }


      const hero =
        normalizeHero(
          row.cover_hero_title
        );


      if (
        hero.length >
        160
      ) {

        return Response.json(
          {
            ok: false,
            error:
              `Hero terlalu panjang untuk ${id}`,
          },
          {
            status: 400,
          }
        );

      }


      items.push({
        id,
        cover_hero_title:
          hero,
      });

    }


    if (
      items.length === 0
    ) {

      return Response.json(
        {
          ok: false,
          error:
            "Tidak ada perubahan valid",
        },
        {
          status: 400,
        }
      );

    }


    const supabase =
      createClient(
        getRequiredEnv(
          "SUPABASE_URL"
        ),
        getRequiredEnv(
          "SUPABASE_SERVICE_KEY"
        ),
        {
          auth: {
            persistSession:
              false,

            autoRefreshToken:
              false,
          },
        }
      );


    const savedIds:
      string[] =
      [];


    const errors:
      Array<{
        id: string;
        error: string;
      }> =
      [];


    /*
     * Sengaja sequential.
     *
     * Bulk Hero umumnya hanya
     * puluhan row, jadi lebih aman
     * daripada melempar 100 request
     * sekaligus ke Supabase.
     */

    for (
      const item of
      items
    ) {

      const {
        error,
      } =
        await supabase
          .from("cars")
          .update({

            cover_hero_title:
              item.cover_hero_title ||
              null,

            cover_needs_regenerate:
              true,

          })
          .eq(
            "id",
            item.id
          )
          .eq(
            "status",
            "READY"
          );


      if (error) {

        errors.push({
          id:
            item.id,

          error:
            error.message,
        });


        continue;
      }


      savedIds.push(
        item.id
      );

    }


    return Response.json({

      ok:
        errors.length ===
        0,

      saved:
        savedIds.length,

      failed:
        errors.length,

      saved_ids:
        savedIds,

      errors,

    });


  } catch (error) {

    console.error(
      "bulk-hero:",
      error
    );


    return Response.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status: 500,
      }
    );

  }

};
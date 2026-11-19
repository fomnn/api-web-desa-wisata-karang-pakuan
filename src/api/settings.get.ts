import { asc } from "drizzle-orm";
import { defineHandler, defineRouteMeta } from "nitro";
import { getDb } from "../db/client";
import { settings } from "../db/schema";
import { cachedJson } from "../utils/cache";

defineRouteMeta({
  openAPI: {
    tags: ["Public Settings"],
    summary: "Get public site settings",
    description: "All site settings as a key/value map, for example `site` and `social_links`.",
    operationId: "getPublicSettings",
    responses: {
      200: {
        description: "Settings keyed by setting key",
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["data"],
              properties: {
                data: { $ref: "#/components/schemas/PublicSettings" },
              },
            },
          },
        },
      },
      304: { description: "Not modified" },
    },
    $global: {
      components: {
        schemas: {
          PublicSettings: {
            type: "object",
            description: "Setting values keyed by setting key",
            additionalProperties: true,
          },
        },
      },
    },
  },
});

export default defineHandler(async (event) => {
  const rows = await getDb().select().from(settings).orderBy(asc(settings.key));
  const data = Object.fromEntries(rows.map((row) => [row.key, row.value]));

  return cachedJson(event, { data }, 300);
});

import { asc } from "drizzle-orm";
import { defineHandler, defineRouteMeta } from "nitro";
import { getDb } from "@src/db/client";
import { categories } from "@src/db/schema";
import { cachedJson } from "@src/utils/cache";

defineRouteMeta({
  openAPI: {
    tags: ["Public Categories"],
    summary: "List categories",
    operationId: "listPublicCategories",
    responses: {
      200: {
        description: "Categories ordered by sort order, then name",
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["data"],
              properties: {
                data: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Category" },
                },
              },
            },
          },
        },
      },
      304: { description: "Not modified" },
    },
  },
});

export default defineHandler(async (event) => {
  const data = await getDb()
    .select()
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.name));

  return cachedJson(event, { data }, 300);
});

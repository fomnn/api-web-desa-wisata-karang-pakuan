import { asc } from "drizzle-orm";
import { defineHandler, defineRouteMeta } from "nitro";
import { getDb } from "@src/db/client";
import { tags } from "@src/db/schema";

defineRouteMeta({
  openAPI: {
    tags: ["Tags"],
    summary: "List tags",
    operationId: "listTags",
    responses: {
      200: {
        description: "Tags ordered by name",
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["data"],
              properties: {
                data: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Tag" },
                },
              },
            },
          },
        },
      },
    },
    $global: {
      components: {
        schemas: {
          Tag: {
            type: "object",
            required: ["id", "slug", "name"],
            properties: {
              id: { type: "integer" },
              slug: { type: "string" },
              name: { type: "string" },
            },
          },
          TagCreate: {
            type: "object",
            required: ["slug", "name"],
            properties: {
              slug: {
                type: "string",
                pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
                maxLength: 200,
              },
              name: { type: "string", maxLength: 200 },
            },
          },
          TagUpdate: {
            type: "object",
            properties: {
              slug: {
                type: "string",
                pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
                maxLength: 200,
              },
              name: { type: "string", maxLength: 200 },
            },
          },
        },
      },
    },
  },
});

export default defineHandler(async () => {
  const data = await getDb().select().from(tags).orderBy(asc(tags.name));

  return { data };
});

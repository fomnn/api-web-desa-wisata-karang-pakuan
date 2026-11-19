import { asc } from "drizzle-orm";
import { defineHandler, defineRouteMeta } from "nitro";
import { getDb } from "../../../db/client";
import { categories } from "../../../db/schema";

// `defineRouteMeta` is a static macro: reusable components must be inline
// literals, and Nitro hoists `$global` from any route into the spec's
// top-level `components`. Shared components therefore live here.
defineRouteMeta({
  openAPI: {
    tags: ["Categories"],
    summary: "List categories",
    operationId: "listCategories",
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
    },
    $global: {
      components: {
        schemas: {
          Pagination: {
            type: "object",
            required: ["page", "pageSize", "total", "totalPages"],
            properties: {
              page: { type: "integer", minimum: 1 },
              pageSize: { type: "integer", minimum: 1, maximum: 100 },
              total: { type: "integer", minimum: 0 },
              totalPages: { type: "integer", minimum: 0 },
            },
          },
          Error: {
            type: "object",
            required: ["error", "status", "message"],
            properties: {
              error: { type: "boolean", const: true },
              status: { type: "integer" },
              statusText: { type: "string" },
              message: { type: "string" },
              data: {
                type: "object",
                additionalProperties: true,
                description: "Extra details, such as validation issues or retry information",
              },
            },
          },
          Category: {
            type: "object",
            required: ["id", "slug", "name", "sortOrder", "createdAt", "updatedAt"],
            properties: {
              id: { type: "integer" },
              slug: { type: "string" },
              name: { type: "string" },
              description: { type: ["string", "null"] },
              sortOrder: { type: "integer" },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
            },
          },
          CategoryCreate: {
            type: "object",
            required: ["slug", "name"],
            properties: {
              slug: {
                type: "string",
                pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
                maxLength: 200,
              },
              name: { type: "string", maxLength: 200 },
              description: { type: ["string", "null"], maxLength: 1000 },
              sortOrder: { type: "integer", default: 0 },
            },
          },
          CategoryUpdate: {
            type: "object",
            properties: {
              slug: {
                type: "string",
                pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
                maxLength: 200,
              },
              name: { type: "string", maxLength: 200 },
              description: { type: ["string", "null"], maxLength: 1000 },
              sortOrder: { type: "integer" },
            },
          },
        },
      },
    },
  },
});

export default defineHandler(async () => {
  const data = await getDb()
    .select()
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.name));

  return { data };
});

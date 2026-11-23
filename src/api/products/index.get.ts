import { count, eq } from "drizzle-orm";
import { defineHandler, defineRouteMeta } from "nitro";
import { getValidatedQuery } from "nitro/h3";
import { getDb } from "@src/db/client";
import { products } from "@src/db/schema";
import { cachedJson } from "@src/utils/cache";
import { pagination } from "@src/utils/http";
import { paginationQuerySchema } from "@src/validators/common";

defineRouteMeta({
  openAPI: {
    tags: ["Public Products"],
    summary: "List published products",
    description:
      "Public catalogue of published products. Draft and archived products are never returned.",
    operationId: "listPublicProducts",
    parameters: [
      {
        in: "query",
        name: "page",
        description: "Page number (1-based)",
        schema: { type: "integer", minimum: 1, default: 1 },
      },
      {
        in: "query",
        name: "pageSize",
        description: "Items per page",
        schema: { type: "integer", minimum: 1, maximum: 100, default: 50 },
      },
    ],
    responses: {
      200: {
        description: "Paginated published products ordered by creation date (newest first)",
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["data", "pagination"],
              properties: {
                data: {
                  type: "array",
                  items: { $ref: "#/components/schemas/PublicProduct" },
                },
                pagination: { $ref: "#/components/schemas/Pagination" },
              },
            },
          },
        },
      },
      304: { description: "Not modified" },
      400: {
        description: "Validation error",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
    },
    $global: {
      components: {
        schemas: {
          PublicProduct: {
            type: "object",
            required: [
              "id",
              "slug",
              "name",
              "description",
              "price",
              "unit",
              "sellerName",
              "sellerPhone",
              "sellerAddress",
              "isFeatured",
              "createdAt",
              "updatedAt",
              "cover",
            ],
            properties: {
              id: { type: "integer" },
              slug: { type: "string" },
              name: { type: "string" },
              description: { type: "string" },
              price: { type: "integer", description: "Unit price" },
              unit: { type: ["string", "null"] },
              sellerName: { type: "string" },
              sellerPhone: { type: ["string", "null"] },
              sellerAddress: { type: ["string", "null"] },
              coverMediaId: { type: ["integer", "null"] },
              isFeatured: { type: "boolean" },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
              cover: {
                anyOf: [{ $ref: "#/components/schemas/PublicMedia" }, { type: "null" }],
              },
            },
          },
        },
      },
    },
  },
});

export default defineHandler(async (event) => {
  const query = await getValidatedQuery(event, paginationQuerySchema);
  const db = getDb();

  const where = eq(products.status, "published");

  const [data, totalRows] = await Promise.all([
    db.query.products.findMany({
      where: { status: "published" },
      columns: { status: false },
      with: { cover: { columns: { uploadedBy: false } } },
      orderBy: (fields, { desc }) => desc(fields.createdAt),
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    }),
    db.select({ total: count() }).from(products).where(where),
  ]);

  return cachedJson(
    event,
    {
      data,
      pagination: pagination(query.page, query.pageSize, totalRows[0]?.total ?? 0),
    },
    60,
  );
});

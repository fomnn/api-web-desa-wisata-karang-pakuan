import { and, count, desc, eq, like, type SQL } from "drizzle-orm";
import { defineHandler, defineRouteMeta } from "nitro";
import { getValidatedQuery } from "nitro/h3";
import { getDb } from "../../../db/client";
import { products } from "../../../db/schema";
import { pagination } from "../../../utils/http";
import { listProductsQuerySchema } from "../../../validators/products";

defineRouteMeta({
  openAPI: {
    tags: ["Products"],
    summary: "List products",
    operationId: "listProducts",
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
      {
        in: "query",
        name: "status",
        schema: { type: "string", enum: ["draft", "published", "archived"] },
      },
      {
        in: "query",
        name: "q",
        description: "Name search",
        schema: { type: "string" },
      },
    ],
    responses: {
      200: {
        description: "Paginated products ordered by creation date (newest first)",
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["data", "pagination"],
              properties: {
                data: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Product" },
                },
                pagination: { $ref: "#/components/schemas/Pagination" },
              },
            },
          },
        },
      },
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
          Product: {
            type: "object",
            required: [
              "id",
              "slug",
              "name",
              "description",
              "price",
              "sellerName",
              "status",
              "isFeatured",
              "createdAt",
              "updatedAt",
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
              status: { type: "string", enum: ["draft", "published", "archived"] },
              isFeatured: { type: "boolean" },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
            },
          },
          ProductDetail: {
            allOf: [
              { $ref: "#/components/schemas/Product" },
              {
                type: "object",
                required: ["cover"],
                properties: {
                  cover: {
                    anyOf: [{ $ref: "#/components/schemas/Media" }, { type: "null" }],
                  },
                },
              },
            ],
          },
          ProductCreate: {
            type: "object",
            required: ["slug", "name", "description", "price", "sellerName"],
            properties: {
              slug: {
                type: "string",
                pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
                maxLength: 200,
              },
              name: { type: "string", maxLength: 200 },
              description: { type: "string", minLength: 1 },
              price: { type: "integer", minimum: 0 },
              unit: { type: ["string", "null"], maxLength: 50 },
              sellerName: { type: "string", maxLength: 200 },
              sellerPhone: { type: ["string", "null"], maxLength: 30 },
              sellerAddress: { type: ["string", "null"], maxLength: 500 },
              coverMediaId: { type: ["integer", "null"] },
              status: {
                type: "string",
                enum: ["draft", "published", "archived"],
                default: "draft",
              },
              isFeatured: { type: "boolean", default: false },
            },
          },
          ProductUpdate: {
            type: "object",
            properties: {
              slug: {
                type: "string",
                pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
                maxLength: 200,
              },
              name: { type: "string", maxLength: 200 },
              description: { type: "string", minLength: 1 },
              price: { type: "integer", minimum: 0 },
              unit: { type: ["string", "null"], maxLength: 50 },
              sellerName: { type: "string", maxLength: 200 },
              sellerPhone: { type: ["string", "null"], maxLength: 30 },
              sellerAddress: { type: ["string", "null"], maxLength: 500 },
              coverMediaId: { type: ["integer", "null"] },
              status: {
                type: "string",
                enum: ["draft", "published", "archived"],
              },
              isFeatured: { type: "boolean" },
            },
          },
        },
      },
    },
  },
});

export default defineHandler(async (event) => {
  const query = await getValidatedQuery(event, listProductsQuerySchema);
  const db = getDb();

  const filters: SQL[] = [];

  if (query.status) filters.push(eq(products.status, query.status));
  if (query.q) filters.push(like(products.name, `%${query.q}%`));

  const where = filters.length > 0 ? and(...filters) : undefined;

  const [data, totalRows] = await Promise.all([
    db
      .select()
      .from(products)
      .where(where)
      .orderBy(desc(products.createdAt))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ total: count() }).from(products).where(where),
  ]);

  return {
    data,
    pagination: pagination(query.page, query.pageSize, totalRows[0]?.total ?? 0),
  };
});

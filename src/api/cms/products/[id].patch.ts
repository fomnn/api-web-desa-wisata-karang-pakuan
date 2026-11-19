import { eq } from "drizzle-orm";
import { defineHandler, defineRouteMeta } from "nitro";
import { readValidatedBody } from "nitro/h3";
import { getDb } from "../../../db/client";
import { products } from "../../../db/schema";
import { badRequest, getIdParam, notFound, writeOrThrow } from "../../../utils/http";
import { updateProductSchema } from "../../../validators/products";

defineRouteMeta({
  openAPI: {
    tags: ["Products"],
    summary: "Update a product",
    operationId: "updateProduct",
    parameters: [
      {
        in: "path",
        name: "id",
        required: true,
        schema: { type: "integer", minimum: 1 },
      },
    ],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/ProductUpdate" },
        },
      },
    },
    responses: {
      200: {
        description: "Updated product",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Product" },
          },
        },
      },
      400: {
        description: "Validation error or no fields to update",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
      404: {
        description: "Product not found",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
      409: {
        description: "Slug already exists",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
      422: {
        description: "Referenced cover does not exist",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
      429: {
        description: "Too many write requests",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
    },
  },
});

export default defineHandler(async (event) => {
  const id = getIdParam(event);
  const body = await readValidatedBody(event, updateProductSchema);

  if (Object.keys(body).length === 0) {
    throw badRequest("No fields to update");
  }

  const rows = await writeOrThrow(() =>
    getDb().update(products).set(body).where(eq(products.id, id)).returning(),
  );
  const item = rows[0];

  if (!item) throw notFound("Product");

  return item;
});

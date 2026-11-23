import { defineHandler, defineRouteMeta } from "nitro";
import { readValidatedBody } from "nitro/h3";
import { getDb } from "@src/db/client";
import { products } from "@src/db/schema";
import { writeOrThrow } from "@src/utils/http";
import { createProductSchema } from "@src/validators/products";

defineRouteMeta({
  openAPI: {
    tags: ["Products"],
    summary: "Create a product",
    operationId: "createProduct",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/ProductCreate" },
        },
      },
    },
    responses: {
      201: {
        description: "Created product",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Product" },
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
  const body = await readValidatedBody(event, createProductSchema);

  const rows = await writeOrThrow(() => getDb().insert(products).values(body).returning());
  const item = rows[0];

  if (!item) {
    throw new Error("Failed to create product");
  }

  event.res.status = 201;
  return item;
});

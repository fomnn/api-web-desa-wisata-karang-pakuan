import { defineHandler, defineRouteMeta } from "nitro";
import { getDb } from "../../../db/client";
import { getIdParam, notFound } from "../../../utils/http";

defineRouteMeta({
  openAPI: {
    tags: ["Products"],
    summary: "Get a product",
    operationId: "getProduct",
    parameters: [
      {
        in: "path",
        name: "id",
        required: true,
        schema: { type: "integer", minimum: 1 },
      },
    ],
    responses: {
      200: {
        description: "Product with cover",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ProductDetail" },
          },
        },
      },
      400: {
        description: "Invalid id",
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
    },
  },
});

export default defineHandler(async (event) => {
  const id = getIdParam(event);

  const item = await getDb().query.products.findFirst({
    where: { id },
    with: { cover: true },
  });

  if (!item) throw notFound("Product");

  return item;
});

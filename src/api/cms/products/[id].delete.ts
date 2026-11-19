import { eq } from "drizzle-orm";
import { defineHandler, defineRouteMeta } from "nitro";
import { noContent } from "nitro/h3";
import { getDb } from "../../../db/client";
import { products } from "../../../db/schema";
import { getIdParam, notFound, writeOrThrow } from "../../../utils/http";

defineRouteMeta({
  openAPI: {
    tags: ["Products"],
    summary: "Delete a product",
    operationId: "deleteProduct",
    parameters: [
      {
        in: "path",
        name: "id",
        required: true,
        schema: { type: "integer", minimum: 1 },
      },
    ],
    responses: {
      204: { description: "Product deleted" },
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

  const deleted = await writeOrThrow(() =>
    getDb().delete(products).where(eq(products.id, id)).returning({ id: products.id }),
  );

  if (deleted.length === 0) throw notFound("Product");

  return noContent();
});

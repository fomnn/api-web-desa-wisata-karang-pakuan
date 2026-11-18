import { eq } from "drizzle-orm";
import { defineHandler, defineRouteMeta } from "nitro";
import { getDb } from "../../../db/client";
import { categories } from "../../../db/schema";
import { getIdParam, notFound } from "../../../utils/http";

defineRouteMeta({
  openAPI: {
    tags: ["Categories"],
    summary: "Get a category",
    operationId: "getCategory",
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
        description: "Category",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Category" },
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
        description: "Category not found",
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

  const category = await getDb().select().from(categories).where(eq(categories.id, id)).get();

  if (!category) throw notFound("Category");

  return category;
});

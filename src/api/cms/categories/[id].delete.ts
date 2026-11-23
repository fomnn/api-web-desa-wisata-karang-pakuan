import { eq } from "drizzle-orm";
import { defineHandler, defineRouteMeta } from "nitro";
import { noContent } from "nitro/h3";
import { getDb } from "@src/db/client";
import { categories } from "@src/db/schema";
import { getIdParam, notFound, writeOrThrow } from "@src/utils/http";

defineRouteMeta({
  openAPI: {
    tags: ["Categories"],
    summary: "Delete a category",
    operationId: "deleteCategory",
    parameters: [
      {
        in: "path",
        name: "id",
        required: true,
        schema: { type: "integer", minimum: 1 },
      },
    ],
    responses: {
      204: { description: "Category deleted" },
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
    getDb().delete(categories).where(eq(categories.id, id)).returning({ id: categories.id }),
  );

  if (deleted.length === 0) throw notFound("Category");

  return noContent();
});

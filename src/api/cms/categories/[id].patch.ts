import { eq } from "drizzle-orm";
import { defineHandler, defineRouteMeta } from "nitro";
import { readValidatedBody } from "nitro/h3";
import { getDb } from "../../../db/client";
import { categories } from "../../../db/schema";
import { badRequest, getIdParam, notFound, writeOrThrow } from "../../../utils/http";
import { updateCategorySchema } from "../../../validators/categories";

defineRouteMeta({
  openAPI: {
    tags: ["Categories"],
    summary: "Update a category",
    operationId: "updateCategory",
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
          schema: { $ref: "#/components/schemas/CategoryUpdate" },
        },
      },
    },
    responses: {
      200: {
        description: "Updated category",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Category" },
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
        description: "Category not found",
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
    },
  },
});

export default defineHandler(async (event) => {
  const id = getIdParam(event);
  const body = await readValidatedBody(event, updateCategorySchema);

  if (Object.keys(body).length === 0) {
    throw badRequest("No fields to update");
  }

  const rows = await writeOrThrow(() =>
    getDb().update(categories).set(body).where(eq(categories.id, id)).returning(),
  );
  const category = rows[0];

  if (!category) throw notFound("Category");

  return category;
});

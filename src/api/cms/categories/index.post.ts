import { defineHandler, defineRouteMeta } from "nitro";
import { readValidatedBody } from "nitro/h3";
import { getDb } from "@src/db/client";
import { categories } from "@src/db/schema";
import { writeOrThrow } from "@src/utils/http";
import { createCategorySchema } from "@src/validators/categories";

defineRouteMeta({
  openAPI: {
    tags: ["Categories"],
    summary: "Create a category",
    operationId: "createCategory",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/CategoryCreate" },
        },
      },
    },
    responses: {
      201: {
        description: "Created category",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Category" },
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
  const body = await readValidatedBody(event, createCategorySchema);

  const rows = await writeOrThrow(() => getDb().insert(categories).values(body).returning());
  const category = rows[0];

  if (!category) {
    throw new Error("Failed to create category");
  }

  event.res.status = 201;
  return category;
});

import { defineHandler, defineRouteMeta } from "nitro";
import { readValidatedBody } from "nitro/h3";
import { getDb } from "../../../db/client";
import { tags } from "../../../db/schema";
import { writeOrThrow } from "../../../utils/http";
import { createTagSchema } from "../../../validators/tags";

defineRouteMeta({
  openAPI: {
    tags: ["Tags"],
    summary: "Create a tag",
    operationId: "createTag",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/TagCreate" },
        },
      },
    },
    responses: {
      201: {
        description: "Created tag",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Tag" },
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
    },
  },
});

export default defineHandler(async (event) => {
  const body = await readValidatedBody(event, createTagSchema);

  const rows = await writeOrThrow(() => getDb().insert(tags).values(body).returning());
  const tag = rows[0];

  if (!tag) {
    throw new Error("Failed to create tag");
  }

  event.res.status = 201;
  return tag;
});

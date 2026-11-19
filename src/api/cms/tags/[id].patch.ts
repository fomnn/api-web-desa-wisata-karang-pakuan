import { eq } from "drizzle-orm";
import { defineHandler, defineRouteMeta } from "nitro";
import { readValidatedBody } from "nitro/h3";
import { getDb } from "../../../db/client";
import { tags } from "../../../db/schema";
import { badRequest, getIdParam, notFound, writeOrThrow } from "../../../utils/http";
import { updateTagSchema } from "../../../validators/tags";

defineRouteMeta({
  openAPI: {
    tags: ["Tags"],
    summary: "Update a tag",
    operationId: "updateTag",
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
          schema: { $ref: "#/components/schemas/TagUpdate" },
        },
      },
    },
    responses: {
      200: {
        description: "Updated tag",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Tag" },
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
        description: "Tag not found",
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
  const id = getIdParam(event);
  const body = await readValidatedBody(event, updateTagSchema);

  if (Object.keys(body).length === 0) {
    throw badRequest("No fields to update");
  }

  const rows = await writeOrThrow(() =>
    getDb().update(tags).set(body).where(eq(tags.id, id)).returning(),
  );
  const tag = rows[0];

  if (!tag) throw notFound("Tag");

  return tag;
});

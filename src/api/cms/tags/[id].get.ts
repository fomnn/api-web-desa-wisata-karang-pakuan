import { eq } from "drizzle-orm";
import { defineHandler, defineRouteMeta } from "nitro";
import { getDb } from "../../../db/client";
import { tags } from "../../../db/schema";
import { getIdParam, notFound } from "../../../utils/http";

defineRouteMeta({
  openAPI: {
    tags: ["Tags"],
    summary: "Get a tag",
    operationId: "getTag",
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
        description: "Tag",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Tag" },
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
        description: "Tag not found",
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

  const tag = await getDb().select().from(tags).where(eq(tags.id, id)).get();

  if (!tag) throw notFound("Tag");

  return tag;
});

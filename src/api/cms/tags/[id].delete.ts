import { eq } from "drizzle-orm";
import { defineHandler, defineRouteMeta } from "nitro";
import { noContent } from "nitro/h3";
import { getDb } from "../../../db/client";
import { tags } from "../../../db/schema";
import { getIdParam, notFound, writeOrThrow } from "../../../utils/http";

defineRouteMeta({
  openAPI: {
    tags: ["Tags"],
    summary: "Delete a tag",
    operationId: "deleteTag",
    parameters: [
      {
        in: "path",
        name: "id",
        required: true,
        schema: { type: "integer", minimum: 1 },
      },
    ],
    responses: {
      204: { description: "Tag deleted" },
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

  const deleted = await writeOrThrow(() =>
    getDb().delete(tags).where(eq(tags.id, id)).returning({ id: tags.id }),
  );

  if (deleted.length === 0) throw notFound("Tag");

  return noContent();
});

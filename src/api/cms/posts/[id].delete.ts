import { eq } from "drizzle-orm";
import { defineHandler, defineRouteMeta } from "nitro";
import { noContent } from "nitro/h3";
import { getDb } from "../../../db/client";
import { posts } from "../../../db/schema";
import { getIdParam, notFound, writeOrThrow } from "../../../utils/http";

defineRouteMeta({
  openAPI: {
    tags: ["Posts"],
    summary: "Delete a post",
    operationId: "deletePost",
    parameters: [
      {
        in: "path",
        name: "id",
        required: true,
        schema: { type: "integer", minimum: 1 },
      },
    ],
    responses: {
      204: { description: "Post deleted" },
      400: {
        description: "Invalid id",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
      404: {
        description: "Post not found",
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
    getDb().delete(posts).where(eq(posts.id, id)).returning({ id: posts.id }),
  );

  if (deleted.length === 0) throw notFound("Post");

  return noContent();
});

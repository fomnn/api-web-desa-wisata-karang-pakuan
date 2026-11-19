import { defineHandler, defineRouteMeta } from "nitro";
import { getDb } from "../../db/client";
import { cachedJson } from "../../utils/cache";
import { getSlugParam, notFound } from "../../utils/http";

defineRouteMeta({
  openAPI: {
    tags: ["Public Posts"],
    summary: "Get a published post by slug",
    description: "Returns the post only when its status is published.",
    operationId: "getPublicPost",
    parameters: [
      {
        in: "path",
        name: "slug",
        required: true,
        description: "Post slug",
        schema: { type: "string" },
      },
    ],
    responses: {
      200: {
        description: "Published post with author, category, cover and tags",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/PublicPostDetail" },
          },
        },
      },
      304: { description: "Not modified" },
      400: {
        description: "Invalid slug",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
      404: {
        description: "Published post not found",
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
  const slug = getSlugParam(event);

  const post = await getDb().query.posts.findFirst({
    where: { slug, status: "published" },
    columns: { status: false, authorId: false },
    with: {
      author: { columns: { id: true, name: true } },
      category: true,
      cover: { columns: { uploadedBy: false } },
      tags: true,
    },
  });

  if (!post) throw notFound("Post");

  return cachedJson(event, post, 300);
});

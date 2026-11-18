import { defineHandler, defineRouteMeta } from "nitro";
import { getDb } from "../../../db/client";
import { getIdParam, notFound } from "../../../utils/http";

defineRouteMeta({
  openAPI: {
    tags: ["Posts"],
    summary: "Get a post with relations",
    operationId: "getPost",
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
        description: "Post with author, category, cover and tags",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/PostDetail" },
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

  const post = await getDb().query.posts.findFirst({
    where: { id },
    with: {
      author: { columns: { passwordHash: false } },
      category: true,
      cover: true,
      tags: true,
    },
  });

  if (!post) throw notFound("Post");

  return post;
});

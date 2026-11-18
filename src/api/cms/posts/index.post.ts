import { defineHandler, defineRouteMeta } from "nitro";
import { readValidatedBody } from "nitro/h3";
import { getDb } from "../../../db/client";
import { postTags, posts } from "../../../db/schema";
import { writeOrThrow } from "../../../utils/http";
import { createPostSchema } from "../../../validators/posts";

defineRouteMeta({
  openAPI: {
    tags: ["Posts"],
    summary: "Create a post",
    operationId: "createPost",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/PostCreate" },
        },
      },
    },
    responses: {
      201: {
        description: "Created post",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Post" },
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
      422: {
        description: "Referenced author, category, cover or tag does not exist",
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
  const body = await readValidatedBody(event, createPostSchema);
  const db = getDb();
  const { tagIds, ...values } = body;

  const rows = await writeOrThrow(() => db.insert(posts).values(values).returning());
  const post = rows[0];

  if (!post) {
    throw new Error("Failed to create post");
  }

  if (tagIds && tagIds.length > 0) {
    await db.insert(postTags).values(tagIds.map((tagId) => ({ postId: post.id, tagId })));
  }

  event.res.status = 201;
  return post;
});

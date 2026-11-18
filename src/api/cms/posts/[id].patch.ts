import { eq } from "drizzle-orm";
import { defineHandler, defineRouteMeta } from "nitro";
import { readValidatedBody } from "nitro/h3";
import { getDb } from "../../../db/client";
import { postTags, posts } from "../../../db/schema";
import { badRequest, getIdParam, notFound, writeOrThrow } from "../../../utils/http";
import { updatePostSchema } from "../../../validators/posts";

defineRouteMeta({
  openAPI: {
    tags: ["Posts"],
    summary: "Update a post",
    operationId: "updatePost",
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
          schema: { $ref: "#/components/schemas/PostUpdate" },
        },
      },
    },
    responses: {
      200: {
        description: "Updated post",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Post" },
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
        description: "Post not found",
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
  const id = getIdParam(event);
  const body = await readValidatedBody(event, updatePostSchema);
  const db = getDb();
  const { tagIds, ...values } = body;

  if (Object.keys(values).length === 0 && tagIds === undefined) {
    throw badRequest("No fields to update");
  }

  const current =
    Object.keys(values).length > 0
      ? (
          await writeOrThrow(() => db.update(posts).set(values).where(eq(posts.id, id)).returning())
        )[0]
      : await db.select().from(posts).where(eq(posts.id, id)).get();

  if (!current) throw notFound("Post");

  if (tagIds !== undefined) {
    await db.delete(postTags).where(eq(postTags.postId, id));

    if (tagIds.length > 0) {
      await db.insert(postTags).values(tagIds.map((tagId) => ({ postId: id, tagId })));
    }
  }

  return current;
});

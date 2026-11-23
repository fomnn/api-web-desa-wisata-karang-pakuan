import { eq } from "drizzle-orm";
import { defineHandler, defineRouteMeta } from "nitro";
import { readValidatedBody } from "nitro/h3";
import { getDb } from "@src/db/client";
import { postTags, posts } from "@src/db/schema";
import { badRequest, getIdParam, notFound, writeOrThrow } from "@src/utils/http";
import { updatePostSchema } from "@src/validators/posts";

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
  const body = await readValidatedBody(event, updatePostSchema);
  const db = getDb();
  const { tagIds, ...values } = body;

  if (Object.keys(values).length === 0 && tagIds === undefined) {
    throw badRequest("No fields to update");
  }

  const current = await db.select().from(posts).where(eq(posts.id, id)).get();

  if (!current) throw notFound("Post");

  if (values.status === "published") {
    values.publishedAt ??= current.publishedAt ?? new Date();
  } else if (values.status === "draft") {
    values.publishedAt = null;
  }

  const updatePost =
    Object.keys(values).length > 0
      ? db.update(posts).set(values).where(eq(posts.id, id)).returning()
      : null;

  const deleteTags =
    tagIds !== undefined ? db.delete(postTags).where(eq(postTags.postId, id)) : null;

  const insertTags =
    tagIds && tagIds.length > 0
      ? db.insert(postTags).values(tagIds.map((tagId) => ({ postId: id, tagId })))
      : null;

  if (updatePost) {
    if (deleteTags && insertTags) {
      const [updated] = await writeOrThrow(() => db.batch([updatePost, deleteTags, insertTags]));
      return updated[0];
    }

    if (deleteTags) {
      const [updated] = await writeOrThrow(() => db.batch([updatePost, deleteTags]));
      return updated[0];
    }

    const [updated] = await writeOrThrow(() => db.batch([updatePost]));
    return updated[0];
  }

  if (deleteTags) {
    if (insertTags) {
      await writeOrThrow(() => db.batch([deleteTags, insertTags]));
    } else {
      await writeOrThrow(() => db.batch([deleteTags]));
    }
  }

  return current;
});

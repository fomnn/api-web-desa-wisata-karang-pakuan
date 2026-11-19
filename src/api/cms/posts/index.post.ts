import { sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
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
  const body = await readValidatedBody(event, createPostSchema);
  const db = getDb();
  const { tagIds, ...values } = body;

  if (values.status === "published") {
    values.publishedAt ??= new Date();
  } else if (values.status === "draft") {
    values.publishedAt = null;
  }

  const insertPost = db.insert(posts).values(values).returning();
  const insertTags =
    tagIds && tagIds.length > 0
      ? db.insert(postTags).values(
          tagIds.map((tagId) => ({
            postId: sql`(select ${posts.id} from ${posts} where ${posts.slug} = ${values.slug})`,
            tagId,
          })),
        )
      : null;

  const statements: [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]] = [insertPost];
  if (insertTags) statements.push(insertTags);

  const [rows] = await writeOrThrow(() => db.batch(statements));
  const post: typeof posts.$inferSelect | undefined = rows[0];

  if (!post) {
    throw new Error("Failed to create post");
  }

  event.res.status = 201;
  return post;
});

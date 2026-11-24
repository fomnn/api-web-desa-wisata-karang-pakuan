import { and, count, desc, eq, inArray, type SQL } from "drizzle-orm";
import { defineHandler, defineRouteMeta } from "nitro";
import { getValidatedQuery } from "nitro/h3";
import { getDb } from "@src/db/client";
import { postTags, posts } from "@src/db/schema";
import { pagination } from "@src/utils/http";
import { likeContains } from "@src/utils/sql";
import { listPostsQuerySchema } from "@src/validators/posts";

defineRouteMeta({
  openAPI: {
    tags: ["Posts"],
    summary: "List posts",
    operationId: "listPosts",
    parameters: [
      {
        in: "query",
        name: "page",
        description: "Page number (1-based)",
        schema: { type: "integer", minimum: 1, default: 1 },
      },
      {
        in: "query",
        name: "pageSize",
        description: "Items per page",
        schema: { type: "integer", minimum: 1, maximum: 100, default: 50 },
      },
      {
        in: "query",
        name: "status",
        schema: { type: "string", enum: ["draft", "review", "published", "archived"] },
      },
      {
        in: "query",
        name: "categoryId",
        schema: { type: "integer", minimum: 1 },
      },
      {
        in: "query",
        name: "tagId",
        schema: { type: "integer", minimum: 1 },
      },
      {
        in: "query",
        name: "q",
        description: "Title search",
        schema: { type: "string" },
      },
    ],
    responses: {
      200: {
        description: "Paginated posts ordered by creation date (newest first)",
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["data", "pagination"],
              properties: {
                data: {
                  type: "array",
                  items: { $ref: "#/components/schemas/PostListItem" },
                },
                pagination: { $ref: "#/components/schemas/Pagination" },
              },
            },
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
    },
    $global: {
      components: {
        schemas: {
          User: {
            type: "object",
            required: ["id", "email", "name", "role", "isActive", "createdAt", "updatedAt"],
            properties: {
              id: { type: "integer" },
              email: { type: "string", format: "email" },
              name: { type: "string" },
              role: { type: "string", enum: ["admin", "editor", "author"] },
              isActive: { type: "boolean" },
              lastLoginAt: { type: ["string", "null"], format: "date-time" },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
            },
          },
          Media: {
            type: "object",
            required: [
              "id",
              "key",
              "url",
              "filename",
              "mimeType",
              "sizeBytes",
              "uploadedBy",
              "createdAt",
            ],
            properties: {
              id: { type: "integer" },
              key: { type: "string" },
              url: {
                type: "string",
                format: "uri",
                description: "Absolute URL served by `GET /media/<key>`",
              },
              filename: { type: "string" },
              mimeType: { type: "string" },
              sizeBytes: { type: "integer" },
              width: { type: ["integer", "null"] },
              height: { type: ["integer", "null"] },
              alt: { type: ["string", "null"] },
              caption: { type: ["string", "null"] },
              uploadedBy: { type: "integer" },
              createdAt: { type: "string", format: "date-time" },
            },
          },
          Post: {
            type: "object",
            required: [
              "id",
              "slug",
              "title",
              "content",
              "authorId",
              "status",
              "isFeatured",
              "createdAt",
              "updatedAt",
            ],
            properties: {
              id: { type: "integer" },
              slug: { type: "string" },
              title: { type: "string" },
              excerpt: { type: ["string", "null"] },
              content: { type: "string" },
              coverMediaId: { type: ["integer", "null"] },
              categoryId: { type: ["integer", "null"] },
              authorId: { type: "integer" },
              status: {
                type: "string",
                enum: ["draft", "review", "published", "archived"],
              },
              publishedAt: { type: ["string", "null"], format: "date-time" },
              isFeatured: { type: "boolean" },
              metaTitle: { type: ["string", "null"] },
              metaDescription: { type: ["string", "null"] },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
            },
          },
          PostListItem: {
            type: "object",
            required: [
              "id",
              "slug",
              "title",
              "authorId",
              "status",
              "isFeatured",
              "createdAt",
              "updatedAt",
            ],
            properties: {
              id: { type: "integer" },
              slug: { type: "string" },
              title: { type: "string" },
              excerpt: { type: ["string", "null"] },
              coverMediaId: { type: ["integer", "null"] },
              categoryId: { type: ["integer", "null"] },
              authorId: { type: "integer" },
              status: {
                type: "string",
                enum: ["draft", "review", "published", "archived"],
              },
              publishedAt: { type: ["string", "null"], format: "date-time" },
              isFeatured: { type: "boolean" },
              metaTitle: { type: ["string", "null"] },
              metaDescription: { type: ["string", "null"] },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
            },
          },
          PostDetail: {
            allOf: [
              { $ref: "#/components/schemas/Post" },
              {
                type: "object",
                required: ["author", "tags"],
                properties: {
                  author: { $ref: "#/components/schemas/User" },
                  category: {
                    anyOf: [{ $ref: "#/components/schemas/Category" }, { type: "null" }],
                  },
                  cover: {
                    anyOf: [{ $ref: "#/components/schemas/Media" }, { type: "null" }],
                  },
                  tags: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Tag" },
                  },
                },
              },
            ],
          },
          PostCreate: {
            type: "object",
            required: ["slug", "title", "content", "authorId"],
            properties: {
              slug: {
                type: "string",
                pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
                maxLength: 200,
              },
              title: { type: "string", maxLength: 200 },
              excerpt: { type: ["string", "null"], maxLength: 500 },
              content: { type: "string", minLength: 1 },
              coverMediaId: { type: ["integer", "null"] },
              categoryId: { type: ["integer", "null"] },
              authorId: { type: "integer", minimum: 1 },
              status: {
                type: "string",
                enum: ["draft", "review", "published", "archived"],
                default: "draft",
              },
              publishedAt: { type: ["string", "null"], format: "date-time" },
              isFeatured: { type: "boolean", default: false },
              metaTitle: { type: ["string", "null"], maxLength: 200 },
              metaDescription: { type: ["string", "null"], maxLength: 300 },
              tagIds: {
                type: "array",
                uniqueItems: true,
                items: { type: "integer", minimum: 1 },
              },
            },
          },
          PostUpdate: {
            type: "object",
            properties: {
              slug: {
                type: "string",
                pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
                maxLength: 200,
              },
              title: { type: "string", maxLength: 200 },
              excerpt: { type: ["string", "null"], maxLength: 500 },
              content: { type: "string", minLength: 1 },
              coverMediaId: { type: ["integer", "null"] },
              categoryId: { type: ["integer", "null"] },
              authorId: { type: "integer", minimum: 1 },
              status: {
                type: "string",
                enum: ["draft", "review", "published", "archived"],
              },
              publishedAt: { type: ["string", "null"], format: "date-time" },
              isFeatured: { type: "boolean" },
              metaTitle: { type: ["string", "null"], maxLength: 200 },
              metaDescription: { type: ["string", "null"], maxLength: 300 },
              tagIds: {
                type: "array",
                uniqueItems: true,
                items: { type: "integer", minimum: 1 },
              },
            },
          },
        },
      },
    },
  },
});

export default defineHandler(async (event) => {
  const query = await getValidatedQuery(event, listPostsQuerySchema);
  const db = getDb();

  const filters: SQL[] = [];

  if (query.status) filters.push(eq(posts.status, query.status));
  if (query.categoryId) filters.push(eq(posts.categoryId, query.categoryId));
  if (query.q) filters.push(likeContains(posts.title, query.q));
  if (query.tagId) {
    filters.push(
      inArray(
        posts.id,
        db.select({ id: postTags.postId }).from(postTags).where(eq(postTags.tagId, query.tagId)),
      ),
    );
  }

  const where = filters.length > 0 ? and(...filters) : undefined;

  const [data, totalRows] = await Promise.all([
    db
      .select({
        id: posts.id,
        slug: posts.slug,
        title: posts.title,
        excerpt: posts.excerpt,
        coverMediaId: posts.coverMediaId,
        categoryId: posts.categoryId,
        authorId: posts.authorId,
        status: posts.status,
        publishedAt: posts.publishedAt,
        isFeatured: posts.isFeatured,
        metaTitle: posts.metaTitle,
        metaDescription: posts.metaDescription,
        createdAt: posts.createdAt,
        updatedAt: posts.updatedAt,
      })
      .from(posts)
      .where(where)
      .orderBy(desc(posts.createdAt))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ total: count() }).from(posts).where(where),
  ]);

  return {
    data,
    pagination: pagination(query.page, query.pageSize, totalRows[0]?.total ?? 0),
  };
});

import { and, count, eq, inArray, like, type SQL } from "drizzle-orm";
import { defineHandler, defineRouteMeta } from "nitro";
import { getValidatedQuery } from "nitro/h3";
import { getDb } from "@src/db/client";
import { postTags, posts } from "@src/db/schema";
import { cachedJson } from "@src/utils/cache";
import { pagination } from "@src/utils/http";
import { mediaUrl } from "@src/utils/media";
import { listPublicPostsQuerySchema } from "@src/validators/posts";

defineRouteMeta({
  openAPI: {
    tags: ["Public Posts"],
    summary: "List published posts",
    description:
      "Public feed of published posts only. Drafts, review and archived posts are never returned.",
    operationId: "listPublicPosts",
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
        description: "Paginated published posts ordered by publish date (newest first)",
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["data", "pagination"],
              properties: {
                data: {
                  type: "array",
                  items: { $ref: "#/components/schemas/PublicPostSummary" },
                },
                pagination: { $ref: "#/components/schemas/Pagination" },
              },
            },
          },
        },
      },
      304: { description: "Not modified" },
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
          PublicAuthor: {
            type: "object",
            required: ["id", "name"],
            properties: {
              id: { type: "integer" },
              name: { type: "string" },
            },
          },
          PublicMedia: {
            type: "object",
            required: [
              "id",
              "key",
              "url",
              "filename",
              "mimeType",
              "kind",
              "sizeBytes",
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
              kind: { type: "string", enum: ["image", "video"] },
              sizeBytes: { type: "integer" },
              width: { type: ["integer", "null"] },
              height: { type: ["integer", "null"] },
              durationSeconds: { type: ["integer", "null"] },
              alt: { type: ["string", "null"] },
              caption: { type: ["string", "null"] },
              createdAt: { type: "string", format: "date-time" },
            },
          },
          PublicPostSummary: {
            type: "object",
            required: [
              "id",
              "slug",
              "title",
              "excerpt",
              "publishedAt",
              "isFeatured",
              "createdAt",
              "updatedAt",
              "category",
              "cover",
            ],
            properties: {
              id: { type: "integer" },
              slug: { type: "string" },
              title: { type: "string" },
              excerpt: { type: ["string", "null"] },
              coverMediaId: { type: ["integer", "null"] },
              categoryId: { type: ["integer", "null"] },
              publishedAt: { type: ["string", "null"], format: "date-time" },
              isFeatured: { type: "boolean" },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
              category: {
                anyOf: [{ $ref: "#/components/schemas/Category" }, { type: "null" }],
              },
              cover: {
                anyOf: [{ $ref: "#/components/schemas/PublicMedia" }, { type: "null" }],
              },
            },
          },
          PublicPostDetail: {
            allOf: [
              { $ref: "#/components/schemas/PublicPostSummary" },
              {
                type: "object",
                required: ["content", "author", "tags"],
                properties: {
                  content: { type: "string" },
                  metaTitle: { type: ["string", "null"] },
                  metaDescription: { type: ["string", "null"] },
                  author: { $ref: "#/components/schemas/PublicAuthor" },
                  tags: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Tag" },
                  },
                },
              },
            ],
          },
        },
      },
    },
  },
});

export default defineHandler(async (event) => {
  const query = await getValidatedQuery(event, listPublicPostsQuerySchema);
  const db = getDb();

  const filters: SQL[] = [eq(posts.status, "published")];
  const where: {
    status: "published";
    categoryId?: number;
    title?: { like: string };
    id?: { in: number[] };
  } = { status: "published" };

  if (query.categoryId) {
    where.categoryId = query.categoryId;
    filters.push(eq(posts.categoryId, query.categoryId));
  }

  if (query.q) {
    where.title = { like: `%${query.q}%` };
    filters.push(like(posts.title, `%${query.q}%`));
  }

  if (query.tagId) {
    const taggedIds = (
      await db.select({ id: postTags.postId }).from(postTags).where(eq(postTags.tagId, query.tagId))
    ).map((row) => row.id);

    if (taggedIds.length === 0) {
      return cachedJson(
        event,
        {
          data: [],
          pagination: pagination(query.page, query.pageSize, 0),
        },
        60,
      );
    }

    where.id = { in: taggedIds };
    filters.push(inArray(posts.id, taggedIds));
  }

  const countWhere = and(...filters)!;

  const [rows, totalRows] = await Promise.all([
    db.query.posts.findMany({
      where,
      columns: {
        content: false,
        status: false,
        authorId: false,
        metaTitle: false,
        metaDescription: false,
      },
      with: {
        category: true,
        cover: { columns: { uploadedBy: false } },
      },
      orderBy: (fields, { desc }) => [desc(fields.publishedAt), desc(fields.createdAt)],
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    }),
    db.select({ total: count() }).from(posts).where(countWhere),
  ]);

  const data = rows.map((post) => ({
    ...post,
    cover: post.cover && { ...post.cover, url: mediaUrl(event, post.cover.key) },
  }));

  return cachedJson(
    event,
    {
      data,
      pagination: pagination(query.page, query.pageSize, totalRows[0]?.total ?? 0),
    },
    60,
  );
});

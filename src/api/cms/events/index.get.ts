import { and, count, desc, eq, type SQL } from "drizzle-orm";
import { defineHandler, defineRouteMeta } from "nitro";
import { getValidatedQuery } from "nitro/h3";
import { getDb } from "@src/db/client";
import { events } from "@src/db/schema";
import { pagination } from "@src/utils/http";
import { likeContains } from "@src/utils/sql";
import { listEventsQuerySchema } from "@src/validators/events";

defineRouteMeta({
  openAPI: {
    tags: ["Events"],
    summary: "List events",
    operationId: "listEvents",
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
        schema: { type: "string", enum: ["draft", "published", "archived"] },
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
        description: "Paginated events ordered by start date (newest first)",
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["data", "pagination"],
              properties: {
                data: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Event" },
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
          Event: {
            type: "object",
            required: [
              "id",
              "slug",
              "title",
              "description",
              "startAt",
              "status",
              "isFeatured",
              "createdAt",
              "updatedAt",
            ],
            properties: {
              id: { type: "integer" },
              slug: { type: "string" },
              title: { type: "string" },
              description: { type: "string" },
              coverMediaId: { type: ["integer", "null"] },
              startAt: { type: "string", format: "date-time" },
              endAt: { type: ["string", "null"], format: "date-time" },
              location: { type: ["string", "null"] },
              status: { type: "string", enum: ["draft", "published", "archived"] },
              isFeatured: { type: "boolean" },
              metaTitle: { type: ["string", "null"] },
              metaDescription: { type: ["string", "null"] },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
            },
          },
          EventDetail: {
            allOf: [
              { $ref: "#/components/schemas/Event" },
              {
                type: "object",
                required: ["cover"],
                properties: {
                  cover: {
                    anyOf: [{ $ref: "#/components/schemas/Media" }, { type: "null" }],
                  },
                },
              },
            ],
          },
          EventCreate: {
            type: "object",
            required: ["slug", "title", "description", "startAt"],
            properties: {
              slug: {
                type: "string",
                pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
                maxLength: 200,
              },
              title: { type: "string", maxLength: 200 },
              description: { type: "string", minLength: 1 },
              coverMediaId: { type: ["integer", "null"] },
              startAt: { type: "string", format: "date-time" },
              endAt: { type: ["string", "null"], format: "date-time" },
              location: { type: ["string", "null"], maxLength: 500 },
              status: {
                type: "string",
                enum: ["draft", "published", "archived"],
                default: "draft",
              },
              isFeatured: { type: "boolean", default: false },
              metaTitle: { type: ["string", "null"], maxLength: 200 },
              metaDescription: { type: ["string", "null"], maxLength: 300 },
            },
          },
          EventUpdate: {
            type: "object",
            properties: {
              slug: {
                type: "string",
                pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
                maxLength: 200,
              },
              title: { type: "string", maxLength: 200 },
              description: { type: "string", minLength: 1 },
              coverMediaId: { type: ["integer", "null"] },
              startAt: { type: "string", format: "date-time" },
              endAt: { type: ["string", "null"], format: "date-time" },
              location: { type: ["string", "null"], maxLength: 500 },
              status: {
                type: "string",
                enum: ["draft", "published", "archived"],
              },
              isFeatured: { type: "boolean" },
              metaTitle: { type: ["string", "null"], maxLength: 200 },
              metaDescription: { type: ["string", "null"], maxLength: 300 },
            },
          },
        },
      },
    },
  },
});

export default defineHandler(async (event) => {
  const query = await getValidatedQuery(event, listEventsQuerySchema);
  const db = getDb();

  const filters: SQL[] = [];

  if (query.status) filters.push(eq(events.status, query.status));
  if (query.q) filters.push(likeContains(events.title, query.q));

  const where = filters.length > 0 ? and(...filters) : undefined;

  const [data, totalRows] = await Promise.all([
    db
      .select()
      .from(events)
      .where(where)
      .orderBy(desc(events.startAt))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ total: count() }).from(events).where(where),
  ]);

  return {
    data,
    pagination: pagination(query.page, query.pageSize, totalRows[0]?.total ?? 0),
  };
});

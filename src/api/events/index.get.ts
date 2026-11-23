import { and, count, eq, gte, isNotNull, or } from "drizzle-orm";
import { defineHandler, defineRouteMeta } from "nitro";
import { getValidatedQuery } from "nitro/h3";
import { getDb } from "@src/db/client";
import { events } from "@src/db/schema";
import { cachedJson } from "@src/utils/cache";
import { pagination } from "@src/utils/http";
import { paginationQuerySchema } from "@src/validators/common";

defineRouteMeta({
  openAPI: {
    tags: ["Public Events"],
    summary: "List upcoming published events",
    description:
      "Published events that are upcoming or still ongoing, ordered by start date (soonest first). " +
      "Drafts and archived events are never returned.",
    operationId: "listPublicEvents",
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
    ],
    responses: {
      200: {
        description: "Paginated upcoming and ongoing events ordered by start date (soonest first)",
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["data", "pagination"],
              properties: {
                data: {
                  type: "array",
                  items: { $ref: "#/components/schemas/PublicEvent" },
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
          PublicEvent: {
            type: "object",
            required: [
              "id",
              "slug",
              "title",
              "description",
              "startAt",
              "endAt",
              "location",
              "isFeatured",
              "createdAt",
              "updatedAt",
              "cover",
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
              isFeatured: { type: "boolean" },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
              cover: {
                anyOf: [{ $ref: "#/components/schemas/PublicMedia" }, { type: "null" }],
              },
            },
          },
        },
      },
    },
  },
});

export default defineHandler(async (event) => {
  const query = await getValidatedQuery(event, paginationQuerySchema);
  const db = getDb();
  const now = new Date();

  const countWhere = and(
    eq(events.status, "published"),
    or(gte(events.startAt, now), and(isNotNull(events.endAt), gte(events.endAt, now))),
  )!;

  const [data, totalRows] = await Promise.all([
    db.query.events.findMany({
      where: {
        status: "published",
        OR: [{ startAt: { gte: now } }, { endAt: { isNotNull: true, gte: now } }],
      },
      columns: { status: false },
      with: { cover: { columns: { uploadedBy: false } } },
      orderBy: (fields, { asc }) => asc(fields.startAt),
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    }),
    db.select({ total: count() }).from(events).where(countWhere),
  ]);

  return cachedJson(
    event,
    {
      data,
      pagination: pagination(query.page, query.pageSize, totalRows[0]?.total ?? 0),
    },
    60,
  );
});

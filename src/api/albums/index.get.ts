import { asc, count, eq, inArray } from "drizzle-orm";
import { defineHandler, defineRouteMeta } from "nitro";
import { getValidatedQuery } from "nitro/h3";
import { getDb } from "@src/db/client";
import { albumMedia, albums, media } from "@src/db/schema";
import { cachedJson } from "@src/utils/cache";
import { pagination } from "@src/utils/http";
import { paginationQuerySchema } from "@src/validators/common";

defineRouteMeta({
  openAPI: {
    tags: ["Public Albums"],
    summary: "List published albums with their media",
    description:
      "Published albums only, newest first, each with its cover and media items ordered by album sort order.",
    operationId: "listPublicAlbums",
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
        description: "Paginated published albums ordered by creation date (newest first)",
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["data", "pagination"],
              properties: {
                data: {
                  type: "array",
                  items: { $ref: "#/components/schemas/PublicAlbum" },
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
          PublicAlbum: {
            type: "object",
            required: [
              "id",
              "slug",
              "title",
              "description",
              "createdAt",
              "updatedAt",
              "cover",
              "items",
            ],
            properties: {
              id: { type: "integer" },
              slug: { type: "string" },
              title: { type: "string" },
              description: { type: ["string", "null"] },
              coverMediaId: { type: ["integer", "null"] },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
              cover: {
                anyOf: [{ $ref: "#/components/schemas/PublicMedia" }, { type: "null" }],
              },
              items: {
                type: "array",
                items: { $ref: "#/components/schemas/PublicMedia" },
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

  const where = eq(albums.status, "published");

  const [albumRows, totalRows] = await Promise.all([
    db.query.albums.findMany({
      where: { status: "published" },
      columns: { status: false },
      with: { cover: { columns: { uploadedBy: false } } },
      orderBy: (fields, { desc }) => desc(fields.createdAt),
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    }),
    db.select({ total: count() }).from(albums).where(where),
  ]);

  const albumIds = albumRows.map((album) => album.id);

  const mediaRows = albumIds.length
    ? await db
        .select({
          albumId: albumMedia.albumId,
          id: media.id,
          key: media.key,
          filename: media.filename,
          mimeType: media.mimeType,
          sizeBytes: media.sizeBytes,
          width: media.width,
          height: media.height,
          alt: media.alt,
          caption: media.caption,
          createdAt: media.createdAt,
        })
        .from(albumMedia)
        .innerJoin(media, eq(albumMedia.mediaId, media.id))
        .where(inArray(albumMedia.albumId, albumIds))
        .orderBy(asc(albumMedia.albumId), asc(albumMedia.sortOrder))
    : [];

  type AlbumItem = Omit<(typeof mediaRows)[number], "albumId">;
  const itemsByAlbum = new Map<number, AlbumItem[]>();

  for (const row of mediaRows) {
    const { albumId, ...item } = row;
    const items = itemsByAlbum.get(albumId);

    if (items) items.push(item);
    else itemsByAlbum.set(albumId, [item]);
  }

  const data = albumRows.map((album) => ({
    ...album,
    items: itemsByAlbum.get(album.id) ?? [],
  }));

  return cachedJson(
    event,
    {
      data,
      pagination: pagination(query.page, query.pageSize, totalRows[0]?.total ?? 0),
    },
    300,
  );
});

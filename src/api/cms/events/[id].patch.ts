import { eq } from "drizzle-orm";
import { defineHandler, defineRouteMeta } from "nitro";
import { readValidatedBody } from "nitro/h3";
import { getDb } from "../../../db/client";
import { events } from "../../../db/schema";
import { badRequest, getIdParam, notFound, writeOrThrow } from "../../../utils/http";
import { updateEventSchema } from "../../../validators/events";

defineRouteMeta({
  openAPI: {
    tags: ["Events"],
    summary: "Update an event",
    operationId: "updateEvent",
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
          schema: { $ref: "#/components/schemas/EventUpdate" },
        },
      },
    },
    responses: {
      200: {
        description: "Updated event",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Event" },
          },
        },
      },
      400: {
        description: "Validation error, no fields to update, or endAt before startAt",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
      404: {
        description: "Event not found",
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
        description: "Referenced cover does not exist",
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
  const body = await readValidatedBody(event, updateEventSchema);
  const db = getDb();

  if (Object.keys(body).length === 0) {
    throw badRequest("No fields to update");
  }

  const existing = await db.select().from(events).where(eq(events.id, id)).get();

  if (!existing) throw notFound("Event");

  const startAt = body.startAt ?? existing.startAt;
  const endAt = body.endAt === undefined ? existing.endAt : body.endAt;

  if (endAt && endAt < startAt) {
    throw badRequest("endAt must not be before startAt");
  }

  const rows = await writeOrThrow(() =>
    db.update(events).set(body).where(eq(events.id, id)).returning(),
  );
  const item = rows[0];

  if (!item) throw notFound("Event");

  return item;
});

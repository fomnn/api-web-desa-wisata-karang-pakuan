import { defineHandler, defineRouteMeta } from "nitro";
import { readValidatedBody } from "nitro/h3";
import { getDb } from "@src/db/client";
import { events } from "@src/db/schema";
import { writeOrThrow } from "@src/utils/http";
import { createEventSchema } from "@src/validators/events";

defineRouteMeta({
  openAPI: {
    tags: ["Events"],
    summary: "Create an event",
    operationId: "createEvent",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/EventCreate" },
        },
      },
    },
    responses: {
      201: {
        description: "Created event",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Event" },
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
  const body = await readValidatedBody(event, createEventSchema);

  const rows = await writeOrThrow(() => getDb().insert(events).values(body).returning());
  const item = rows[0];

  if (!item) {
    throw new Error("Failed to create event");
  }

  event.res.status = 201;
  return item;
});

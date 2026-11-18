import { defineHandler, defineRouteMeta } from "nitro";
import { getDb } from "../../../db/client";
import { getIdParam, notFound } from "../../../utils/http";

defineRouteMeta({
  openAPI: {
    tags: ["Events"],
    summary: "Get an event",
    operationId: "getEvent",
    parameters: [
      {
        in: "path",
        name: "id",
        required: true,
        schema: { type: "integer", minimum: 1 },
      },
    ],
    responses: {
      200: {
        description: "Event with cover",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/EventDetail" },
          },
        },
      },
      400: {
        description: "Invalid id",
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
    },
  },
});

export default defineHandler(async (event) => {
  const id = getIdParam(event);

  const item = await getDb().query.events.findFirst({
    where: { id },
    with: { cover: true },
  });

  if (!item) throw notFound("Event");

  return item;
});

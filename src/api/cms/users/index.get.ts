import { asc } from "drizzle-orm";
import { defineHandler, defineRouteMeta } from "nitro";
import { getDb } from "../../../db/client";
import { users } from "../../../db/schema";

defineRouteMeta({
  openAPI: {
    tags: ["Users"],
    summary: "List users",
    operationId: "listUsers",
    responses: {
      200: {
        description: "Users ordered by name. Password hashes are never returned.",
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["data"],
              properties: {
                data: {
                  type: "array",
                  items: { $ref: "#/components/schemas/User" },
                },
              },
            },
          },
        },
      },
    },
  },
});

export default defineHandler(async () => {
  const data = await getDb()
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .orderBy(asc(users.name));

  return { data };
});

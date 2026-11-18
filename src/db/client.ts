import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { relations } from "./schema";

export function getDb() {
  return drizzle(env.DB, { relations });
}

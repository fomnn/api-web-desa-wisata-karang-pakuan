import { env, exports } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { categories, media, tags, users } from "@src/db/schema";

/**
 * Direct D1 access for fixtures and assertions. Writes through `db` bypass the
 * API middleware, so they do not consume the rate limit.
 */
export const db = drizzle(env.DB);

export const API_ORIGIN = "https://api.test";

/** Calls the Nitro build output the same way a client would. */
export function api(path: string, init?: RequestInit): Promise<Response> {
  return exports.default.fetch(`${API_ORIGIN}${path}`, init);
}

let clientIpSequence = 0;

/**
 * Every write request must look like a distinct client: the limiter allows 60
 * writes per minute per IP and its counter survives across tests in a file.
 */
export function nextClientIp(): string {
  clientIpSequence += 1;
  return `10.1.0.${clientIpSequence}`;
}

export function write(path: string, init: RequestInit & { ip?: string } = {}): Promise<Response> {
  const { ip = nextClientIp(), ...requestInit } = init;
  const headers = new Headers(requestInit.headers);
  headers.set("cf-connecting-ip", ip);

  return api(path, { ...requestInit, headers });
}

export function writeJson(
  path: string,
  method: "POST" | "PATCH",
  body: unknown,
  ip?: string,
): Promise<Response> {
  return write(path, {
    method,
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    ip,
  });
}

export async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

/** Minimal content graph: one author, two categories, one tag and one media row. */
export async function seedBase() {
  const [admin] = await db
    .insert(users)
    .values({
      email: "admin@karangpakuan.test",
      name: "Admin Desa",
      passwordHash: "test",
      role: "admin",
    })
    .returning();

  const [nature] = await db
    .insert(categories)
    .values({ slug: "wisata-alam", name: "Wisata Alam", sortOrder: 1 })
    .returning();

  const [culinary] = await db
    .insert(categories)
    .values({ slug: "kuliner", name: "Kuliner", sortOrder: 2 })
    .returning();

  const [tag] = await db.insert(tags).values({ slug: "alam", name: "Alam" }).returning();

  const [cover] = await db
    .insert(media)
    .values({
      key: "seed/cover.jpg",
      filename: "cover.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 1024,
      uploadedBy: admin.id,
    })
    .returning();

  return { admin, nature, culinary, tag, cover };
}

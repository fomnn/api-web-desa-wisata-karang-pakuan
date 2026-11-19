import { lt, sql } from "drizzle-orm";
import type { HTTPEvent } from "nitro/h3";
import { getDb } from "../db/client";
import { rateLimits } from "../db/schema";

export const WRITE_LIMIT = 60;
export const WRITE_WINDOW_SECONDS = 60;

const SWEEP_INTERVAL_MS = 60 * 60 * 1000;
const SWEEP_OLDER_THAN_MS = 60 * 60 * 1000;

let lastSweepAt = 0;

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfter: number;
}

export function getClientIp(event: HTTPEvent): string {
  const forwarded = event.req.headers.get("x-forwarded-for");
  const clientAddress = event.req.context?.clientAddress;

  return (
    event.req.headers.get("cf-connecting-ip") ??
    (typeof clientAddress === "string" ? clientAddress : undefined) ??
    forwarded?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export async function consumeWriteLimit(clientId: string): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const windowEnd = now + WRITE_WINDOW_SECONDS;
  const key = `write:${clientId}`;

  const rows = await getDb()
    .insert(rateLimits)
    .values({ key, count: 1, resetAt: new Date(windowEnd * 1000) })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${rateLimits.resetAt} <= unixepoch() then 1 else ${rateLimits.count} + 1 end`,
        resetAt: sql`case when ${rateLimits.resetAt} <= unixepoch() then ${windowEnd} else ${rateLimits.resetAt} end`,
      },
    })
    .returning({ count: rateLimits.count, resetAt: rateLimits.resetAt });

  const row = rows[0];

  if (!row) {
    throw new Error("Rate limit counter was not persisted");
  }

  const resetAt = row.resetAt instanceof Date ? row.resetAt : new Date(row.resetAt);

  return {
    allowed: row.count <= WRITE_LIMIT,
    limit: WRITE_LIMIT,
    remaining: Math.max(0, WRITE_LIMIT - row.count),
    resetAt,
    retryAfter: Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000)),
  };
}

export async function sweepExpiredRateLimits(): Promise<void> {
  const now = Date.now();

  if (now - lastSweepAt < SWEEP_INTERVAL_MS) return;

  lastSweepAt = now;

  await getDb()
    .delete(rateLimits)
    .where(lt(rateLimits.resetAt, new Date(now - SWEEP_OLDER_THAN_MS)));
}

import { mockEvent } from "nitro/h3";
import { describe, expect, it } from "vitest";
import { cachedJson } from "@src/utils/cache";

const body = { data: [{ id: 1 }], pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1 } };

describe("cachedJson", () => {
  it("sets a content-derived ETag and Cache-Control", async () => {
    const event = mockEvent("/api/posts");

    await expect(cachedJson(event, body)).resolves.toEqual(body);
    expect(event.res.headers.get("etag")).toMatch(/^"[0-9a-f]{64}"$/);
    expect(event.res.headers.get("cache-control")).toBe("public, max-age=60");
  });

  it("accepts a custom max-age", async () => {
    const event = mockEvent("/api/albums");

    await cachedJson(event, body, 300);

    expect(event.res.headers.get("cache-control")).toBe("public, max-age=300");
  });

  it("derives a stable ETag for the same body", async () => {
    const first = mockEvent("/api/posts");
    const second = mockEvent("/api/posts");

    await cachedJson(first, body);
    await cachedJson(second, body);

    expect(first.res.headers.get("etag")).toBe(second.res.headers.get("etag"));
  });

  it("answers 304 when If-None-Match matches", async () => {
    const warmup = mockEvent("/api/posts");
    await cachedJson(warmup, body);
    const etag = warmup.res.headers.get("etag")!;

    const event = mockEvent("/api/posts", { headers: { "if-none-match": etag } });

    await expect(cachedJson(event, body)).resolves.toBeNull();
    expect(event.res.status).toBe(304);
  });

  it("matches weak validators and the * wildcard", async () => {
    const warmup = mockEvent("/api/posts");
    await cachedJson(warmup, body);
    const etag = warmup.res.headers.get("etag")!;

    await expect(
      cachedJson(mockEvent("/api/posts", { headers: { "if-none-match": `W/${etag}` } }), body),
    ).resolves.toBeNull();
    await expect(
      cachedJson(mockEvent("/api/posts", { headers: { "if-none-match": "*" } }), body),
    ).resolves.toBeNull();
  });

  it("returns the body when the validator does not match", async () => {
    const event = mockEvent("/api/posts", { headers: { "if-none-match": '"stale"' } });

    await expect(cachedJson(event, body)).resolves.toEqual(body);
    expect(event.res.status).toBeUndefined();
  });
});

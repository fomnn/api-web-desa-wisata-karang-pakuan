import { describe, expect, it } from "vitest";
import { rateLimits } from "@src/db/schema";
import { api, db, readJson, write, writeJson } from "./helpers";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_ORIGIN = "https://desa.example";

describe("request id", () => {
  it("generates one when the request has none", async () => {
    const response = await api("/api/posts");

    expect(response.headers.get("x-request-id")).toMatch(UUID);
  });

  it("echoes a client-supplied id", async () => {
    const response = await api("/api/posts", { headers: { "x-request-id": "client-req-1" } });

    expect(response.headers.get("x-request-id")).toBe("client-req-1");
  });

  it("replaces an invalid id", async () => {
    const response = await api("/api/posts", { headers: { "x-request-id": "bad id!" } });

    expect(response.headers.get("x-request-id")).not.toBe("bad id!");
    expect(response.headers.get("x-request-id")).toMatch(UUID);
  });
});

describe("security headers", () => {
  it.each(["/api/posts", "/route-yang-tidak-ada"])(
    "applies to successful and error responses (%s)",
    async (path) => {
      const response = await api(path);

      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(response.headers.get("x-frame-options")).toBe("SAMEORIGIN");
      expect(response.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
      expect(response.headers.get("strict-transport-security")).toBe(
        "max-age=31536000; includeSubDomains",
      );
      expect(response.headers.get("x-request-id")).toMatch(UUID);
    },
  );
});

describe("CORS", () => {
  it("answers preflight requests for a configured origin", async () => {
    const response = await api("/api/posts", {
      method: "OPTIONS",
      headers: {
        origin: ALLOWED_ORIGIN,
        "access-control-request-method": "GET",
        "access-control-request-headers": "x-request-id",
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(ALLOWED_ORIGIN);
    expect(response.headers.get("access-control-allow-credentials")).toBe("true");
    expect(response.headers.get("access-control-allow-methods")).toContain("DELETE");
    expect(response.headers.get("access-control-allow-headers")).toBe("x-request-id");
  });

  it("adds CORS headers to normal responses", async () => {
    const response = await api("/api/posts", { headers: { origin: ALLOWED_ORIGIN } });

    expect(response.headers.get("access-control-allow-origin")).toBe(ALLOWED_ORIGIN);
    expect(response.headers.get("vary")?.toLowerCase()).toContain("origin");
  });

  it("ignores unconfigured origins", async () => {
    const response = await api("/api/posts", { headers: { origin: "https://evil.example" } });

    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });
});

describe("rate limiting", () => {
  it("reports the write quota on writes only", async () => {
    const created = await write("/api/cms/categories", {
      method: "POST",
      body: JSON.stringify({ slug: "kategori-limit", name: "Kategori Limit" }),
      headers: { "content-type": "application/json" },
    });

    expect(created.status).toBe(201);
    expect(created.headers.get("x-ratelimit-limit")).toBe("60");
    expect(created.headers.get("x-ratelimit-remaining")).toBe("59");
    expect(Number(created.headers.get("x-ratelimit-reset"))).toBeGreaterThan(
      Math.floor(Date.now() / 1000),
    );

    const read = await api("/api/posts");

    expect(read.headers.get("x-ratelimit-limit")).toBeNull();
  });

  it("returns 429 once the client uses up its minute", async () => {
    const clientIp = "203.0.113.50";
    await db.insert(rateLimits).values({
      key: `write:${clientIp}`,
      count: 60,
      resetAt: new Date(Date.now() + 60_000),
    });

    const blocked = await writeJson(
      "/api/cms/categories",
      "POST",
      { slug: "kategori-diblokir", name: "Kategori Diblokir" },
      clientIp,
    );
    const body = await readJson<Record<string, any>>(blocked);

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("x-ratelimit-remaining")).toBe("0");
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(body).toMatchObject({
      error: true,
      status: 429,
      statusText: "Too Many Requests",
      data: { retryAfter: expect.any(Number) },
    });

    // A different client is unaffected.
    const other = await writeJson("/api/cms/categories", "POST", {
      slug: "kategori-klien-lain",
      name: "Kategori Klien Lain",
    });

    expect(other.status).toBe(201);
  });
});

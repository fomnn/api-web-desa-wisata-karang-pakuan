import { HTTPError } from "nitro";
import { mockEvent } from "nitro/h3";
import { describe, expect, it } from "vitest";
import {
  getIdParam,
  getSlugParam,
  pagination,
  tooManyRequests,
  writeOrThrow,
} from "@src/utils/http";

describe("getIdParam", () => {
  it("parses a positive integer id", () => {
    const event = mockEvent("/api/cms/posts/7");
    event.context.params = { id: "7" };

    expect(getIdParam(event)).toBe(7);
  });

  it.each(["0", "-3", "1.5", "abc", ""])("rejects id %j with 400", (id) => {
    const event = mockEvent("/api/cms/posts/x");
    event.context.params = { id };

    expect(() => getIdParam(event)).toThrowError(
      expect.objectContaining({ status: 400, statusText: "Bad Request", message: "Invalid id" }),
    );
  });

  it("rejects a missing route param", () => {
    expect(() => getIdParam(mockEvent("/api/cms/posts"))).toThrowError(
      expect.objectContaining({ status: 400 }),
    );
  });
});

describe("getSlugParam", () => {
  it("returns the slug", () => {
    const event = mockEvent("/api/posts/curug-cimuncang");
    event.context.params = { slug: "curug-cimuncang" };

    expect(getSlugParam(event)).toBe("curug-cimuncang");
  });

  it("rejects a missing slug", () => {
    expect(() => getSlugParam(mockEvent("/api/posts"))).toThrowError(
      expect.objectContaining({ status: 400, message: "Invalid slug" }),
    );
  });
});

describe("pagination", () => {
  it("computes total pages, rounding up", () => {
    expect(pagination(2, 10, 25)).toEqual({ page: 2, pageSize: 10, total: 25, totalPages: 3 });
  });

  it("reports zero pages for an empty result", () => {
    expect(pagination(1, 50, 0)).toEqual({
      page: 1,
      pageSize: 50,
      total: 0,
      totalPages: 0,
    });
  });
});

describe("tooManyRequests", () => {
  it("carries retry and rate-limit headers plus retry data", () => {
    const error = tooManyRequests({
      limit: 60,
      resetAt: new Date("2026-11-24T08:31:00.000Z"),
      retryAfter: 30,
    });

    expect(error.status).toBe(429);
    expect(error.statusText).toBe("Too Many Requests");
    expect(error.data).toEqual({ retryAfter: 30 });
    expect(Object.fromEntries(error.headers!)).toMatchObject({
      "retry-after": "30",
      "x-ratelimit-limit": "60",
      "x-ratelimit-remaining": "0",
      "x-ratelimit-reset": String(Math.floor(Date.parse("2026-11-24T08:31:00.000Z") / 1000)),
    });
  });
});

describe("writeOrThrow", () => {
  it("returns the operation result", async () => {
    await expect(writeOrThrow(async () => "ok")).resolves.toBe("ok");
  });

  it("rethrows HTTPErrors untouched", async () => {
    const original = new HTTPError({ status: 404, statusText: "Not Found", message: "Post" });

    await expect(
      writeOrThrow(async () => {
        throw original;
      }),
    ).rejects.toBe(original);
  });

  it("maps UNIQUE constraint failures to 409", async () => {
    await expect(
      writeOrThrow(async () => {
        throw new Error("D1_ERROR: UNIQUE constraint failed: posts.slug");
      }),
    ).rejects.toMatchObject({ status: 409, statusText: "Conflict", message: "Duplicate value" });
  });

  it("maps FOREIGN KEY constraint failures to 422", async () => {
    await expect(
      writeOrThrow(async () => {
        throw new Error("D1_ERROR: FOREIGN KEY constraint failed");
      }),
    ).rejects.toMatchObject({ status: 422, statusText: "Unprocessable Entity" });
  });

  it("finds D1 messages nested in the cause chain", async () => {
    await expect(
      writeOrThrow(async () => {
        throw new Error("query failed", {
          cause: new Error("UNIQUE constraint failed: categories.slug"),
        });
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("rethrows unrecognized failures", async () => {
    const error = new Error("network down");

    await expect(
      writeOrThrow(async () => {
        throw error;
      }),
    ).rejects.toBe(error);
  });
});

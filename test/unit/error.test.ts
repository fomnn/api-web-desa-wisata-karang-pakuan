import { HTTPError } from "nitro";
import { mockEvent } from "nitro/h3";
import { describe, expect, it } from "vitest";
import errorHandler from "@src/error";
import { tooManyRequests } from "@src/utils/http";

type Handler = (error: unknown, event: ReturnType<typeof mockEvent>) => Response;

// The handler only reads `status`/`unhandled`, so plain Errors are valid at runtime.
// oxlint-disable-next-line typescript/no-unsafe-type-assertion
const handle = errorHandler as unknown as Handler;

async function bodyOf(response: Response): Promise<unknown> {
  return response.json();
}

describe("error handler", () => {
  it("formats HTTP errors as JSON", async () => {
    const response = handle(
      new HTTPError({ status: 404, statusText: "Not Found", message: "Post not found" }),
      mockEvent("/api/posts/missing"),
    );
    const body = await bodyOf(response);

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toEqual({
      error: true,
      status: 404,
      statusText: "Not Found",
      message: "Post not found",
    });
  });

  it("keeps error headers and data", async () => {
    const response = handle(
      tooManyRequests({ limit: 60, resetAt: new Date("2026-11-24T08:31:00.000Z"), retryAfter: 30 }),
      mockEvent("/api/cms/posts"),
    );
    const body = await bodyOf(response);

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("30");
    expect(body).toMatchObject({ status: 429, data: { retryAfter: 30 } });
  });

  it("hides details of unhandled failures", async () => {
    const response = handle(new Error("D1 secret details"), mockEvent("/api/posts"));
    const body = await bodyOf(response);

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: true,
      status: 500,
      statusText: "Internal Server Error",
      message: "Internal Server Error",
    });
  });
});

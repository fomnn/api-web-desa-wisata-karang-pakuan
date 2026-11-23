import { mockEvent } from "nitro/h3";
import { describe, expect, it } from "vitest";
import {
  getRequestId,
  getRequestPath,
  getRequestStartedAt,
  setRequestId,
  setRequestStartedAt,
} from "@src/utils/request-context";

describe("request context", () => {
  it("stores and reads the request id", () => {
    const event = mockEvent("/api/posts");

    expect(getRequestId(event)).toBeUndefined();
    setRequestId(event, "req-123");
    expect(getRequestId(event)).toBe("req-123");
  });

  it("stores and reads the request start timestamp", () => {
    const event = mockEvent("/api/posts");

    expect(getRequestStartedAt(event)).toBeUndefined();
    setRequestStartedAt(event, 1_700_000_000_000);
    expect(getRequestStartedAt(event)).toBe(1_700_000_000_000);
  });

  it("ignores values of the wrong type", () => {
    const event = mockEvent("/api/posts");
    event.context.requestId = 42;
    event.context.requestStartedAt = "yesterday";

    expect(getRequestId(event)).toBeUndefined();
    expect(getRequestStartedAt(event)).toBeUndefined();
  });

  it("returns the request pathname", () => {
    expect(getRequestPath(mockEvent("https://api.test/api/posts?page=2"))).toBe("/api/posts");
  });
});

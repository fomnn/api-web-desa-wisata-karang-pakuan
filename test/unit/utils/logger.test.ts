import { afterEach, describe, expect, it, vi } from "vitest";
import { log } from "@src/utils/logger";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("log", () => {
  it("writes JSON lines to the logger matching the level", () => {
    const info = vi.spyOn(console, "log").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    log("info", "request", { status: 200 });
    log("warn", "slow", { durationMs: 900 });
    log("error", "boom");

    expect(info).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(1);

    const entry: unknown = JSON.parse(String(info.mock.calls[0]?.[0]));

    expect(entry).toMatchObject({
      time: expect.any(String),
      level: "info",
      message: "request",
      status: 200,
    });
  });
});

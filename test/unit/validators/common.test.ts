import * as v from "valibot";
import { describe, expect, it } from "vitest";
import {
  paginationQuerySchema,
  queryIdSchema,
  searchEntry,
  slugSchema,
  timestampSchema,
  titleSchema,
  unique,
} from "@src/validators/common";

describe("slugSchema", () => {
  it("trims and accepts lowercase kebab-case", () => {
    expect(v.parse(slugSchema, "  wisata-alam  ")).toBe("wisata-alam");
  });

  it.each(["Wisata-Alam", "wisata_alam", "wisata alam", "-awal", "akhir-", ""])(
    "rejects %j",
    (slug) => {
      expect(() => v.parse(slugSchema, slug)).toThrow();
    },
  );

  it("rejects slugs longer than 200 characters", () => {
    expect(() => v.parse(slugSchema, "a".repeat(201))).toThrow();
  });
});

describe("titleSchema", () => {
  it("trims surrounding whitespace", () => {
    expect(v.parse(titleSchema, "  Festival Panen  ")).toBe("Festival Panen");
  });

  it("rejects empty and oversized titles", () => {
    expect(() => v.parse(titleSchema, "   ")).toThrow();
    expect(() => v.parse(titleSchema, "a".repeat(201))).toThrow();
  });
});

describe("timestampSchema", () => {
  it("converts ISO strings to Date", () => {
    const parsed = v.parse(timestampSchema, "2026-11-24T08:30:00.000Z");

    expect(parsed).toBeInstanceOf(Date);
    expect(parsed.toISOString()).toBe("2026-11-24T08:30:00.000Z");
  });

  it("rejects invalid dates", () => {
    expect(() => v.parse(timestampSchema, "bukan tanggal")).toThrow();
  });
});

describe("paginationQuerySchema", () => {
  it("applies defaults", () => {
    expect(v.parse(paginationQuerySchema, {})).toEqual({ page: 1, pageSize: 50 });
  });

  it("coerces query-string numbers", () => {
    expect(v.parse(paginationQuerySchema, { page: "3", pageSize: "10" })).toEqual({
      page: 3,
      pageSize: 10,
    });
  });

  it.each([
    [{ page: "0" }],
    [{ page: "1.5" }],
    [{ page: "dua" }],
    [{ pageSize: "101" }],
    [{ pageSize: "-1" }],
  ])("rejects %j", (input) => {
    expect(() => v.parse(paginationQuerySchema, input)).toThrow();
  });
});

describe("queryIdSchema", () => {
  it("accepts missing values", () => {
    expect(v.parse(queryIdSchema, undefined)).toBeUndefined();
  });

  it("coerces positive integers", () => {
    expect(v.parse(queryIdSchema, "7")).toBe(7);
  });

  it("rejects zero and non-numeric values", () => {
    expect(() => v.parse(queryIdSchema, "0")).toThrow();
    expect(() => v.parse(queryIdSchema, "abc")).toThrow();
  });
});

describe("searchEntry", () => {
  it("turns blank input into undefined", () => {
    expect(v.parse(searchEntry, "")).toBeUndefined();
    expect(v.parse(searchEntry, "   ")).toBeUndefined();
  });

  it("trims a real search term", () => {
    expect(v.parse(searchEntry, "  kopi  ")).toBe("kopi");
  });
});

describe("unique", () => {
  it("removes duplicates while keeping first-seen order", () => {
    expect(unique([2, 1, 2, 3, 1])).toEqual([2, 1, 3]);
  });
});

import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { mediaType, mediaUploadFieldsSchema } from "@src/validators/media";

describe("mediaType", () => {
  it.each([
    ["image/avif", "avif", "image"],
    ["image/gif", "gif", "image"],
    ["image/jpeg", "jpg", "image"],
    ["image/png", "png", "image"],
    ["image/webp", "webp", "image"],
    ["video/mp4", "mp4", "video"],
    ["video/quicktime", "mov", "video"],
    ["video/webm", "webm", "video"],
  ])("maps %s to .%s (%s)", (mimeType, ext, kind) => {
    expect(mediaType(mimeType)).toEqual({ ext, kind });
  });

  it("returns null for unsupported types", () => {
    expect(mediaType("application/pdf")).toBeNull();
    expect(mediaType("text/plain")).toBeNull();
  });

  it("is case-sensitive, matching what browsers send", () => {
    expect(mediaType("IMAGE/PNG")).toBeNull();
  });
});

describe("mediaUploadFieldsSchema", () => {
  it("coerces form strings and nulls missing optionals", () => {
    expect(v.parse(mediaUploadFieldsSchema, { uploadedBy: "3" })).toEqual({
      uploadedBy: 3,
      alt: null,
      caption: null,
      width: null,
      height: null,
      durationSeconds: null,
    });
  });

  it("converts blank optionals to null", () => {
    const parsed = v.parse(mediaUploadFieldsSchema, {
      uploadedBy: "1",
      alt: "   ",
      caption: "",
    });

    expect(parsed.alt).toBeNull();
    expect(parsed.caption).toBeNull();
  });

  it("accepts numeric dimension and duration fields", () => {
    const parsed = v.parse(mediaUploadFieldsSchema, {
      uploadedBy: "1",
      width: "1600",
      height: "1067",
      durationSeconds: "42",
    });

    expect(parsed).toMatchObject({ width: 1600, height: 1067, durationSeconds: 42 });
  });

  it("rejects a missing or invalid uploadedBy", () => {
    expect(() => v.parse(mediaUploadFieldsSchema, {})).toThrow();
    expect(() => v.parse(mediaUploadFieldsSchema, { uploadedBy: "abc" })).toThrow();
    expect(() => v.parse(mediaUploadFieldsSchema, { uploadedBy: "0" })).toThrow();
  });

  it("rejects invalid dimensions", () => {
    expect(() => v.parse(mediaUploadFieldsSchema, { uploadedBy: "1", width: "0" })).toThrow();
  });
});

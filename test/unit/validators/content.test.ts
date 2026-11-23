import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { createCategorySchema, updateCategorySchema } from "@src/validators/categories";
import {
  createEventSchema,
  listEventsQuerySchema,
  updateEventSchema,
} from "@src/validators/events";
import { createPostSchema, listPostsQuerySchema, updatePostSchema } from "@src/validators/posts";
import { createProductSchema, updateProductSchema } from "@src/validators/products";
import { createTagSchema, updateTagSchema } from "@src/validators/tags";

describe("posts", () => {
  const minimal = {
    slug: "post-satu",
    title: "Post Satu",
    content: "Isi tulisan",
    authorId: 1,
  };

  it("defaults to draft and not featured", () => {
    expect(v.parse(createPostSchema, minimal)).toMatchObject({
      status: "draft",
      isFeatured: false,
    });
  });

  it("deduplicates tagIds", () => {
    const parsed = v.parse(createPostSchema, { ...minimal, tagIds: [3, 1, 3] });

    expect(parsed.tagIds).toEqual([3, 1]);
  });

  it("treats post fields as required", () => {
    expect(() => v.parse(createPostSchema, { ...minimal, authorId: undefined })).toThrow();
    expect(() => v.parse(createPostSchema, { ...minimal, content: "" })).toThrow();
  });

  it("rejects unknown editorial statuses", () => {
    expect(() => v.parse(createPostSchema, { ...minimal, status: "deleted" })).toThrow();
  });

  it("allows partial updates", () => {
    expect(v.parse(updatePostSchema, {})).toEqual({});
    expect(v.parse(updatePostSchema, { title: "  Judul Baru  " })).toEqual({
      title: "Judul Baru",
    });
  });

  it("rejects invalid values in partial updates", () => {
    expect(() => v.parse(updatePostSchema, { slug: "Bukan Slug" })).toThrow();
  });

  it("validates list filters", () => {
    expect(v.parse(listPostsQuerySchema, { status: "draft", page: "2" })).toMatchObject({
      status: "draft",
      page: 2,
    });
    expect(() => v.parse(listPostsQuerySchema, { status: "nope" })).toThrow();
  });
});

describe("events", () => {
  const minimal = {
    slug: "festival-panen",
    title: "Festival Panen",
    description: "Pasar tani dan pentas seni.",
    startAt: "2026-12-01T08:00:00.000Z",
    endAt: "2026-12-03T17:00:00.000Z",
  };

  it("defaults to draft and not featured", () => {
    expect(v.parse(createEventSchema, minimal)).toMatchObject({
      status: "draft",
      isFeatured: false,
    });
  });

  it("rejects an end that precedes the start", () => {
    expect(() =>
      v.parse(createEventSchema, {
        ...minimal,
        endAt: "2026-11-30T08:00:00.000Z",
      }),
    ).toThrow();
  });

  it("allows an end equal to the start", () => {
    expect(() => v.parse(createEventSchema, { ...minimal, endAt: minimal.startAt })).not.toThrow();
  });

  it("allows partial updates", () => {
    expect(v.parse(updateEventSchema, {})).toEqual({});
  });

  it("validates list filters", () => {
    expect(() => v.parse(listEventsQuerySchema, { status: "review" })).toThrow();
  });
});

describe("products", () => {
  const minimal = {
    slug: "kopi-arabika",
    name: "Kopi Arabika",
    description: "Biji kopi proses natural.",
    price: 45000,
    sellerName: "Kelompok Tani",
  };

  it("defaults to draft and not featured", () => {
    expect(v.parse(createProductSchema, minimal)).toMatchObject({
      status: "draft",
      isFeatured: false,
    });
  });

  it("requires a non-negative integer price", () => {
    expect(v.parse(createProductSchema, { ...minimal, price: 0 })).toMatchObject({ price: 0 });
    expect(() => v.parse(createProductSchema, { ...minimal, price: -1 })).toThrow();
    expect(() => v.parse(createProductSchema, { ...minimal, price: 1500.5 })).toThrow();
  });

  it("allows partial updates", () => {
    expect(v.parse(updateProductSchema, { price: 50000 })).toEqual({ price: 50000 });
  });
});

describe("categories and tags", () => {
  it("defaults category sortOrder to zero", () => {
    expect(v.parse(createCategorySchema, { slug: "budaya", name: "Budaya" })).toMatchObject({
      sortOrder: 0,
    });
  });

  it("allows empty category and tag updates", () => {
    expect(v.parse(updateCategorySchema, {})).toEqual({});
    expect(v.parse(updateTagSchema, {})).toEqual({});
  });

  it("requires tag slug and name", () => {
    expect(() => v.parse(createTagSchema, { slug: "alam" })).toThrow();
  });
});

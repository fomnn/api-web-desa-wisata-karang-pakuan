import { beforeAll, describe, expect, it } from "vitest";
import { postTags, posts } from "@src/db/schema";
import { api, db, readJson, seedBase } from "./helpers";

let seed: Awaited<ReturnType<typeof seedBase>>;
let featuredId: number;

beforeAll(async () => {
  seed = await seedBase();

  const inserted = await db
    .insert(posts)
    .values([
      {
        slug: "curug-cimuncang",
        title: "Menjelajah Curug Cimuncang",
        excerpt: "Air terjun setinggi 15 meter.",
        content: "Jalur trekking ringan dari balai desa.",
        categoryId: seed.nature.id,
        coverMediaId: seed.cover.id,
        authorId: seed.admin.id,
        status: "published",
        publishedAt: new Date("2026-11-20T08:00:00.000Z"),
        isFeatured: true,
      },
      {
        slug: "pasar-tani-mingguan",
        title: "Pasar Tani Mingguan",
        content: "Hasil panen dan produk UMKM warga.",
        categoryId: seed.culinary.id,
        authorId: seed.admin.id,
        status: "published",
        publishedAt: new Date("2026-11-10T08:00:00.000Z"),
        isFeatured: false,
      },
      {
        slug: "homestay-warga",
        title: "Panduan Homestay Warga",
        content: "Belum terbit.",
        authorId: seed.admin.id,
        status: "draft",
      },
      {
        slug: "festival-panen",
        title: "Festival Panen",
        content: "Menunggu review editor.",
        authorId: seed.admin.id,
        status: "review",
      },
      {
        slug: "sawah-terasering",
        title: "Sawah Terasering",
        content: "Sudah diarsipkan.",
        authorId: seed.admin.id,
        status: "archived",
        publishedAt: new Date("2026-10-01T08:00:00.000Z"),
      },
    ])
    .returning();

  featuredId = inserted.find((post) => post.slug === "curug-cimuncang")!.id;
  await db.insert(postTags).values({ postId: featuredId, tagId: seed.tag.id });
});

describe("GET /api/posts", () => {
  it("returns only published posts, newest first, without editor-only fields", async () => {
    const response = await api("/api/posts");
    const body = await readJson<{
      data: Array<Record<string, unknown>>;
      pagination: Record<string, number>;
    }>(response);

    expect(response.status).toBe(200);
    expect(body.pagination).toEqual({ page: 1, pageSize: 50, total: 2, totalPages: 1 });
    expect(body.data.map((post) => post.slug)).toEqual(["curug-cimuncang", "pasar-tani-mingguan"]);
    expect(body.data[0]).toMatchObject({
      category: { slug: "wisata-alam" },
      cover: { key: "seed/cover.jpg" },
      isFeatured: true,
    });
    expect(body.data[0]).not.toHaveProperty("content");
    expect(body.data[0]).not.toHaveProperty("status");
    expect(body.data[0]).not.toHaveProperty("authorId");
  });

  it("paginates", async () => {
    const first = await readJson<{
      data: Array<{ slug: string }>;
      pagination: Record<string, number>;
    }>(await api("/api/posts?pageSize=1"));

    expect(first.data.map((post) => post.slug)).toEqual(["curug-cimuncang"]);
    expect(first.pagination).toMatchObject({ page: 1, pageSize: 1, total: 2, totalPages: 2 });

    const second = await readJson<{ data: Array<{ slug: string }> }>(
      await api("/api/posts?pageSize=1&page=2"),
    );

    expect(second.data.map((post) => post.slug)).toEqual(["pasar-tani-mingguan"]);
  });

  it("filters by category, tag and title search", async () => {
    const byCategory = await readJson<{ data: Array<{ slug: string }> }>(
      await api(`/api/posts?categoryId=${seed.culinary.id}`),
    );
    const byTag = await readJson<{ data: Array<{ slug: string }> }>(
      await api(`/api/posts?tagId=${seed.tag.id}`),
    );
    const bySearch = await readJson<{ data: Array<{ slug: string }> }>(
      await api("/api/posts?q=tani"),
    );
    const byUnknownTag = await readJson<{ data: unknown[]; pagination: { total: number } }>(
      await api("/api/posts?tagId=9999"),
    );

    expect(byCategory.data.map((post) => post.slug)).toEqual(["pasar-tani-mingguan"]);
    expect(byTag.data.map((post) => post.slug)).toEqual(["curug-cimuncang"]);
    expect(bySearch.data.map((post) => post.slug)).toEqual(["pasar-tani-mingguan"]);
    expect(byUnknownTag.data).toEqual([]);
    expect(byUnknownTag.pagination.total).toBe(0);
  });

  it("rejects invalid pagination", async () => {
    const response = await api("/api/posts?pageSize=101");

    expect(response.status).toBe(400);
    expect(await readJson<Record<string, unknown>>(response)).toMatchObject({
      error: true,
      status: 400,
    });
  });

  it("answers 304 for a matching ETag", async () => {
    const first = await api("/api/posts");
    const etag = first.headers.get("etag");

    expect(etag).toMatch(/^"[0-9a-f]{64}"$/);
    expect(first.headers.get("cache-control")).toBe("public, max-age=60");

    const second = await api("/api/posts", { headers: { "if-none-match": etag! } });

    expect(second.status).toBe(304);
    expect(await second.text()).toBe("");
  });
});

describe("GET /api/posts/:slug", () => {
  it("returns the published post with author, tags and cover", async () => {
    const response = await api("/api/posts/curug-cimuncang");
    const body = await readJson<Record<string, any>>(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      slug: "curug-cimuncang",
      content: "Jalur trekking ringan dari balai desa.",
      author: { id: seed.admin.id, name: "Admin Desa" },
      tags: [{ slug: "alam", name: "Alam" }],
    });
    expect(body.author).not.toHaveProperty("passwordHash");
    expect(body.author).not.toHaveProperty("email");
    expect(body).not.toHaveProperty("status");
    expect(response.headers.get("cache-control")).toBe("public, max-age=300");
  });

  it("hides unpublished and unknown posts behind 404", async () => {
    for (const slug of ["homestay-warga", "tidak-ada"]) {
      const response = await api(`/api/posts/${slug}`);

      expect(response.status).toBe(404);
      expect(await readJson<Record<string, unknown>>(response)).toEqual({
        error: true,
        status: 404,
        statusText: "Not Found",
        message: "Post not found",
      });
    }
  });
});

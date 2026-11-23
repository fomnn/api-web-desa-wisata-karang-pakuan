import { beforeAll, describe, expect, it } from "vitest";
import { api, readJson, seedBase, write, writeJson } from "./helpers";

let seed: Awaited<ReturnType<typeof seedBase>>;

beforeAll(async () => {
  seed = await seedBase();
});

function draftBody(slug: string, overrides: Record<string, unknown> = {}) {
  return {
    slug,
    title: "Post Baru",
    content: "Isi tulisan desa.",
    authorId: seed.admin.id,
    ...overrides,
  };
}

describe("POST /api/cms/posts", () => {
  it("creates a draft with defaults", async () => {
    const response = await writeJson("/api/cms/posts", "POST", draftBody("draft-baru"));
    const body = await readJson<Record<string, any>>(response);

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      slug: "draft-baru",
      status: "draft",
      publishedAt: null,
      isFeatured: false,
    });
    expect(body.id).toEqual(expect.any(Number));
  });

  it("stamps publishedAt and links tags for a published post", async () => {
    const response = await writeJson(
      "/api/cms/posts",
      "POST",
      draftBody("terbit-dengan-tag", { status: "published", tagIds: [seed.tag.id] }),
    );
    const body = await readJson<Record<string, any>>(response);

    expect(response.status).toBe(201);
    expect(body.publishedAt).toEqual(expect.any(String));

    const detail = await readJson<Record<string, any>>(await api(`/api/cms/posts/${body.id}`));

    expect(detail.tags).toEqual([{ id: seed.tag.id, slug: "alam", name: "Alam" }]);
    expect(detail.status).toBe("published");
  });

  it("rejects a duplicate slug with 409", async () => {
    await writeJson("/api/cms/posts", "POST", draftBody("slug-ganda"));

    const response = await writeJson("/api/cms/posts", "POST", draftBody("slug-ganda"));

    expect(response.status).toBe(409);
    expect(await readJson<Record<string, unknown>>(response)).toMatchObject({
      error: true,
      status: 409,
      message: "Duplicate value",
    });
  });

  it("rejects an unknown author with 422", async () => {
    const response = await writeJson(
      "/api/cms/posts",
      "POST",
      draftBody("penulis-hilang", { authorId: 9999 }),
    );

    expect(response.status).toBe(422);
    expect(await readJson<Record<string, unknown>>(response)).toMatchObject({
      status: 422,
      message: "Referenced record does not exist",
    });
  });

  it("rejects an invalid body with 400", async () => {
    const response = await writeJson(
      "/api/cms/posts",
      "POST",
      draftBody("judul-kosong", { title: "   " }),
    );

    expect(response.status).toBe(400);
    expect(await readJson<Record<string, unknown>>(response)).toMatchObject({
      error: true,
      status: 400,
      message: expect.any(String),
    });
  });
});

describe("GET /api/cms/posts", () => {
  it("filters by status", async () => {
    const body = await readJson<{ data: Array<{ status: string }> }>(
      await api("/api/cms/posts?status=draft"),
    );

    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data.every((post) => post.status === "draft")).toBe(true);
  });

  it("treats LIKE wildcards in the search term literally", async () => {
    await writeJson(
      "/api/cms/posts",
      "POST",
      draftBody("diskon-separuh-harga", { title: "Diskon 50% untuk Warga" }),
    );
    await writeJson(
      "/api/cms/posts",
      "POST",
      draftBody("promo-spesial", { title: "Promo Spesial" }),
    );

    const body = await readJson<{ data: Array<{ slug: string }> }>(
      await api("/api/cms/posts?q=%25"),
    );

    expect(body.data.map((post) => post.slug)).toEqual(["diskon-separuh-harga"]);
  });
});

describe("PATCH /api/cms/posts/:id", () => {
  it("updates only the provided fields", async () => {
    const created = await readJson<Record<string, any>>(
      await writeJson("/api/cms/posts", "POST", draftBody("untuk-patch")),
    );

    const response = await writeJson(`/api/cms/posts/${created.id}`, "PATCH", {
      title: "Judul Diperbarui",
    });
    const body = await readJson<Record<string, any>>(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ id: created.id, slug: "untuk-patch", title: "Judul Diperbarui" });
  });

  it("sets and clears publishedAt when status changes", async () => {
    const created = await readJson<Record<string, any>>(
      await writeJson("/api/cms/posts", "POST", draftBody("transisi-status")),
    );

    const published = await readJson<Record<string, any>>(
      await writeJson(`/api/cms/posts/${created.id}`, "PATCH", { status: "published" }),
    );
    expect(published.publishedAt).toEqual(expect.any(String));

    const backToDraft = await readJson<Record<string, any>>(
      await writeJson(`/api/cms/posts/${created.id}`, "PATCH", { status: "draft" }),
    );
    expect(backToDraft.publishedAt).toBeNull();
  });

  it("replaces tags when tagIds is provided", async () => {
    const created = await readJson<Record<string, any>>(
      await writeJson(
        "/api/cms/posts",
        "POST",
        draftBody("tag-diganti", { tagIds: [seed.tag.id] }),
      ),
    );

    await writeJson(`/api/cms/posts/${created.id}`, "PATCH", { tagIds: [] });

    const detail = await readJson<Record<string, any>>(await api(`/api/cms/posts/${created.id}`));

    expect(detail.tags).toEqual([]);
  });

  it("rejects an empty body", async () => {
    const response = await writeJson("/api/cms/posts/1", "PATCH", {});

    expect(response.status).toBe(400);
    expect(await readJson<Record<string, unknown>>(response)).toMatchObject({
      message: "No fields to update",
    });
  });

  it("rejects a malformed id with 400", async () => {
    const response = await writeJson("/api/cms/posts/abc", "PATCH", { title: "Baru" });

    expect(response.status).toBe(400);
    expect(await readJson<Record<string, unknown>>(response)).toMatchObject({
      message: "Invalid id",
    });
  });

  it("returns 404 for a missing post", async () => {
    const response = await writeJson("/api/cms/posts/9999", "PATCH", { title: "Baru" });

    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/cms/posts/:id", () => {
  it("deletes the post and then reports it as missing", async () => {
    const created = await readJson<Record<string, any>>(
      await writeJson("/api/cms/posts", "POST", draftBody("untuk-dihapus")),
    );

    const deleted = await write(`/api/cms/posts/${created.id}`, { method: "DELETE" });

    expect(deleted.status).toBe(204);
    expect(await deleted.text()).toBe("");
    expect((await api(`/api/cms/posts/${created.id}`)).status).toBe(404);
    expect((await write(`/api/cms/posts/${created.id}`, { method: "DELETE" })).status).toBe(404);
  });
});

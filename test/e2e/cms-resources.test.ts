import { beforeAll, describe, expect, it } from "vitest";
import { api, readJson, seedBase, write, writeJson } from "./helpers";

let seed: Awaited<ReturnType<typeof seedBase>>;

beforeAll(async () => {
  seed = await seedBase();
});

describe("POST /api/cms/categories", () => {
  it("creates a category and defaults sortOrder", async () => {
    const response = await writeJson("/api/cms/categories", "POST", {
      slug: "pertanian",
      name: "Pertanian",
    });
    const body = await readJson<Record<string, any>>(response);

    expect(response.status).toBe(201);
    expect(body).toMatchObject({ slug: "pertanian", name: "Pertanian", sortOrder: 0 });
  });

  it("rejects a duplicate slug with 409", async () => {
    await writeJson("/api/cms/categories", "POST", { slug: "ganda", name: "Ganda" });

    const response = await writeJson("/api/cms/categories", "POST", {
      slug: "ganda",
      name: "Ganda Lain",
    });

    expect(response.status).toBe(409);
  });
});

describe("PATCH /api/cms/categories/:id", () => {
  it("updates the category", async () => {
    const created = await readJson<Record<string, any>>(
      await writeJson("/api/cms/categories", "POST", { slug: "umkm", name: "UMKM" }),
    );

    const response = await writeJson(`/api/cms/categories/${created.id}`, "PATCH", {
      name: "Usaha Mikro",
      sortOrder: 5,
    });
    const body = await readJson<Record<string, any>>(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ id: created.id, slug: "umkm", name: "Usaha Mikro", sortOrder: 5 });
  });

  it("rejects an empty body and unknown ids", async () => {
    const empty = await writeJson(`/api/cms/categories/${seed.nature.id}`, "PATCH", {});

    expect(empty.status).toBe(400);
    expect(await readJson<Record<string, unknown>>(empty)).toMatchObject({
      message: "No fields to update",
    });
    expect((await writeJson("/api/cms/categories/9999", "PATCH", { name: "X" })).status).toBe(404);
  });
});

describe("DELETE /api/cms/categories/:id", () => {
  it("deletes the category and then reports it as missing", async () => {
    const created = await readJson<Record<string, any>>(
      await writeJson("/api/cms/categories", "POST", { slug: "sementara", name: "Sementara" }),
    );

    const deleted = await write(`/api/cms/categories/${created.id}`, { method: "DELETE" });

    expect(deleted.status).toBe(204);
    expect((await api(`/api/cms/categories/${created.id}`)).status).toBe(404);
  });
});

describe("tag routes", () => {
  it("creates, updates and deletes a tag", async () => {
    const created = await readJson<Record<string, any>>(
      await writeJson("/api/cms/tags", "POST", { slug: "edukasi", name: "Edukasi" }),
    );

    expect(created).toMatchObject({ slug: "edukasi", name: "Edukasi" });

    const updated = await readJson<Record<string, any>>(
      await writeJson(`/api/cms/tags/${created.id}`, "PATCH", { name: "Edukasi Warga" }),
    );

    expect(updated.name).toBe("Edukasi Warga");

    const deleted = await write(`/api/cms/tags/${created.id}`, { method: "DELETE" });

    expect(deleted.status).toBe(204);
    expect((await api(`/api/cms/tags/${created.id}`)).status).toBe(404);
  });
});

describe("GET /api/cms/users", () => {
  it("lists users without password hashes", async () => {
    const body = await readJson<{ data: Array<Record<string, unknown>> }>(
      await api("/api/cms/users"),
    );

    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      id: seed.admin.id,
      email: "admin@karangpakuan.test",
      role: "admin",
    });
    expect(body.data[0]).not.toHaveProperty("passwordHash");
  });
});

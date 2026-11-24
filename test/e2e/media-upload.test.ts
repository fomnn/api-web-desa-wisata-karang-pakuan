import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import { API_ORIGIN, api, readJson, seedBase, write } from "./helpers";

// PNG signature is enough for the route; it only inspects the declared MIME type.
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

let seed: Awaited<ReturnType<typeof seedBase>>;

beforeAll(async () => {
  seed = await seedBase();
});

function uploadForm(fields: Record<string, string> = {}, file?: File): FormData {
  const form = new FormData();

  if (file !== undefined) form.set("file", file);
  form.set("uploadedBy", String(seed.admin.id));

  for (const [name, value] of Object.entries(fields)) form.set(name, value);

  return form;
}

function pngFile(): File {
  return new File([PNG_BYTES], "curug.png", { type: "image/png" });
}

describe("POST /api/cms/media", () => {
  it("stores the file in R2 and records it in D1", async () => {
    const response = await write("/api/cms/media", {
      method: "POST",
      body: uploadForm({ alt: "Curug Cimuncang" }, pngFile()),
    });
    const body = await readJson<Record<string, any>>(response);

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      filename: "curug.png",
      mimeType: "image/png",
      kind: "image",
      sizeBytes: PNG_BYTES.length,
      uploadedBy: seed.admin.id,
      alt: "Curug Cimuncang",
    });
    expect(body.key).toMatch(/^media\/[0-9a-f-]{36}\.png$/);
    expect(body.url).toBe(`${API_ORIGIN}/${body.key}`);

    const stored = await env.STORAGE.get(body.key);

    expect(stored).not.toBeNull();
    expect(stored!.httpMetadata?.contentType).toBe("image/png");
  });

  it("rejects a non-multipart body with 415", async () => {
    const response = await write("/api/cms/media", {
      method: "POST",
      body: "{}",
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(415);
    expect(await readJson<Record<string, unknown>>(response)).toMatchObject({
      message: "Expected a multipart/form-data body",
    });
  });

  it("requires a file", async () => {
    const response = await write("/api/cms/media", { method: "POST", body: uploadForm() });

    expect(response.status).toBe(400);
    expect(await readJson<Record<string, unknown>>(response)).toMatchObject({
      message: "file is required",
    });
  });

  it("rejects unsupported file types with 415", async () => {
    const response = await write("/api/cms/media", {
      method: "POST",
      body: uploadForm({}, new File(["catatan"], "catatan.txt", { type: "text/plain" })),
    });

    expect(response.status).toBe(415);
  });

  it("rejects durationSeconds on images", async () => {
    const response = await write("/api/cms/media", {
      method: "POST",
      body: uploadForm({ durationSeconds: "12" }, pngFile()),
    });

    expect(response.status).toBe(400);
    expect(await readJson<Record<string, unknown>>(response)).toMatchObject({
      message: "durationSeconds is only valid for video uploads",
    });
  });

  it("rolls back the R2 object when the uploader does not exist", async () => {
    const before = (await env.STORAGE.list({ prefix: "media/" })).objects.length;
    const form = uploadForm({ uploadedBy: "9999" }, pngFile());

    const response = await write("/api/cms/media", { method: "POST", body: form });
    const after = (await env.STORAGE.list({ prefix: "media/" })).objects.length;

    expect(response.status).toBe(422);
    expect(after).toBe(before);
  });
});

describe("GET /media/**", () => {
  let path: string;

  beforeAll(async () => {
    const response = await write("/api/cms/media", {
      method: "POST",
      body: uploadForm({}, pngFile()),
    });
    const body = await readJson<{ key: string }>(response);

    path = `/${body.key}`;
  });

  it("streams the stored object with its HTTP metadata", async () => {
    const response = await api(path);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(PNG_BYTES);
  });

  it("answers a Range request with 206 and Content-Range", async () => {
    const response = await api(path, { headers: { range: "bytes=0-3" } });

    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe(`bytes 0-3/${PNG_BYTES.length}`);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(PNG_BYTES.slice(0, 4));
  });

  it("answers 304 when If-None-Match matches the object etag", async () => {
    const etag = (await api(path)).headers.get("etag");

    expect(etag).toEqual(expect.any(String));

    const response = await api(path, { headers: { "if-none-match": etag! } });

    expect(response.status).toBe(304);
    expect(await response.text()).toBe("");
  });

  it("returns 404 for a key that was never uploaded", async () => {
    const response = await api("/media/00000000-0000-4000-8000-000000000000.png");

    expect(response.status).toBe(404);
  });

  it("returns 404 for keys outside the upload format", async () => {
    expect((await api("/media/cover.jpg")).status).toBe(404);
    expect((await api("/media/seed/cover.jpg")).status).toBe(404);
  });
});

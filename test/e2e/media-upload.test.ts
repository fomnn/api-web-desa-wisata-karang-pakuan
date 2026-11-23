import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import { readJson, seedBase, write } from "./helpers";

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

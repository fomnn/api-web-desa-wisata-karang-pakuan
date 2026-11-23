import { describe, expect, it } from "vitest";
import { api, readJson } from "./helpers";

describe("OpenAPI", () => {
  it("serves the generated spec at runtime", async () => {
    const response = await api("/_openapi.json");
    const spec = await readJson<Record<string, any>>(response);
    const paths = Object.keys(spec.paths ?? {});

    expect(response.status).toBe(200);
    expect(spec.info.title).toBe("Web Desa Wisata Karang Pakuan API");
    expect(paths.some((path) => path.startsWith("/api/posts"))).toBe(true);
    expect(paths.some((path) => path.startsWith("/api/cms/posts"))).toBe(true);
  });

  it("renders the Scalar reference page", async () => {
    const response = await api("/_scalar");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
  });
});

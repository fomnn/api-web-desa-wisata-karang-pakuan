import { defineConfig } from "nitro";

export default defineConfig({
  serverDir: "./src",
  preset: "cloudflare-module",
  experimental: {
    openAPI: true,
  },
  openAPI: {
    meta: {
      title: "Web Desa Wisata Karang Pakuan API",
      description: "REST API for the Karang Pakuan village tourism website and CMS.",
      version: "1.0.0",
    },
    production: "runtime",
  },
});

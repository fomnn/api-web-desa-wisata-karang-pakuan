import { defineConfig } from "nitro";
import errorHandler from "./src/error";
import { fileURLToPath } from "node:url";

export default defineConfig({
  serverDir: "./src",
  preset: "cloudflare-module",
  errorHandler: "./src/error.ts",
  devErrorHandler: errorHandler,
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
  alias: { "@src": fileURLToPath(new URL("./src", import.meta.url)) },
});

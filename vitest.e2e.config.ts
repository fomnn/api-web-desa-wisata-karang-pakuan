import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));
const main = "./.output/server/index.mjs";

if (!existsSync(new URL(main, import.meta.url))) {
  throw new Error(
    "Missing .output/server/index.mjs. Run `pnpm test:e2e` (builds first) or `pnpm build`.",
  );
}

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      // The Worker under test is Nitro's cloudflare-module build output.
      main,
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          // The shipped var is empty; tests need a concrete allowed origin.
          CORS_ORIGINS: "https://desa.example",
          TEST_MIGRATIONS: await readD1Migrations({
            projectPath: root,
            migrationsDir: "src/db/migrations",
            // Drizzle keeps one folder per migration: <timestamp>_<name>/migration.sql
            migrationsPattern: "src/db/migrations/*/migration.sql",
          }),
        },
      },
    })),
  ],
  resolve: {
    alias: { "@src": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["test/e2e/**/*.test.ts"],
    setupFiles: ["./test/e2e/apply-migrations.ts"],
  },
});

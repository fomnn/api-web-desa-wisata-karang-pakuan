import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

const localD1File = process.env.LOCAL_D1_FILE;

if (!localD1File) {
  throw new Error(
    "LOCAL_D1_FILE is not set. Run `pnpm env:local-d1` to populate it from .wrangler. " +
      'If the local D1 database does not exist yet, create it with: pnpm exec wrangler d1 execute DB --local --command "SELECT 1"',
  );
}

if (!existsSync(localD1File)) {
  throw new Error(
    `Local D1 database not found at ${localD1File}. Run \`pnpm env:local-d1\` to refresh .env.`,
  );
}

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dbCredentials: {
    url: localD1File,
  },
});

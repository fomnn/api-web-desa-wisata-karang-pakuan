import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ENV_KEY = "LOCAL_D1_FILE";
const ENV_FILE = resolve(".env");
const D1_DIR = resolve(".wrangler/state/v3/d1");
const IGNORED_FILES = new Set(["metadata.sqlite"]);

function findLocalD1File() {
  if (!existsSync(D1_DIR)) return undefined;

  const candidates = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(path);
      } else if (entry.name.endsWith(".sqlite") && !IGNORED_FILES.has(entry.name)) {
        candidates.push({ path, modifiedAt: statSync(path).mtimeMs });
      }
    }
  };
  walk(D1_DIR);

  candidates.sort((a, b) => b.modifiedAt - a.modifiedAt);
  return candidates[0]?.path;
}

function upsertEnvValue(key, value) {
  const existing = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
  const lines = existing.split(/\r?\n/);
  const nextLine = `${key}=${value}`;
  const index = lines.findIndex((line) => line.startsWith(`${key}=`));

  if (index !== -1) {
    if (lines[index] === nextLine) return false;
    lines[index] = nextLine;
  } else {
    while (lines.at(-1) === "") lines.pop();
    lines.push(nextLine, "");
  }

  writeFileSync(ENV_FILE, lines.join("\n"));
  return true;
}

const localD1File = findLocalD1File();

if (!localD1File) {
  console.warn(
    `[local-d1] No local D1 database found in .wrangler/state/v3/d1. ` +
      `Run "pnpm exec wrangler d1 execute DB --local --command \\"SELECT 1\\"" once, then re-run this script.`,
  );
  process.exit(0);
}

if (upsertEnvValue(ENV_KEY, localD1File)) {
  console.log(`[local-d1] Updated .env: ${ENV_KEY}=${localD1File}`);
} else {
  console.log(`[local-d1] .env already up to date: ${ENV_KEY}=${localD1File}`);
}

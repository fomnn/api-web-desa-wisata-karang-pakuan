# AGENTS.md

Cloudflare Workers REST API for the Karang Pakuan village tourism site and CMS: Nitro v3 (H3 v2), Drizzle ORM 1.0 RC on D1, Valibot validation, OpenAPI generated at runtime.

Nitro v3 differs a lot from v2 and your knowledge is likely outdated: read https://nitro.build/llms.txt, especially `docs/utils.md` (imports) and `docs/migration.md`.

## Commands

- `pnpm dev` — `nitro dev` on `:3000` in `cloudflare-dev` (workerd) emulation. This is the only working way to exercise DB routes, because code imports `cloudflare:workers`.
- `pnpm lint` / `pnpm lint:fix` — oxlint (correctness = error, suspicious = warn, type-aware).
- `pnpm format` / `pnpm format:check` — oxfmt, printWidth 100. Ignores `.agents/**`, `worker-configuration.d.ts`, `**/snapshot.json`.
- `npx tsc --noEmit` — typecheck (no package script exists).
- `pnpm build` — `nitro build`, bundling to `.output/` for the `cloudflare-module` preset; `pnpm preview` serves that build via `wrangler dev`. There is no `node .output/...` entrypoint and no test suite, so verify with `pnpm dev` + curl.
- Deploy after build with `npx nitro deploy --prebuilt` or `npx wrangler --cwd .output deploy` (no deploy script).
- `pnpm cf-typegen` — regenerate `worker-configuration.d.ts` after changing bindings in `wrangler.jsonc`; never hand-edit that file.

## Database

- Local D1 lives under `.wrangler/state/v3/d1`. `pnpm env:local-d1` (also run by `postinstall`) picks the newest sqlite file and writes `LOCAL_D1_FILE` into `.env`; don't edit that value by hand. If no DB exists yet, create one first: `pnpm exec wrangler d1 execute DB --local --command "SELECT 1"`.
- `pnpm db:generate` writes a timestamped folder plus `snapshot.json` into `src/db/migrations` (leave snapshots alone), then `pnpm db:migrate:local` applies them to the local sqlite via `drizzle.local.config.ts`. `pnpm db:migrate` targets remote D1 and needs `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_DATABASE_ID`, `CLOUDFLARE_D1_TOKEN` exported.
- `pnpm db:seed:local` deletes all rows and reseeds through `getPlatformProxy`; local only.
- Drizzle is 1.0 RC, not 0.3x: schema uses `defineRelations(schema, r => ...)`, and routes use relational queries with object filters — `db.query.posts.findFirst({ where: { id }, with: { author: { columns: { passwordHash: false } } } })`. Stable-Drizzle `relations()` and callback `where` don't work.
- Timestamps are `integer(..., { mode: "timestamp" })` (unix seconds): code sees `Date`, JSON returns ISO strings.

## Layout and conventions

- `src/` is `serverDir`; paths map to URLs (`src/api/cms/posts/[id].get.ts` → `GET /api/cms/posts/:id`). Static files stay in `public/`.
- CMS routes for posts, events, products, categories and tags live under `/api/cms`; read-only public routes live under `/api`. Images are uploaded with `POST /api/cms/media` (multipart, stored in the `STORAGE` R2 bucket). `sessions`, `albumMedia` and `contact_messages` exist in the schema but have no endpoints.
- No auth exists: every CMS route is public and there is no current-user context, even though `posts.authorId` is required.
- Validators live in `src/validators/*.ts` with shared rules in `common.ts`. Use `readValidatedBody` / `getValidatedQuery` from `nitro/h3`; query values arrive as strings, so numerics use `v.pipe(v.string(), v.toNumber(), ...)` (see `paginationEntries`).
- Throw `HTTPError` through the helpers in `src/utils/http.ts` (`getIdParam`, `notFound`, `badRequest`). Wrap writes in `writeOrThrow`: D1 errors are untyped, and it maps `UNIQUE constraint failed` → 409 and `FOREIGN KEY constraint failed` → 422. Don't duplicate that handling.
- List endpoints return `{ data, pagination }` via `pagination()`, newest first, default pageSize 50 (max 100). Create sets `event.res.status = 201`; delete returns `noContent()`; document the expected 400/404/409/422 responses.
- Every route exports a default `defineHandler` and calls `defineRouteMeta` with complete inline OpenAPI. Per-resource `$global.components.schemas` are declared in that resource's `index.get.ts`; add new component schemas there rather than in a central file.
- Spec is served at `/_openapi.json`, Scalar UI at `/_scalar` (`openAPI.production: "runtime"`).
- No auto-imports: import from `"nitro"`, `"nitro/h3"` and relative paths only.

## Gotchas

- `npx nitro fetch <path>` works only against an already-running `pnpm dev` server. On its own it runs sources through env-runner and dies on `cloudflare:workers` (`ERR_UNSUPPORTED_ESM_URL_SCHEME`); `npx nitro serve` fails the same way.
- `wrangler.jsonc` is parsed as strict JSON by Nitro: no trailing commas (oxfmt enforces this for `*.jsonc`).
- `.agents/skills/` is vendored Cloudflare/Drizzle skill content tracked by `skills-lock.json`; don't hand-edit it.

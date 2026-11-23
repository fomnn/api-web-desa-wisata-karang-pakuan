# AGENTS.md

Cloudflare Workers REST API for the Karang Pakuan village tourism site and CMS: Nitro v3 (H3 v2), Drizzle ORM 1.0 RC on D1, Valibot validation, OpenAPI generated at runtime.

Nitro v3 differs a lot from v2 and your knowledge is likely outdated: read https://nitro.build/llms.txt, especially `docs/utils.md` (imports) and `docs/migration.md`.

## Commands

- `pnpm dev` — `nitro dev` on `:3000` with workerd/miniflare (the `cloudflare-dev` preset). Use this to exercise DB routes; code imports `cloudflare:workers`, which standalone Nitro commands cannot run.
- `pnpm lint` / `pnpm lint:fix` — oxlint (correctness = error, suspicious = warn, type-aware).
- `pnpm format` / `pnpm format:check` — oxfmt, printWidth 100. Ignores `.agents/**`, `.output/**`, `worker-configuration.d.ts`, `**/snapshot.json`.
- `npx tsc --noEmit` — typecheck (no package script exists).
- No test suite. `pnpm build` emits `.output/`; `pnpm preview` serves that build via `wrangler dev`. Deploy with `npx nitro deploy --prebuilt` or `npx wrangler --cwd .output deploy`.
- `pnpm cf-typegen` — regenerate `worker-configuration.d.ts` after changing bindings or vars in `wrangler.jsonc`; never hand-edit that file.

## Database

- Local D1 lives under `.wrangler/state/v3/d1`. `pnpm env:local-d1` (also run by `postinstall`) writes the newest sqlite path to `LOCAL_D1_FILE` in `.env`; don't edit that value by hand. If no DB exists yet: `pnpm exec wrangler d1 execute DB --local --command "SELECT 1"`.
- Schema change: edit `src/db/schema.ts` → `pnpm db:generate` → `pnpm db:migrate:local`. `db:generate` writes a timestamped folder plus `snapshot.json` into `src/db/migrations` (leave snapshots alone). `pnpm db:migrate` targets remote D1 and needs `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_DATABASE_ID`, `CLOUDFLARE_D1_TOKEN`. `db:push:local` applies schema directly, without migration history.
- `pnpm db:seed:local` deletes every row and reseeds through `getPlatformProxy`; local only.
- Drizzle is 1.0 RC, not 0.3x: schema uses `defineRelations(schema, r => ...)`, and routes use relational queries with object filters — `db.query.posts.findFirst({ where: { id }, with: { author: { columns: { passwordHash: false } } } })`. Stable-Drizzle `relations()` and callback `where` don't work.
- Timestamps are `integer(..., { mode: "timestamp" })` (unix seconds): code sees `Date`, JSON returns ISO strings.

## Layout and conventions

- `src/` is `serverDir`; paths map to URLs (`src/api/cms/posts/[id].get.ts` → `GET /api/cms/posts/:id`). Static files stay in `public/`.
- API surface: full CRUD under `/api/cms/{posts,events,products,categories,tags}`, plus `GET /api/cms/users` and `POST /api/cms/media`. Public read-only: `/api/posts` and `/api/posts/:slug`, `/api/events`, `/api/products`, `/api/categories`, `/api/albums`. No endpoints exist for album CRUD, `albumMedia`, `sessions`, or `contactMessages`.
- No auth exists: every CMS route is public and there is no current-user context, even though `posts.authorId` is required.
- Middleware runs in filename order (`0.request-id`, `1.cors`, `2.security-headers`, `3.rate-limit`); `src/plugins/observability.ts` hooks responses to re-apply headers and log requests/errors. All writes under `/api/` are limited to 60/min per client IP via the D1 `rate_limits` table and can return 429 + `x-ratelimit-*`; `pnpm db:seed:local` clears it. Public reads use `cachedJson()` for ETag/304.
- CORS: `CORS_ORIGINS` (comma-separated, `*` allowed) comes from `wrangler.jsonc`; dev additionally allows localhost ports 3000/4173/5173. Add deployed frontend origins there.
- Validators live in `src/validators/*.ts` with shared rules in `common.ts`. Use `readValidatedBody` / `getValidatedQuery` from `nitro/h3`; query values arrive as strings, so numerics use `v.pipe(v.string(), v.toNumber(), ...)` (see `paginationEntries`).
- Throw `HTTPError` through the helpers in `src/utils/http.ts` (`getIdParam`, `getSlugParam`, `notFound`, `badRequest`, `tooManyRequests`). Wrap writes in `writeOrThrow`: D1 errors are untyped, and it maps `UNIQUE constraint failed` → 409 and `FOREIGN KEY constraint failed` → 422. `src/error.ts` formats errors as `{ error, status, statusText, message, data? }` and hides unhandled 500 details.
- List endpoints return `{ data, pagination }` via `pagination()`, newest first, default pageSize 50 (max 100). Creates set `event.res.status = 201`; deletes return `noContent()`; document expected 400/404/409/422/429, plus 304 for cached public reads.
- Every route exports a default `defineHandler` and calls `defineRouteMeta` with complete inline OpenAPI. Component schemas are declared in that resource's `index.get.ts` under `$global`; add new schemas there rather than in a central file. Spec is served at `/_openapi.json`, Scalar at `/_scalar` (`openAPI.production: "runtime"`).
- No auto-imports: import from `"nitro"`, `"nitro/h3"`, and otherwise use `@src/<path>` for anything crossing directories (maps to `src/`, defined in `nitro.config.ts` + `tsconfig.json`) or `./` for siblings. `@src` only resolves inside the Nitro bundle, so `.dev-scripts/` and `nitro.config.ts` keep relative paths.
- `POST /api/cms/media` accepts multipart `file` + `uploadedBy`, allows images (10 MB) and videos (50 MB), stores objects as `media/<uuid>.<ext>` in R2 (`STORAGE`), and deletes the object if the D1 insert fails. No route serves R2 objects; clients only receive the `key`.

## Gotchas

- `npx nitro fetch <path>` uses a running `pnpm dev` server by default. With `--no-dev` (or `nitro serve`/`start`), sources run through env-runner and crash on `cloudflare:workers` (`ERR_UNSUPPORTED_ESM_URL_SCHEME`).
- `wrangler.jsonc` is parsed as strict JSON by Nitro: no trailing commas (oxfmt enforces this for `*.jsonc`).
- `.agents/skills/` is vendored Cloudflare/Drizzle skill content tracked by `skills-lock.json`; don't hand-edit it.
- Use `log()` from `src/utils/logger.ts` for structured JSON logs; the observability hook includes the request id in request/error logs.

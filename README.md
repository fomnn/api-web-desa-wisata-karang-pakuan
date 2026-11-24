# Web Desa Wisata Karang Pakuan API

REST API for the Karang Pakuan village tourism website and its CMS. Built with
[Nitro v3](https://nitro.build) (H3 v2) and deployed as a Cloudflare Worker, with
[Drizzle ORM](https://orm.drizzle.team) on D1 for storage, [Valibot](https://valibot.dev) for
validation, and an OpenAPI spec generated at runtime.

## Todo

_Nothing yet._

## Needs confirmation

- Auth for admin should be multi admin or just one credential?

## Stack

| Concern    | Choice                                                    |
| ---------- | --------------------------------------------------------- |
| Runtime    | Cloudflare Workers (`cloudflare-module` preset)           |
| Framework  | Nitro v3 / H3 v2, file-based routing                      |
| Database   | Cloudflare D1 + Drizzle ORM 1.0 RC                        |
| Storage    | Cloudflare R2 (`STORAGE` bucket) for media objects        |
| Validation | Valibot schemas per resource                              |
| Docs       | Runtime OpenAPI at `/_openapi.json`, Scalar at `/_scalar` |

## Requirements

- Node.js (LTS) and [pnpm](https://pnpm.io)
- A Cloudflare account (only for deploying and for remote migrations)

## Getting started

```bash
pnpm install
```

`install` runs `postinstall`, which points `LOCAL_D1_FILE` in `.env` at the newest local D1
database. If no local database exists yet, create one:

```bash
pnpm exec wrangler d1 execute DB --local --command "SELECT 1"
pnpm env:local-d1
```

Then apply migrations, optionally seed demo content, and start the dev server:

```bash
pnpm db:migrate:local   # apply src/db/migrations to the local D1
pnpm db:seed:local      # optional: wipe and reseed local data
pnpm dev
```

The API is served on <http://localhost:3000>. Interactive documentation is at
<http://localhost:3000/_scalar> and the raw spec at <http://localhost:3000/_openapi.json>.

`pnpm dev` runs on workerd/miniflare, which matters: code imports `cloudflare:workers`, so routes
that touch the database will not work under `nitro serve` or a `--no-dev` fetch.

## API

All responses are JSON. List endpoints return `{ "data": [...], "pagination": { ... } }` and are
paged with `page` (1-based) and `pageSize` (default 50, max 100).

### Public (read-only)

| Method | Path               | Notes                                                            |
| ------ | ------------------ | ---------------------------------------------------------------- |
| GET    | `/api/posts`       | Published posts only; filters `categoryId`, `tagId`, `q` (title) |
| GET    | `/api/posts/:slug` | Published post with author, category, cover and tags             |
| GET    | `/api/events`      | Upcoming published events                                        |
| GET    | `/api/products`    | Published products                                               |
| GET    | `/api/categories`  | Categories                                                       |
| GET    | `/api/albums`      | Published albums with their media                                |

Public reads send `ETag` and `Cache-Control` headers and answer `304 Not Modified` when the
client's copy is current.

### CMS

Full CRUD for posts, events, products, categories and tags:

| Method             | Path                      |
| ------------------ | ------------------------- |
| GET, POST          | `/api/cms/<resource>`     |
| GET, PATCH, DELETE | `/api/cms/<resource>/:id` |

with `<resource>` being `posts`, `events`, `products`, `categories` or `tags`. Additionally:

- `GET /api/cms/users` — list users
- `POST /api/cms/media` — multipart upload (`file` + `uploadedBy`); images up to 10 MB, videos up
  to 50 MB, stored as `media/<uuid>.<ext>` in R2. The object is deleted again if the D1 insert
  fails. Clients receive the object `key`; no route serves R2 objects.

Example:

```bash
curl "http://localhost:3000/api/posts?page=1&pageSize=10"
curl "http://localhost:3000/api/posts/wisata-alam-karang-pakuan"
```

> **No authentication yet.** Every CMS route is public; there is no current-user context. Do not
> expose the CMS endpoints in production until auth is in place.

## Behavior

- **Errors** use `{ "error": true, "status", "statusText", "message", "data"? }`. Unhandled
  failures return a generic `500` message without internals. Unique violations map to `409` and
  foreign-key violations to `422`.
- **Writes** (`POST`/`PATCH`/`DELETE` under `/api/`) are rate limited to 60 requests per minute per
  client IP through the D1 `rate_limits` table. Exceeding it returns `429` with
  `x-ratelimit-*` headers.
- **CORS** origins come from the `CORS_ORIGINS` var in `wrangler.jsonc` (comma-separated, `*`
  allowed). Dev also allows localhost ports 3000, 4173 and 5173.
- The observability plugin logs requests and errors as structured JSON with a request id.

## Scripts

| Script                         | Purpose                                               |
| ------------------------------ | ----------------------------------------------------- |
| `pnpm dev`                     | Dev server on port 3000 with workerd/miniflare        |
| `pnpm build`                   | Build the Worker into `.output/`                      |
| `pnpm preview`                 | Serve the build locally via wrangler                  |
| `pnpm lint` / `lint:fix`       | oxlint (type-aware)                                   |
| `pnpm format` / `format:check` | oxfmt formatting                                      |
| `npx tsc --noEmit`             | Typecheck                                             |
| `pnpm cf-typegen`              | Regenerate `worker-configuration.d.ts` from bindings  |
| `pnpm db:generate`             | Generate a migration from `src/db/schema.ts`          |
| `pnpm db:migrate`              | Apply migrations to remote D1                         |
| `pnpm db:migrate:local`        | Apply migrations to local D1                          |
| `pnpm db:push:local`           | Push the schema to local D1 without migration history |
| `pnpm db:seed:local`           | Wipe and reseed local D1                              |
| `pnpm db:studio`               | Open Drizzle Studio                                   |

## Project layout

```
src/
  api/            route files; paths map to URLs (GET /api/posts => api/posts/index.get.ts)
  db/             schema, Drizzle client, migrations
  middleware/     request id, CORS, security headers, rate limiting
  plugins/        observability hooks
  utils/          http helpers, caching, logging, rate limiting
  validators/     Valibot schemas
  error.ts        JSON error handler
public/           static files served as-is
.dev-scripts/     local D1 env sync and seeding
```

## Database changes

1. Edit `src/db/schema.ts`.
2. `pnpm db:generate` to write a new timestamped migration (leave `snapshot.json` files alone).
3. `pnpm db:migrate:local` to apply it locally.

Remote migrations require all three of `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_DATABASE_ID`, and
`CLOUDFLARE_D1_TOKEN`. In CI, the database ID is read from `wrangler.jsonc` and the D1 token is the
staging `CLOUDFLARE_API_TOKEN` secret. Timestamps are stored as unix seconds and exposed as
timestamp columns and ISO strings in JSON.

## Deployment

The Worker has a top-level configuration for local development plus a persistent staging
environment:

| Environment | Worker                                      | D1                                      | R2                                              |
| ----------- | ------------------------------------------- | --------------------------------------- | ----------------------------------------------- |
| top-level   | `api-web-desa-wisata-karang-pakuan`         | `dev-web-desa-wisata-karang-pakuan`     | `dev-web-desa-wisata-karang-pakuan-storage`     |
| staging     | `api-web-desa-wisata-karang-pakuan-staging` | `web-desa-wisata-karang-pakuan-staging` | `web-desa-wisata-karang-pakuan-staging-storage` |

The top-level bindings are only for local development and e2e. Production is intentionally not
deployed yet: it waits for CMS auth.

### Variables and secrets

The following table covers the variables used by the Worker, local tooling, and CI.

| Name                     | Where it is set                                                     | Required               | Purpose                                                |
| ------------------------ | ------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------ |
| `CORS_ORIGINS`           | `wrangler.jsonc` → `vars`, separately per environment               | Conditional[^cors]     | Allowed browser origins; empty means no CORS headers   |
| `LOCAL_D1_FILE`          | `.env`, written by `pnpm env:local-d1`                              | No (auto-generated)    | Path to the local D1 file used by Drizzle              |
| `CLOUDFLARE_ACCOUNT_ID`  | GitHub repository variable; also exported for manual migrations     | Yes for deploy/migrate | Cloudflare account for Wrangler and Drizzle            |
| `CLOUDFLARE_API_TOKEN`   | GitHub Environment `staging` secret                                 | Yes for deploy         | Wrangler deploy, and D1 migrations through the mapping |
| `CLOUDFLARE_DATABASE_ID` | Shell for manual migrations; CI reads it from `wrangler.jsonc`      | Yes for remote migrate | Target D1 database for Drizzle                         |
| `CLOUDFLARE_D1_TOKEN`    | Shell for manual migrations; CI maps it from `CLOUDFLARE_API_TOKEN` | Yes for remote migrate | Drizzle authentication against the D1 HTTP API         |
| `STAGING_API_URL`        | GitHub repository variable                                          | No                     | Enables the post-deploy smoke test                     |

[^cors]:
    Required when a browser frontend calls the API from another origin. It can stay empty
    while no staging frontend exists.

`DB` and `STORAGE` are Worker bindings, not environment variables. They are declared per
environment in `wrangler.jsonc`.

### GitHub Actions configuration

These are the only entries stored on GitHub:

| Name                    | Type                | Scope                          | Required | Used by                                          |
| ----------------------- | ------------------- | ------------------------------ | -------- | ------------------------------------------------ |
| `CLOUDFLARE_ACCOUNT_ID` | Repository variable | Repository                     | Yes      | Wrangler deploy and Drizzle migrations           |
| `CLOUDFLARE_API_TOKEN`  | Environment secret  | `staging` (later `production`) | Yes      | Wrangler deploy; mapped to `CLOUDFLARE_D1_TOKEN` |
| `STAGING_API_URL`       | Repository variable | Repository                     | No       | Post-deploy smoke test                           |

Create the token from the **Edit Cloudflare Workers** template, then add **Account → D1 → Edit**
so the migration step can run. Keep it as an environment secret, never a repository variable or a
committed file.

`CLOUDFLARE_DATABASE_ID` and `CLOUDFLARE_D1_TOKEN` are not stored in GitHub: the workflow reads the
database ID from `wrangler.jsonc` and passes the environment's `CLOUDFLARE_API_TOKEN` as the
Drizzle token.

Using the GitHub CLI:

```bash
gh variable set CLOUDFLARE_ACCOUNT_ID --body "<account-id>"
gh variable set STAGING_API_URL --body "https://<worker>.workers.dev" # optional
gh secret set CLOUDFLARE_API_TOKEN --env staging --body "<api-token>"
```

### Staging

Pushes to `dev` run `.github/workflows/deploy-staging.yml`: install, lint, format check,
typecheck, unit tests, e2e (which builds), apply pending D1 migrations, deploy, then optionally
smoke test. Pull requests run the same checks through `.github/workflows/ci.yml`.

The workflow reads the staging database ID from `wrangler.jsonc`, so keep that file strict JSON
(no comments, no trailing commas).

Manual deploy and migration:

```bash
pnpm build
pnpm exec wrangler deploy -c .output/server/wrangler.json --env staging

CLOUDFLARE_ACCOUNT_ID=... \
CLOUDFLARE_DATABASE_ID=<staging database id> \
CLOUDFLARE_D1_TOKEN=... \
pnpm db:migrate
```

`CORS_ORIGINS` in `env.staging` is empty until a staging frontend exists; while empty, browsers on
other origins receive no CORS headers.

### Production activation checklist

Production is intentionally disabled. When CMS auth is ready:

1. Create `web-desa-wisata-karang-pakuan-production` (D1) and
   `web-desa-wisata-karang-pakuan-production-storage` (R2).
2. Add `env.production` to `wrangler.jsonc` with the Worker name
   `api-web-desa-wisata-karang-pakuan-production`, its own bindings, and `CORS_ORIGINS`.
3. Create the `production` GitHub Environment with required reviewers and its own
   `CLOUDFLARE_API_TOKEN`.
4. Copy `deploy-staging.yml` to `deploy-production.yml`, trigger it from `main`, and use
   `--env production`.
5. Run the staging flow against the release commit first, then approve production.

## Notes for contributors

`AGENTS.md` documents the conventions this codebase follows in more detail: no auto-imports, use
`@src/` for cross-directory imports, `defineHandler` + inline `defineRouteMeta` per route, and
shared validation rules in `src/validators/common.ts`. Read it before adding endpoints.

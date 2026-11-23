# Web Desa Wisata Karang Pakuan API

REST API for the Karang Pakuan village tourism website and its CMS. Built with
[Nitro v3](https://nitro.build) (H3 v2) and deployed as a Cloudflare Worker, with
[Drizzle ORM](https://orm.drizzle.team) on D1 for storage, [Valibot](https://valibot.dev) for
validation, and an OpenAPI spec generated at runtime.

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

Remote migrations need `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_DATABASE_ID` and
`CLOUDFLARE_D1_TOKEN` in the environment. Timestamps are stored as unix seconds and exposed as
timestamp columns and ISO strings in JSON.

## Deployment

```bash
pnpm build
npx nitro deploy --prebuilt
# or: npx wrangler --cwd .output deploy
```

Set `CORS_ORIGINS` in `wrangler.jsonc` to the deployed frontend origins before shipping, and run
`pnpm db:migrate` against the production database.

## Todo

_Nothing yet._

## Needs confirmation

_Nothing yet._

## Notes for contributors

`AGENTS.md` documents the conventions this codebase follows in more detail: no auto-imports, use
`@src/` for cross-directory imports, `defineHandler` + inline `defineRouteMeta` per route, and
shared validation rules in `src/validators/common.ts`. Read it before adding endpoints.

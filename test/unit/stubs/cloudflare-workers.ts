/**
 * Stand-in for the `cloudflare:workers` module in the Node unit test environment.
 * Tests may mutate `env` to simulate bindings; `src/utils/cors.ts` reads
 * `CORS_ORIGINS` on every call, so changes take effect immediately.
 */
export const env: Record<string, unknown> = { CORS_ORIGINS: "" };

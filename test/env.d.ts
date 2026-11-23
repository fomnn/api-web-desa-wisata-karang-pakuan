import type { D1Migration } from "@cloudflare/vitest-plugin";

// Keep `wrangler types` output (worker-configuration.d.ts) as the source of truth for
// D1/R2 bindings, and add only the test-only binding here.
declare global {
  namespace Cloudflare {
    interface Env {
      TEST_MIGRATIONS: D1Migration[];
    }

    interface GlobalProps {
      // Nitro's build output, so `exports.default.fetch()` is typed in e2e tests.
      mainModule: { default: ExportedHandler };
    }
  }
}

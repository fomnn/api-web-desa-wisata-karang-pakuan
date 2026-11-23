import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@src": fileURLToPath(new URL("./src", import.meta.url)),
      // Workerd-only module; the stub lets Node unit tests import `src/utils/cors.ts`
      // and `src/utils/rate-limit.ts` without a Workers runtime.
      "cloudflare:workers": fileURLToPath(
        new URL("./test/unit/stubs/cloudflare-workers.ts", import.meta.url),
      ),
    },
  },
  test: {
    include: ["test/unit/**/*.test.ts"],
  },
});

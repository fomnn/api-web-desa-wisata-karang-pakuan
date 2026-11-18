import { defineConfig } from "oxfmt";

export default defineConfig({
  printWidth: 100,
  ignorePatterns: [
    ".output/**",
    "dist/**",
    ".wrangler/**",
    ".agents/**",
    "worker-configuration.d.ts",
    "**/snapshot.json",
  ],

  overrides: [
    {
      // Nitro parses wrangler.jsonc as strict JSON, so trailing commas break builds.
      files: ["*.jsonc"],
      options: { trailingComma: "none" },
    },
  ],
});

import { defineConfig } from "oxlint";

export default defineConfig({
  categories: {
    correctness: "error",
    suspicious: "warn",
  },
  ignorePatterns: [".output/**", "dist/**"],
  options: { typeAware: true, typeCheck: true },
});

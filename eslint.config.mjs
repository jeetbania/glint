import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // electron-builder's local packaging output — not source.
    "release/**",
  ]),
  // The Electron main/preload scripts are plain Node CommonJS by
  // convention (Electron's main process defaults to it, and mixing in
  // ESM there mostly just adds __dirname/import.meta friction for no
  // benefit in two small files) — require() here is idiomatic, not a
  // leftover to migrate away from.
  {
    files: ["electron/**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);

export default eslintConfig;

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "dist/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "artifacts/**",
    "agent-workflow/**",
    "graphify-out/**",
    "**/graphify-out/**",
    "assets/**",
    "next-env.d.ts",
  ]),
]);

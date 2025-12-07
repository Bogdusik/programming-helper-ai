import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "coverage/**",
      "*.config.js",
      "*.config.mjs",
      "scripts/**",
      "__tests__/**",
    ],
  },
  {
    rules: {
      // Prevent console.* in production code - use logger instead
      // Allow in logger files, test files and scripts
      "no-console": "error",
      // Enforce consistent imports
      "no-unused-vars": "off", // TypeScript handles this
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
  // Allow console in logger files (they are meant to use console)
  {
    files: ["lib/logger.ts", "lib/client-logger.ts"],
    rules: {
      "no-console": "off",
    },
  },
];

export default eslintConfig;

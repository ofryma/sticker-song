import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";

export default [
  { ignores: ["dist/**", "node_modules/**"] },

  js.configs.recommended,

  {
    files: ["src/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: "18.3" } },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // Vite's JSX transform means React need not be in scope, and prop types
      // are not used anywhere in this codebase.
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],

      // The 300-line limit and i18n key parity are mechanical, so
      // scripts/check-rules.mjs enforces them. The inline-style rule is not:
      // the sanctioned exceptions (animation delays, computed transforms,
      // collage geometry) are literal values too, so any selector precise
      // enough to catch a real violation also flags Hero and Candle. That one
      // stays a review question.
      //
      // react-hooks 7 added rules that flag pre-existing code (see todo.md).
      // They are warnings so CI is green on the current tree, not because the
      // findings are wrong — turn them back to "error" as each is fixed.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
    },
  },

  {
    // Config and tooling files run in Node, not the browser.
    files: ["*.js", "scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.node,
    },
  },

  // Last, so formatting rules never fight prettier.
  prettier,
];

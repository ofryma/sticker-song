#!/usr/bin/env node
/**
 * Enforces the two frontend rules a linter cannot see.
 *
 *   1. No file under frontend/ exceeds 300 lines (.claude/rules/frontend.md).
 *   2. he.js and en.js define exactly the same keys, so neither language falls
 *      back to a missing string in front of a visitor.
 *
 * Run with `npm run check:rules`. Exits non-zero with a report on any breach.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const FRONTEND = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MAX_LINES = 300;
const SKIP_DIRS = new Set(["node_modules", "dist", "public", ".git"]);
const SKIP_FILES = new Set(["package-lock.json"]);
const EXTENSIONS = [".js", ".jsx", ".mjs", ".css", ".json", ".html"];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    if (SKIP_DIRS.has(name) || SKIP_FILES.has(name)) return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return EXTENSIONS.some((ext) => name.endsWith(ext)) ? [path] : [];
  });
}

function checkLineCounts() {
  const oversized = walk(FRONTEND)
    .map((path) => ({
      path: relative(FRONTEND, path),
      lines: readFileSync(path, "utf8").split("\n").length,
    }))
    .filter((file) => file.lines > MAX_LINES)
    .sort((a, b) => b.lines - a.lines);

  if (oversized.length === 0) return [];
  return [
    `${oversized.length} file(s) over the ${MAX_LINES}-line limit — extract a component, hook or module:`,
    ...oversized.map((file) => `  ${file.path} (${file.lines} lines)`),
  ];
}

function flatten(value, prefix = "") {
  return Object.entries(value).flatMap(([key, child]) =>
    child && typeof child === "object" && !Array.isArray(child)
      ? flatten(child, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

async function checkTranslations() {
  const load = async (lang) =>
    (await import(new URL(`../src/i18n/${lang}.js`, import.meta.url))).default;
  const [he, en] = [new Set(flatten(await load("he"))), new Set(flatten(await load("en")))];

  const missingInEn = [...he].filter((key) => !en.has(key)).sort();
  const missingInHe = [...en].filter((key) => !he.has(key)).sort();
  if (missingInEn.length === 0 && missingInHe.length === 0) return [];

  return [
    "i18n dictionaries are out of sync:",
    ...missingInEn.map((key) => `  missing from en.js: ${key}`),
    ...missingInHe.map((key) => `  missing from he.js: ${key}`),
  ];
}

const problems = [...checkLineCounts(), ...(await checkTranslations())];

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`ok — every file is within ${MAX_LINES} lines and he/en keys match`);

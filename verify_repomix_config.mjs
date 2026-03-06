#!/usr/bin/env node
/**
 * Repomix config verification script (TDD Lite).
 * Asserts repomix.config.json exists, is valid JSON, and contains
 * required ignore patterns and top-priority file/dir entries.
 * Uses only Node.js built-in fs — no extra npm packages.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = __dirname;
const configPath = path.join(projectRoot, "repomix.config.json");
const results = [];

function pass(label, detail = "") {
  results.push({ ok: true, label, detail });
  console.log(`  ✓ PASS: ${label}${detail ? ` (${detail})` : ""}`);
}

function fail(label, detail = "") {
  results.push({ ok: false, label, detail });
  console.log(`  ✗ FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
}

console.log("\n[1] repomix.config.json existence and validity");

if (!fs.existsSync(configPath)) {
  fail("Config file exists", "repomix.config.json not found in project root");
  console.log("\n--- Summary ---\nPassed: 0, Failed: " + results.length + "\n");
  process.exit(1);
}
pass("Config file exists", "repomix.config.json in root");

let config;
try {
  const raw = fs.readFileSync(configPath, "utf8");
  config = JSON.parse(raw);
} catch (e) {
  fail("Valid JSON", e.message || "Parse error");
  console.log("\n--- Summary ---\nPassed: " + results.filter((r) => r.ok).length + ", Failed: " + results.filter((r) => !r.ok).length + "\n");
  process.exit(1);
}
pass("Valid JSON", "parsed successfully");

console.log("\n[2] ignore.customPatterns (or equivalent)");

const ignorePatterns = config.ignore?.customPatterns ?? config.ignore ?? [];
const patterns = Array.isArray(ignorePatterns) ? ignorePatterns : [];

const requiredIgnore = [
  { pattern: ".next/", name: ".next/" },
  { pattern: "node_modules/", name: "node_modules/" },
  { pattern: "package-lock.json", name: "package-lock.json" },
  { pattern: "yarn.lock", name: "yarn.lock" },
  { pattern: "pnpm-lock.yaml", name: "pnpm-lock.yaml" },
];

function patternMatches(patterns, target) {
  const t = target.replace(/\*\*\/?/g, "").replace(/\/$/, "");
  return patterns.some((p) => {
    const s = String(p).replace(/\*\*\/?/g, "").replace(/\/$/, "");
    return s === t || s.includes(t) || t.includes(s) || p === target || p.includes(target);
  });
}

for (const { pattern, name } of requiredIgnore) {
  if (patternMatches(patterns, pattern)) {
    pass("Ignore pattern: " + name, "present");
  } else {
    fail("Ignore pattern: " + name, "missing from ignore.customPatterns");
  }
}

console.log("\n[3] output.topFiles (or equivalent) includes .ai-status.md and docs/");

const topFiles = config.output?.topFiles ?? config.topFiles ?? [];
const topList = Array.isArray(topFiles) ? topFiles : [];

const hasAiStatus = topList.some((f) => String(f).includes(".ai-status.md") || String(f) === ".ai-status.md");
const hasDocs = topList.some((f) => String(f).includes("docs") || String(f) === "docs" || String(f) === "docs/");

if (hasAiStatus) {
  pass("Top files include .ai-status.md", "present");
} else {
  fail("Top files include .ai-status.md", "missing from output.topFiles (or equivalent)");
}
if (hasDocs) {
  pass("Top files include docs/", "present");
} else {
  fail("Top files include docs/", "missing from output.topFiles (or equivalent)");
}

const failed = results.filter((r) => !r.ok);
const passed = results.filter((r) => r.ok);
console.log("\n--- Summary ---");
console.log("Passed: " + passed.length + ", Failed: " + failed.length);
if (failed.length > 0) {
  console.log("\nFailed assertions:");
  failed.forEach((r) => console.log("  - " + r.label + (r.detail ? ": " + r.detail : "")));
  process.exit(1);
}
console.log("All Repomix config checks passed.\n");
process.exit(0);

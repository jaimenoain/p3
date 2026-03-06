#!/usr/bin/env node
/**
 * Design system verification script (TDD Lite).
 * Asserts Tailwind/Shadcn design tokens and required base components.
 * Uses only Node.js built-in fs — no extra npm packages.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = __dirname;

const results = [];

function pass(label, detail = "") {
  results.push({ ok: true, label, detail });
  console.log(`  ✓ PASS: ${label}${detail ? ` (${detail})` : ""}`);
}

function fail(label, detail = "") {
  results.push({ ok: false, label, detail });
  console.log(`  ✗ FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
}

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
}

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

// --- Resolve paths ---
const tailwindTs = path.join(projectRoot, "tailwind.config.ts");
const tailwindJs = path.join(projectRoot, "tailwind.config.js");
const globalsCssPaths = [
  path.join(projectRoot, "app", "globals.css"),
  path.join(projectRoot, "styles", "globals.css"),
];
const componentsDir = path.join(projectRoot, "components", "ui");
const requiredComponents = ["button.tsx", "input.tsx", "card.tsx"];

// --- 1. Tailwind config (optional: v4 uses CSS-only; if config file present, check tokens) ---
console.log("\n[1] Tailwind config");
let tailwindContent = readFileSafe(tailwindTs) ?? readFileSafe(tailwindJs);
if (tailwindContent) {
  if (/\bslate-50\b|\bzinc-50\b/.test(tailwindContent)) {
    pass("Background token (slate-50 or zinc-50) in Tailwind config");
  } else {
    fail("Background token (slate-50 or zinc-50) in Tailwind config", "not found");
  }
  if (/\bwhite\b/.test(tailwindContent)) {
    pass("Elevated background (white) in Tailwind config");
  } else {
    fail("Elevated background (white) in Tailwind config", "not found");
  }
  if (/\bslate-200\b/.test(tailwindContent)) {
    pass("Border token (slate-200) in Tailwind config");
  } else {
    fail("Border token (slate-200) in Tailwind config", "not found");
  }
  if (/\bslate-900\b/.test(tailwindContent)) {
    pass("Primary action (slate-900) in Tailwind config");
  } else {
    fail("Primary action (slate-900) in Tailwind config", "not found");
  }
  if (/\btabular-nums\b|tabularNums|"tabular-nums"/.test(tailwindContent)) {
    pass("Typography: tabular-nums in Tailwind config");
  } else {
    fail("Typography: tabular-nums in Tailwind config", "not found");
  }
  if (/\bInter\b|\bGeist\b|geist/i.test(tailwindContent)) {
    pass("Typography: Inter or Geist in Tailwind config");
  } else {
    fail("Typography: Inter or Geist in Tailwind config", "not found");
  }
} else {
  // Tailwind v4: no config file; design tokens live in global CSS (checked in [2])
  pass("Tailwind config", "Tailwind v4 CSS-only; tokens in global CSS");
}

// --- 2. Global CSS (required; check tokens) ---
console.log("\n[2] Global CSS (design tokens)");
const globalsPath = globalsCssPaths.find(fileExists);
const cssContent = globalsPath ? readFileSafe(globalsPath) : null;

if (!cssContent) {
  fail("Global CSS file", "app/globals.css and styles/globals.css not found");
} else {
  if (/\bslate-50\b|\bzinc-50\b/.test(cssContent)) {
    pass("Background token (slate-50 or zinc-50) in global CSS");
  } else {
    fail("Background token (slate-50 or zinc-50) in global CSS", "not found");
  }
  if (/\bwhite\b/.test(cssContent)) {
    pass("Elevated background (white) in global CSS");
  } else {
    fail("Elevated background (white) in global CSS", "not found");
  }
  if (/\bslate-200\b/.test(cssContent)) {
    pass("Border token (slate-200) in global CSS");
  } else {
    fail("Border token (slate-200) in global CSS", "not found");
  }
  if (/\bslate-900\b/.test(cssContent)) {
    pass("Primary action (slate-900) in global CSS");
  } else {
    fail("Primary action (slate-900) in global CSS", "not found");
  }
  if (/\btabular-nums\b/.test(cssContent)) {
    pass("Typography: tabular-nums in global CSS");
  } else {
    fail("Typography: tabular-nums in global CSS", "not found");
  }
  if (/\bInter\b|\bGeist\b|geist/i.test(cssContent)) {
    pass("Typography: Inter or Geist in global CSS");
  } else {
    fail("Typography: Inter or Geist in global CSS", "not found");
  }
}

// --- 3. Required base components ---
console.log("\n[3] Required base components (components/ui/)");
for (const name of requiredComponents) {
  const filePath = path.join(componentsDir, name);
  if (fileExists(filePath)) {
    pass(`Component exists: ${name}`);
  } else {
    fail(`Component exists: ${name}`, `expected: ${filePath}`);
  }
}

// --- Summary ---
const failed = results.filter((r) => !r.ok);
const passed = results.filter((r) => r.ok);
console.log("\n--- Summary ---");
console.log(`Passed: ${passed.length}, Failed: ${failed.length}`);
if (failed.length > 0) {
  console.log("\nFailed assertions:");
  failed.forEach((r) => console.log(`  - ${r.label}${r.detail ? `: ${r.detail}` : ""}`));
  process.exit(1);
}
console.log("All design system checks passed.\n");
process.exit(0);

#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname);
const errors = [];

function assert(condition, message) {
  if (!condition) errors.push(message);
}

// 1. package.json exists and contains required dependencies
const pkgPath = path.join(ROOT, "package.json");
assert(fs.existsSync(pkgPath), "package.json does not exist");

if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const required = ["next", "react", "typescript", "eslint", "prettier"];
  for (const dep of required) {
    assert(deps[dep], `package.json missing dependency or devDependency: ${dep}`);
  }
}

// 2. app/ directory (Next.js App Router) exists
assert(
  fs.existsSync(path.join(ROOT, "app")) && fs.statSync(path.join(ROOT, "app")).isDirectory(),
  "app/ directory does not exist"
);

// 3. docs/ directory exists
assert(
  fs.existsSync(path.join(ROOT, "docs")) && fs.statSync(path.join(ROOT, "docs")).isDirectory(),
  "docs/ directory does not exist"
);

// 4. .ai-status.md exists
assert(fs.existsSync(path.join(ROOT, ".ai-status.md")), ".ai-status.md does not exist");

if (errors.length > 0) {
  console.error("Verification failed:\n");
  errors.forEach((e) => console.error("  -", e));
  process.exit(1);
}

console.log("verify_scaffold: all assertions passed.");
process.exit(0);

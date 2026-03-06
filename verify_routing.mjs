#!/usr/bin/env node
/**
 * Routing verification script (TDD Lite).
 * Asserts Next.js App Router structure: (auth), (dashboard), (guest) route groups,
 * required page.tsx files, and that each page exports a component containing <h1>.
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

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
}

function dirExists(filePath) {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}

const appBase = dirExists(path.join(projectRoot, "src", "app"))
  ? path.join(projectRoot, "src", "app")
  : path.join(projectRoot, "app");

const routeGroups = [
  {
    name: "(auth)",
    layout: true,
    pages: [
      { segment: "login", title: "Login" },
      { segment: "signup", title: "Signup" },
    ],
  },
  {
    name: "(dashboard)",
    layout: true,
    pages: [
      { segment: "dashboard", title: "Dashboard" },
      { segment: "assets", title: "Assets" },
      { segment: "airlock", title: "Airlock" },
      { segment: "vault", title: "Vault" },
      { segment: "governance", title: "Governance" },
      { segment: "settings", title: "Settings" },
    ],
  },
  {
    name: "(guest)",
    layout: true,
    pages: [{ segment: "guest/view", title: "Guest View" }],
  },
];

console.log("\n[1] App directory and route groups");
if (!dirExists(appBase)) {
  fail("App directory", `${appBase} not found`);
} else {
  pass("App directory", appBase.replace(projectRoot, "").replace(/^\//, "") || "app");
}

for (const group of routeGroups) {
  const groupPath = path.join(appBase, group.name);
  if (!dirExists(groupPath)) {
    fail(`Route group ${group.name}`, `directory not found`);
  } else {
    pass(`Route group ${group.name}`, "exists");
  }

  if (group.layout) {
    const layoutPath = path.join(groupPath, "layout.tsx");
    if (!fileExists(layoutPath)) {
      fail(`Layout for ${group.name}`, "layout.tsx not found");
    } else {
      const content = readFileSafe(layoutPath);
      if (content && /children/.test(content)) {
        pass(`Layout ${group.name}/layout.tsx`, "exists and uses children");
      } else {
        fail(`Layout ${group.name}/layout.tsx`, "must render {children}");
      }
    }
  }

  for (const page of group.pages) {
    const pagePath = path.join(groupPath, page.segment, "page.tsx");
    if (!fileExists(pagePath)) {
      fail(`Page ${group.name}/${page.segment}/page.tsx`, "not found");
    } else {
      pass(`Page ${group.name}/${page.segment}/page.tsx`, "exists");
      const content = readFileSafe(pagePath);
      const hasDefaultExport = content && /export\s+default\s+function|export\s+default\s+\w+|export\s+{\s*\w+\s+as\s+default\s*}/.test(content);
      const hasH1 = content && /<h1[\s>]/.test(content);
      if (!hasDefaultExport) {
        fail(`Page ${page.segment} default export`, "page must export default component");
      } else {
        pass(`Page ${page.segment} default export`, "present");
      }
      if (!hasH1) {
        fail(`Page ${page.segment} <h1>`, "page must contain an <h1> tag");
      } else {
        pass(`Page ${page.segment} <h1>`, "present");
      }
    }
  }
}

const failed = results.filter((r) => !r.ok);
const passed = results.filter((r) => r.ok);
console.log("\n--- Summary ---");
console.log(`Passed: ${passed.length}, Failed: ${failed.length}`);
if (failed.length > 0) {
  console.log("\nFailed assertions:");
  failed.forEach((r) => console.log(`  - ${r.label}${r.detail ? `: ${r.detail}` : ""}`));
  process.exit(1);
}
console.log("All routing checks passed.\n");
process.exit(0);

#!/usr/bin/env node
/**
 * Task 1.1 — Layout shell & navigation verification (TDD Lite).
 * Asserts (auth) layout has centered flex, (dashboard) layout has Sidebar with
 * Links to dashboard routes and a Logout placeholder. Uses app/ or src/app/.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

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

const appBase = fileExists(path.join(projectRoot, "src", "app", "layout.tsx"))
  ? path.join(projectRoot, "src", "app")
  : path.join(projectRoot, "app");

const authLayoutPath = path.join(appBase, "(auth)", "layout.tsx");
const dashboardLayoutPath = path.join(appBase, "(dashboard)", "layout.tsx");

const requiredDashboardLinks = [
  "/dashboard",
  "/assets",
  "/airlock",
  "/vault",
  "/governance",
  "/settings",
];

console.log("\n[1] Auth layout — (auth)/layout.tsx");

const authContent = readFileSafe(authLayoutPath);
if (!authContent) {
  fail("Auth layout exists", `not found at ${authLayoutPath}`);
} else {
  pass("Auth layout exists", "file found");
  if (/export\s+default\s+function/.test(authContent)) {
    pass("Auth layout default export", "present");
  } else {
    fail("Auth layout default export", "must export default function");
  }
  if (/items-center/.test(authContent)) {
    pass("Auth layout: items-center", "present");
  } else {
    fail("Auth layout: items-center", "centered flex utility required");
  }
  if (/justify-center/.test(authContent)) {
    pass("Auth layout: justify-center", "present");
  } else {
    fail("Auth layout: justify-center", "centered flex utility required");
  }
  if (/h-screen/.test(authContent)) {
    pass("Auth layout: h-screen", "present");
  } else {
    fail("Auth layout: h-screen", "full-height utility required");
  }
  if (/children/.test(authContent)) {
    pass("Auth layout renders children", "present");
  } else {
    fail("Auth layout renders children", "must render children prop");
  }
}

console.log("\n[2] Dashboard layout — (dashboard)/layout.tsx");

const dashboardContent = readFileSafe(dashboardLayoutPath);
if (!dashboardContent) {
  fail("Dashboard layout exists", `not found at ${dashboardLayoutPath}`);
} else {
  pass("Dashboard layout exists", "file found");
  if (/export\s+default\s+function/.test(dashboardContent)) {
    pass("Dashboard layout default export", "present");
  } else {
    fail("Dashboard layout default export", "must export default function");
  }
  const hasSidebar =
    /Sidebar|sidebar|<\s*nav|sidebar/i.test(dashboardContent) ||
    (fileExists(path.join(projectRoot, "components", "ui", "sidebar.tsx")) &&
      /sidebar|Sidebar/.test(dashboardContent));
  if (hasSidebar) {
    pass("Dashboard layout includes Sidebar", "structural sidebar present");
  } else {
    fail(
      "Dashboard layout includes Sidebar",
      "must include Sidebar (native or imported component)"
    );
  }
  const sidebarPath = path.join(projectRoot, "components", "ui", "sidebar.tsx");
  const sidebarContent = readFileSafe(sidebarPath);
  for (const href of requiredDashboardLinks) {
    const linkRegex = new RegExp(
      `<Link[^>]*href\\s*=\\s*["'\`]${href.replace("/", "\\/")}["'\`]|href\\s*=\\s*["'\`]${href.replace("/", "\\/")}["'\`]`
    );
    const hasPathLiteral = (content) =>
      content && (content.includes(`"${href}"`) || content.includes(`'${href}'`));
    const hasLinkInFile = (content) =>
      content && (linkRegex.test(content) || (content.includes("<Link") && hasPathLiteral(content)));
    if (hasLinkInFile(dashboardContent)) {
      pass(`Sidebar Link: ${href}`, "present");
    } else if (hasLinkInFile(sidebarContent)) {
      pass(`Sidebar Link: ${href}`, "present (in sidebar component)");
    } else {
      fail(`Sidebar Link: ${href}`, "missing");
    }
  }
  const hasLogout =
    /logout|Logout|log out|Log out/i.test(dashboardContent);
  const contentForLogout = sidebarContent || dashboardContent;
  if (hasLogout || (contentForLogout && /logout|Logout|log out|Log out/i.test(contentForLogout))) {
    pass("Sidebar contains Logout placeholder", "present");
  } else {
    fail("Sidebar contains Logout placeholder", "string/button required");
  }
  if (/children/.test(dashboardContent)) {
    pass("Dashboard layout renders children", "present");
  } else {
    fail("Dashboard layout renders children", "must render children prop");
  }
}

const failed = results.filter((r) => !r.ok);
const passed = results.filter((r) => r.ok);
console.log("\n--- Summary ---");
console.log(`Passed: ${passed.length}, Failed: ${failed.length}`);
if (failed.length > 0) {
  console.log("\nFailed assertions:");
  failed.forEach((r) =>
    console.log(`  - ${r.label}${r.detail ? `: ${r.detail}` : ""}`)
  );
  process.exit(1);
}
console.log("All Task 1.1 layout & navigation checks passed.\n");
process.exit(0);

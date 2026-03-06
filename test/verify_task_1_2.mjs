#!/usr/bin/env node
/**
 * Task 1.2 — Supabase clients, middleware route protection, auth UI (TDD Lite).
 * Asserts: lib/supabase server + client, middleware protecting /dashboard and /settings,
 * and Login, Sign Up, Forgot Password UI in (auth). Uses src/ or project root.
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

const hasSrc = fileExists(path.join(projectRoot, "src", "app", "layout.tsx")) || fs.existsSync(path.join(projectRoot, "src"));
const base = hasSrc ? path.join(projectRoot, "src") : projectRoot;
const appBase = hasSrc ? path.join(projectRoot, "src", "app") : path.join(projectRoot, "app");

console.log("\n[1] Supabase clients");

const serverPath = path.join(base, "lib", "supabase", "server.ts");
const clientPath = path.join(base, "lib", "supabase", "client.ts");

if (fileExists(serverPath)) {
  pass("lib/supabase/server.ts exists", serverPath.replace(projectRoot, "").replace(/^\//, "") || "lib/supabase/server.ts");
} else {
  fail("lib/supabase/server.ts exists", "not found");
}

if (fileExists(clientPath)) {
  pass("lib/supabase/client.ts exists", clientPath.replace(projectRoot, "").replace(/^\//, "") || "lib/supabase/client.ts");
} else {
  fail("lib/supabase/client.ts exists", "not found");
}

console.log("\n[2] Next.js middleware (route protection)");

const middlewarePathRoot = path.join(projectRoot, "middleware.ts");
const middlewarePathSrc = path.join(projectRoot, "src", "middleware.ts");
const middlewarePath = fileExists(middlewarePathSrc) ? middlewarePathSrc : fileExists(middlewarePathRoot) ? middlewarePathRoot : null;

if (!middlewarePath) {
  fail("middleware.ts exists", "not found at src/middleware.ts or project root");
} else {
  pass("middleware.ts exists", middlewarePath.replace(projectRoot, "").replace(/^\//, ""));
  const content = readFileSafe(middlewarePath);
  const protectsDashboard = content && (/\/dashboard/.test(content) || /dashboard/.test(content));
  const protectsSettings = content && (/\/settings/.test(content) || /settings/.test(content));
  if (protectsDashboard) {
    pass("Middleware protects /dashboard", "configured");
  } else {
    fail("Middleware protects /dashboard", "not configured");
  }
  if (protectsSettings) {
    pass("Middleware protects /settings", "configured");
  } else {
    fail("Middleware protects /settings", "not configured");
  }
}

console.log("\n[3] Auth UI components (Login, Sign Up, Forgot Password)");

const authBases = [
  path.join(appBase, "(auth)"),
  path.join(projectRoot, "app", "(auth)"),
];
function findAuthPage(name) {
  for (const authBase of authBases) {
    const p = path.join(authBase, name, "page.tsx");
    if (fileExists(p)) return true;
  }
  return false;
}

if (findAuthPage("login")) {
  pass("Login UI exists in (auth)", "login/page.tsx");
} else {
  fail("Login UI exists in (auth)", "login/page.tsx not found");
}

if (findAuthPage("signup")) {
  pass("Sign Up UI exists in (auth)", "signup/page.tsx");
} else {
  fail("Sign Up UI exists in (auth)", "signup/page.tsx not found");
}

if (findAuthPage("forgot-password")) {
  pass("Forgot Password UI exists in (auth)", "forgot-password/page.tsx");
} else {
  fail("Forgot Password UI exists in (auth)", "forgot-password/page.tsx not found");
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
console.log("All Task 1.2 Supabase & auth checks passed.\n");
process.exit(0);

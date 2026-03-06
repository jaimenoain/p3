#!/usr/bin/env node
/**
 * Task 1.99 — Phase 1 documentation verification.
 * Positive: .ai-status.md contains Phase 1 completion marker and populated CURRENT_ARCHITECTURE_SNAPSHOT.
 * Negative: ARCHITECTURE.md has NOT lost future phase sections (e.g. Phase 2).
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

const aiStatusPath = path.join(projectRoot, ".ai-status.md");
const architecturePath = path.join(projectRoot, "docs", "ARCHITECTURE.md");

console.log("\n[1] .ai-status.md — Phase 1 completion marker");

const aiStatus = fs.existsSync(aiStatusPath)
  ? fs.readFileSync(aiStatusPath, "utf8")
  : "";

if (!aiStatus) {
  fail(".ai-status.md exists and readable", "file missing or empty");
} else {
  pass(".ai-status.md exists and readable", "file found");
  const hasPhase1Complete =
    /Phase\s+1\s*:\s*COMPLETE/i.test(aiStatus) ||
    /Phase\s+1\s+complete/i.test(aiStatus) ||
    /Phase\s+1\s*—\s*COMPLETE/i.test(aiStatus);
  if (hasPhase1Complete) {
    pass(".ai-status.md contains Phase 1 completion marker", "Phase 1: COMPLETE or equivalent");
  } else {
    fail(
      ".ai-status.md contains Phase 1 completion marker",
      "must contain 'Phase 1: COMPLETE' or equivalent"
    );
  }

  const snapshotMatch = aiStatus.match(
    /##\s*CURRENT_ARCHITECTURE_SNAPSHOT\s*([\s\S]*?)(?=##\s|$)/i
  );
  const snapshotContent = snapshotMatch ? snapshotMatch[1].trim() : "";
  const snapshotPopulated =
    snapshotContent.length > 80 &&
    (snapshotContent.includes("app/") ||
      snapshotContent.includes("dashboard") ||
      snapshotContent.includes("auth") ||
      snapshotContent.includes("route"));
  if (snapshotMatch && snapshotPopulated) {
    pass(
      ".ai-status.md has populated CURRENT_ARCHITECTURE_SNAPSHOT",
      "section present with substantive content"
    );
  } else if (!snapshotMatch) {
    fail(
      ".ai-status.md has populated CURRENT_ARCHITECTURE_SNAPSHOT",
      "section CURRENT_ARCHITECTURE_SNAPSHOT not found"
    );
  } else {
    fail(
      ".ai-status.md has populated CURRENT_ARCHITECTURE_SNAPSHOT",
      "section exists but content too short or not descriptive"
    );
  }
}

console.log("\n[2] docs/ARCHITECTURE.md — Future phases preserved");

const architecture = fs.existsSync(architecturePath)
  ? fs.readFileSync(architecturePath, "utf8")
  : "";

if (!architecture) {
  fail("ARCHITECTURE.md exists and readable", "file missing or empty");
} else {
  pass("ARCHITECTURE.md exists and readable", "file found");
  const hasFuturePhases =
    /Phase\s+2/i.test(architecture) || /future\s+phase/i.test(architecture);
  if (hasFuturePhases) {
    pass(
      "ARCHITECTURE.md has NOT lost future phase sections",
      "Phase 2 or future phases referenced"
    );
  } else {
    fail(
      "ARCHITECTURE.md has NOT lost future phase sections",
      "must retain sections detailing Phase 2 or future phases"
    );
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
console.log("All Phase 1 documentation checks passed.\n");
process.exit(0);

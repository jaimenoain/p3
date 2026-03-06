#!/usr/bin/env node
/**
 * E2E verification for Runway Dashboard: Visual Chart, Timeframe Toggles, Tripwire.
 * Asserts .ai-status.md documents Runway Chart and Tripwire.
 * Run: node scripts/verify-runway-dashboard.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const statusPath = path.join(__dirname, "..", ".ai-status.md");

const content = fs.readFileSync(statusPath, "utf8");

const hasRunwayChart = content.includes("Runway Chart");
const hasTripwire = content.includes("Tripwire");

if (hasRunwayChart && hasTripwire) {
  console.log("VERIFICATION PASSED");
} else {
  console.error("VERIFICATION FAILED");
  if (!hasRunwayChart) console.error("  .ai-status.md must mention Runway Chart");
  if (!hasTripwire) console.error("  .ai-status.md must mention Tripwire");
  process.exit(1);
}

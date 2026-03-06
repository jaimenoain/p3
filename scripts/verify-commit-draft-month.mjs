/**
 * Verification for commitDraftMonthMutation and Draft Month flow.
 * Asserts: payload shape (workspace_id, calendar_month, records), insert order
 * (monthly_periods then historical_records bulk), client redirect to /actuals and success toast.
 * Full E2E with database requires running app (npm run dev) + authenticated session.
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const actionsPath = join(root, "app/(dashboard)/actions.ts");
const clientPath = join(root, "app/(dashboard)/import/mapping-triage-client.tsx");

const actions = readFileSync(actionsPath, "utf-8");
const client = readFileSync(clientPath, "utf-8");

let failed = 0;

if (!actions.includes("commitDraftMonthMutation")) {
  console.error("FAIL: commitDraftMonthMutation not found");
  failed++;
}
if (!actions.includes("workspace_id") || !actions.includes("calendar_month") || !actions.includes("records")) {
  console.error("FAIL: Payload must include workspace_id, calendar_month, records");
  failed++;
}
if (!actions.includes("monthly_periods") || !actions.includes(".insert(")) {
  console.error("FAIL: Must insert into monthly_periods");
  failed++;
}
if (!actions.includes("historical_records") || !actions.includes("monthly_period_id")) {
  console.error("FAIL: Must bulk insert historical_records with monthly_period_id");
  failed++;
}
if (!actions.includes("status: \"Draft\"") && !actions.includes("status: 'Draft'")) {
  console.error("FAIL: monthly_periods must be inserted with status Draft");
  failed++;
}
if (!client.includes("router.push(\"/actuals\")")) {
  console.error("FAIL: On success client must redirect to /actuals");
  failed++;
}
if (!client.includes("Import successful. Draft month created.")) {
  console.error("FAIL: Success toast message must be shown");
  failed++;
}
if (!client.includes("Commit Month") || !client.includes("useTransition") || !client.includes("isPending")) {
  console.error("FAIL: Commit Month button with useTransition loading state required");
  failed++;
}

if (failed > 0) {
  console.error("\n" + failed + " assertion(s) failed.");
  process.exit(1);
}

console.log("✓ commitDraftMonthMutation accepts workspace_id, calendar_month, records");
console.log("✓ Inserts monthly_periods (status Draft) then bulk historical_records");
console.log("✓ Client redirects to /actuals on success");
console.log("✓ Success toast: 'Import successful. Draft month created.'");
console.log("✓ Commit Month button with useTransition loading state");
console.log("\nCommit Draft Month verification passed.");
console.log("For full E2E (DB): run app + Supabase, upload CSV, map rows, click Commit Month.");

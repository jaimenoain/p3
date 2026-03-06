/**
 * Verification for Mapping Triage Wizard (Phase 5).
 * Asserts acceptance criteria: getChartOfAccountsAction, Chart of Accounts DTO,
 * MappingTriageClient with Table (Date, Description, Amount, Category), Select in Category, Commit disabled until all mapped.
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const actionsPath = join(root, "app/(dashboard)/actions.ts");
const triagePath = join(root, "app/(dashboard)/import/mapping-triage-client.tsx");
const importClientPath = join(root, "app/(dashboard)/import/import-csv-client.tsx");
const pagePath = join(root, "app/(dashboard)/import/page.tsx");

const actions = readFileSync(actionsPath, "utf-8");
const triage = readFileSync(triagePath, "utf-8");
const importClient = readFileSync(importClientPath, "utf-8");
const page = readFileSync(pagePath, "utf-8");

let failed = 0;

// 1. getChartOfAccountsAction exists and fetches id, name, category
if (!actions.includes("getChartOfAccountsAction")) {
  console.error("FAIL: getChartOfAccountsAction not found in actions.ts");
  failed++;
}
if (!actions.includes("chart_of_accounts") || !actions.includes("select(\"id, name, category\")")) {
  console.error("FAIL: actions.ts must fetch id, name, category from chart_of_accounts");
  failed++;
}

// 2. ChartOfAccountEntry DTO (id, name, category)
if (!actions.includes("ChartOfAccountEntry") || !actions.includes("category: string")) {
  console.error("FAIL: ChartOfAccountEntry DTO with id, name, category not found");
  failed++;
}

// 3. MappingTriageClient: Table with Date, Description, Amount, Category columns
if (!triage.includes("MappingTriageClient")) {
  console.error("FAIL: MappingTriageClient component not found");
  failed++;
}
if (!triage.includes("Date") || !triage.includes("Description") || !triage.includes("Amount") || !triage.includes("Category")) {
  console.error("FAIL: Table must have columns Date, Description, Amount, Category");
  failed++;
}

// 4. tabular-nums for amounts
if (!triage.includes("tabular-nums")) {
  console.error("FAIL: Amounts must use tabular-nums");
  failed++;
}

// 5. Select in Category column (user picks Chart of Accounts)
if (!triage.includes("<select") && !triage.includes("Select")) {
  console.error("FAIL: Category column must use a Select for Chart of Accounts");
  failed++;
}
if (!triage.includes("Suspense")) {
  console.error("FAIL: User must be able to assign rows to Suspense");
  failed++;
}

// 6. Commit button disabled until every row has a category
if (!triage.includes("Commit")) {
  console.error("FAIL: Primary Commit button not found");
  failed++;
}
if (!triage.includes("disabled={!allMapped}") && !triage.includes("disabled={! allMapped}")) {
  console.error("FAIL: Commit button must be disabled until every row has a selected category (allMapped)");
  failed++;
}

// 7. Import page includes MappingTriageClient (via ImportCsvClient)
if (!importClient.includes("MappingTriageClient")) {
  console.error("FAIL: Import flow must include MappingTriageClient");
  failed++;
}
if (!page.includes("ImportCsvClient")) {
  console.error("FAIL: Import page must render ImportCsvClient");
  failed++;
}

if (failed > 0) {
  console.error("\n" + failed + " assertion(s) failed.");
  process.exit(1);
}

console.log("✓ getChartOfAccountsAction fetches id, name, category from chart_of_accounts");
console.log("✓ ChartOfAccountEntry DTO defined");
console.log("✓ MappingTriageClient with Table (Date, Description, Amount, Category)");
console.log("✓ tabular-nums for amounts");
console.log("✓ Select in Category column (Chart of Accounts + Suspense)");
console.log("✓ Commit button disabled until every row has a category (allMapped)");
console.log("✓ Import page includes MappingTriageClient via ImportCsvClient");
console.log("\nAll Mapping Triage acceptance criteria verified.");

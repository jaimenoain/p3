/**
 * Verifies CSV parsing and USD-only validation.
 * Run: npx tsx scripts/verify-csv-parse.ts
 */

import * as fs from "fs";
import * as path from "path";
import { parseAndValidateCsv } from "../lib/csv-parse";

const fixturesDir = path.join(__dirname, "fixtures");
const usdCsv = fs.readFileSync(path.join(fixturesDir, "mock_usd.csv"), "utf-8");
const multiCsv = fs.readFileSync(
  path.join(fixturesDir, "mock_multi_currency.csv"),
  "utf-8"
);

const usdResult = parseAndValidateCsv(usdCsv);
const multiResult = parseAndValidateCsv(multiCsv);

if (!usdResult.ok) {
  throw new Error(`USD CSV should pass validation. Got: ${usdResult.error}`);
}
if (usdResult.rows.length !== 3) {
  throw new Error(`USD CSV should have 3 rows. Got: ${usdResult.rows.length}`);
}
if (usdResult.headers.length < 3) {
  throw new Error(`USD CSV should have at least 3 headers. Got: ${usdResult.headers.join(", ")}`);
}

if (multiResult.ok) {
  throw new Error("Multi-currency CSV should fail validation.");
}
if (!multiResult.error.includes("USD only")) {
  throw new Error(`Multi-currency error should mention USD only. Got: ${multiResult.error}`);
}

console.log("✓ USD CSV: parsed", usdResult.rows.length, "rows, headers:", usdResult.headers.join(", "));
console.log("✓ Multi-currency CSV: rejected with:", multiResult.error);
console.log("All CSV parse checks passed.");

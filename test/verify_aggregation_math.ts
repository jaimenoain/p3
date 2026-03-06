/**
 * Standalone verification of the 30/360 aggregation engine using native Node assert.
 * Mock payloads match the shape consumed by calculateFinancials (BlockDTO.properties).
 * Run: npx tsx test/verify_aggregation_math.ts
 */

import assert from "node:assert";
import { calculateFinancials } from "../lib/financial-engine";

// Mock blocks: Revenue $10k Starting MRR; Personnel $5k salary + 20% burden, startMonth 2026-01
// Engine reads: Revenue → startingMrr (or mrr); Personnel → monthlyGrossSalary, employerBurdenPercent, startMonth, endMonth, headcountCount
const mockBlocks = [
  {
    blockId: "rev-test",
    type: "Revenue" as const,
    isActive: true,
    title: "Revenue",
    properties: {
      startingMrr: 10000,
      arpa: 0,
      monthlyChurnPercent: 0,
      billingFrequency: "Monthly" as const,
    },
  },
  {
    blockId: "per-test",
    type: "Personnel" as const,
    isActive: true,
    title: "Personnel",
    properties: {
      roleName: "Engineer",
      monthlyGrossSalary: 5000,
      employerBurdenPercent: 0.2,
      startMonth: "2026-01",
      headcountCount: 1,
    },
  },
];

const startingCash = 100000;
const timeline = calculateFinancials(startingCash, mockBlocks);

// Expected: MRR = 10k every month; Personnel = 5k * 1 * (1 + 0.2) = 6k; totalCashOut = 6k; netBurn = 10k - 6k = 4k
const expectedMrr = 10000;
const expectedPersonnelOut = 5000 * 1 * (1 + 0.2); // 6000
const expectedNetBurn = expectedMrr - expectedPersonnelOut; // 4000

assert.strictEqual(timeline.length, 12, "Timeline must have 12 months");

for (let i = 0; i < 12; i++) {
  const m = timeline[i];
  assert.strictEqual(m.monthIndex, i + 1, `Month ${i + 1} index`);
  assert.strictEqual(m.mrr, expectedMrr, `Month ${i + 1} MRR`);
  assert.strictEqual(m.totalCashIn, expectedMrr, `Month ${i + 1} totalCashIn`);
  assert.strictEqual(m.personnelOut, expectedPersonnelOut, `Month ${i + 1} personnelOut`);
  assert.strictEqual(m.opexOut, 0, `Month ${i + 1} opexOut`);
  assert.strictEqual(m.totalCashOut, expectedPersonnelOut, `Month ${i + 1} totalCashOut`);
  assert.strictEqual(m.netBurn, expectedNetBurn, `Month ${i + 1} netBurn`);
}

assert.strictEqual(timeline[0].endingCash, startingCash + expectedNetBurn, "Month 1 ending cash");
assert.strictEqual(
  timeline[11].endingCash,
  startingCash + expectedNetBurn * 12,
  "Month 12 ending cash"
);

console.log("VERIFICATION PASSED: aggregation math (Revenue $10k MRR, Personnel $5k + 20% burden)");

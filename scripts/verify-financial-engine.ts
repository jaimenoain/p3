/**
 * Temporary E2E verification for calculateFinancials.
 * Run: npx tsx scripts/verify-financial-engine.ts
 * Expect: VERIFICATION PASSED
 */

import { calculateFinancials } from "../lib/financial-engine";

const startingCash = 100000;
const blocks = [
  {
    blockId: "rev-1",
    type: "Revenue" as const,
    isActive: true,
    title: "Revenue",
    properties: { mrr: 5000 },
  },
  {
    blockId: "per-1",
    type: "Personnel" as const,
    isActive: true,
    title: "Personnel",
    properties: { monthlyGrossSalary: 8000 },
  },
];

const timeline = calculateFinancials(startingCash, blocks);

const month1 = timeline[0];
const month12 = timeline[11];

const assert1 = month1.netBurn === -3000;
const assert2 = month1.endingCash === 97000;
const assert3 = month12.endingCash === 64000;

if (assert1 && assert2 && assert3) {
  console.log("VERIFICATION PASSED");
} else {
  console.error("VERIFICATION FAILED");
  if (!assert1) console.error("  Month 1 Net Burn expected -3000, got", month1.netBurn);
  if (!assert2) console.error("  Month 1 Ending Cash expected 97000, got", month1.endingCash);
  if (!assert3) console.error("  Month 12 Ending Cash expected 64000, got", month12.endingCash);
  process.exit(1);
}

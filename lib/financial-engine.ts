/**
 * Financial engine: synthesizes polymorphic block payloads into a standardized
 * 12-month financial timeline (MRR, cash in/out, net burn, ending cash).
 * Used by getScenarioFinancials server action; pure logic, no I/O.
 */

/** Block shape for engine input; aligns with DOMAIN_MODEL BlockDTO (properties = payload). */
export interface BlockDTO {
  blockId: string;
  type: "Personnel" | "Revenue" | "Marketing" | "OpEx" | "Capital";
  isActive: boolean;
  title: string | null;
  properties: Record<string, unknown>;
}

/** One month in the projected timeline. */
export interface MonthProjection {
  monthIndex: number; // 1..12
  mrr: number;
  totalCashIn: number;
  personnelOut: number;
  opexOut: number;
  totalCashOut: number;
  netBurn: number;
  endingCash: number;
}

/** Full 12-month projection. */
export type FinancialTimeline = MonthProjection[];

const MONTHS = 12;

function getNumber(props: Record<string, unknown>, key: string, fallback = 0): number {
  const v = props[key];
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string") {
    const normalized = v.replace(/\s/g, "").replace(/,/g, "");
    const n = Number(normalized);
    if (!Number.isNaN(n)) return n;
  }
  return fallback;
}

/** Read MRR from a Revenue block payload. Tries canonical keys so revenue is always included in runway. */
function getRevenueMrrFromPayload(p: Record<string, unknown>): number {
  const candidates = ["startingMrr", "mrr", "StartingMrr"];
  for (const key of candidates) {
    const val = p[key];
    if (val === undefined) continue;
    if (typeof val === "number" && !Number.isNaN(val)) return val;
    if (typeof val === "string") {
      const normalized = val.replace(/\s/g, "").replace(/,/g, "");
      const n = Number(normalized);
      if (!Number.isNaN(n)) return n;
    }
  }
  return 0;
}

/** YYYY-MM for projection month (e.g. 2026-01). V1: use base year 2026, month 1..12. */
function projectionMonthToKey(monthIndex: number): string {
  const year = 2026;
  const month = monthIndex;
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Whether a YYYY-MM string is within [start, end] (inclusive). end null = open-ended. */
function isMonthInRange(
  monthKey: string,
  startKey: string,
  endKey: string | null
): boolean {
  if (monthKey < startKey) return false;
  if (endKey === null || endKey === undefined) return true;
  return monthKey <= endKey;
}

/**
 * Pure function: given starting cash and active blocks (BlockDTO[]), returns
 * a 12-month financial timeline. Only active blocks contribute.
 * V1: full months only (no 30/360 fractional first month); standard monthly spreading.
 */
export function calculateFinancials(
  startingCash: number,
  blocks: BlockDTO[]
): FinancialTimeline {
  const active = blocks.filter((b) => b.isActive);
  const timeline: FinancialTimeline = [];

  let runningCash = startingCash;

  for (let m = 1; m <= MONTHS; m++) {
    const monthKey = projectionMonthToKey(m);

    // --- Revenue: MRR (and cash in from recurring billing). All active Revenue blocks contribute.
    let mrr = 0;
    for (const b of active) {
      if (b.type !== "Revenue") continue;
      mrr += getRevenueMrrFromPayload(b.properties);
    }

    // --- Capital: one-time cash in for this month
    let capitalIn = 0;
    for (const b of active) {
      if (b.type !== "Capital") continue;
      const p = b.properties;
      const receivedMonth = (p.monthReceived as string) ?? "";
      if (receivedMonth === monthKey) {
        capitalIn += getNumber(p, "amount", 0);
      }
    }

    const totalCashIn = mrr + capitalIn;

    // --- Personnel: monthly cost (salary * headcount * (1 + burden)), only in [startMonth, endMonth]
    let personnelOut = 0;
    for (const b of active) {
      if (b.type !== "Personnel") continue;
      const p = b.properties;
      const startKey = (p.startMonth as string) ?? "2026-01";
      const endKey = (p.endMonth as string) ?? null;
      if (!isMonthInRange(monthKey, startKey, endKey)) continue;
      const salary = getNumber(p, "monthlyGrossSalary", 0);
      const burden = getNumber(p, "employerBurdenPercent", 0);
      const headcount = Math.max(0, Math.floor(getNumber(p, "headcountCount", 1)));
      personnelOut += salary * headcount * (1 + burden);
    }

    // --- OpEx: fixed (monthly), variable (% of revenue), or one-off (single month)
    let opexOut = 0;
    for (const b of active) {
      if (b.type !== "OpEx") continue;
      const p = b.properties;
      const expenseType = (p.expenseType as string) ?? "fixed";
      if (expenseType === "one-off") {
        const oneOffMonth = (p.month as string) ?? "";
        if (oneOffMonth === monthKey) {
          opexOut += getNumber(p, "amount", 0);
        }
      } else if (expenseType === "variable") {
        const pctRevenue = getNumber(p, "percentageOfRevenue", 0);
        opexOut += mrr * pctRevenue;
      } else {
        // fixed (recurring)
        const monthly = getNumber(p, "monthlyCost", 0);
        const growthRate = getNumber(p, "annualGrowthRatePercent", 0);
        const growthFactor = Math.pow(1 + growthRate, (m - 1) / 12);
        opexOut += monthly * growthFactor;
      }
    }

    // --- Marketing: monthly ad spend
    let marketingOut = 0;
    for (const b of active) {
      if (b.type !== "Marketing") continue;
      marketingOut += getNumber(b.properties, "monthlyAdSpend", 0);
    }

    const totalCashOut = personnelOut + opexOut + marketingOut;
    const netBurn = totalCashIn - totalCashOut;
    runningCash += netBurn;

    timeline.push({
      monthIndex: m,
      mrr,
      totalCashIn,
      personnelOut,
      opexOut,
      totalCashOut,
      netBurn,
      endingCash: runningCash,
    });
  }

  return timeline;
}

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

/** Starting MRR from a Revenue block payload (static; used as MRR(0)). */
function getRevenueStartingMrrFromPayload(p: Record<string, unknown>): number {
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

/** New customers per month (1..12) from Marketing: spend/CAC. No lag here; lag applied when Revenue consumes. */
function getMarketingNewCustomersByMonth(block: BlockDTO): number[] {
  const p = block.properties;
  const spend = getNumber(p, "monthlyAdSpend", 0);
  const cac = getNumber(p, "targetCac", 0);
  const perMonth = cac > 0 ? spend / cac : 0;
  return Array(MONTHS).fill(perMonth);
}

/** New clients per month (1..12) from Personnel sales role: headcount × clients per month, in [startMonth,endMonth]. */
function getPersonnelNewClientsByMonth(block: BlockDTO): number[] {
  const p = block.properties;
  const roleType = (p.roleType as string) ?? "standard";
  if (roleType !== "sales") return Array(MONTHS).fill(0);
  const headcount = Math.max(0, Math.floor(getNumber(p, "headcountCount", 1)));
  const clientsPerMonth = getNumber(p, "salesClientsPerMonth", 0);
  const startKey = (p.startMonth as string) ?? "2026-01";
  const endKey = (p.endMonth as string) ?? null;
  const out: number[] = [];
  for (let m = 1; m <= MONTHS; m++) {
    const monthKey = projectionMonthToKey(m);
    if (!isMonthInRange(monthKey, startKey, endKey)) {
      out.push(0);
      continue;
    }
    out.push(headcount * clientsPerMonth);
  }
  return out;
}

/** Build map blockId -> new customers per month (1..12) for blocks that expose a new-customers output. */
function buildNewCustomersByBlock(
  active: BlockDTO[]
): Map<string, number[]> {
  const map = new Map<string, number[]>();
  for (const b of active) {
    if (b.type === "Marketing") {
      map.set(b.blockId, getMarketingNewCustomersByMonth(b));
    } else if (b.type === "Personnel") {
      map.set(b.blockId, getPersonnelNewClientsByMonth(b));
    }
  }
  return map;
}

/** Resolve new customers for a Revenue block for month index (1-based). Handles Static and Referenced; applies Marketing lag. */
function resolveRevenueNewCustomers(
  monthIndex: number,
  revenueBlock: BlockDTO,
  active: BlockDTO[],
  newCustomersByBlock: Map<string, number[]>
): number {
  const deps = (revenueBlock.properties.dependencies as Record<string, { mode?: string; value?: number; referenceId?: string }>) ?? {};
  const nc = deps.newCustomers;
  if (!nc) return 0;
  if (nc.mode === "Static" && typeof nc.value === "number" && !Number.isNaN(nc.value)) {
    return nc.value;
  }
  if (nc.mode === "Referenced" && nc.referenceId) {
    const refBlock = active.find((b) => b.blockId === nc.referenceId);
    if (!refBlock) return 0;
    const series = newCustomersByBlock.get(refBlock.blockId);
    if (!series) return 0;
    // If source is Marketing, apply its sales cycle lag (value generated in month M appears in Revenue in month M + lag).
    let readMonthIndex = monthIndex;
    if (refBlock.type === "Marketing") {
      const lag = Math.max(0, Math.floor(getNumber(refBlock.properties, "salesCycleLagMonths", 0)));
      readMonthIndex = monthIndex - lag;
    }
    if (readMonthIndex < 1) return 0;
    return series[readMonthIndex - 1] ?? 0;
  }
  return 0;
}

/** Compute MRR for one Revenue block for one month: MRR(m) = MRR(m-1) + newCust*ARPA + growth*MRR(m-1) - churn*MRR(m-1). */
function revenueBlockMrr(
  prevMrr: number,
  newCustomers: number,
  p: Record<string, unknown>
): number {
  const arpa = getNumber(p, "arpa", 0);
  const churn = getNumber(p, "monthlyChurnPercent", 0);
  const growth = getNumber(p, "monthlyMrrGrowthPercent", 0) ?? 0;
  const fromNew = newCustomers * arpa;
  const fromGrowth = prevMrr * growth;
  const fromChurn = prevMrr * churn;
  return prevMrr + fromNew + fromGrowth - fromChurn;
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
  const newCustomersByBlock = buildNewCustomersByBlock(active);
  const revenueMrrPrev = new Map<string, number>();
  for (const b of active) {
    if (b.type === "Revenue") {
      revenueMrrPrev.set(b.blockId, getRevenueStartingMrrFromPayload(b.properties));
    }
  }

  let runningCash = startingCash;

  for (let m = 1; m <= MONTHS; m++) {
    const monthKey = projectionMonthToKey(m);

    // --- Revenue: MRR from each active Revenue block (starting MRR + referenced/static new customers × ARPA − churn + growth).
    let mrr = 0;
    for (const b of active) {
      if (b.type !== "Revenue") continue;
      const prevMrr = revenueMrrPrev.get(b.blockId) ?? 0;
      const newCust = resolveRevenueNewCustomers(m, b, active, newCustomersByBlock);
      const blockMrr = Math.max(0, revenueBlockMrr(prevMrr, newCust, b.properties));
      revenueMrrPrev.set(b.blockId, blockMrr);
      mrr += blockMrr;
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

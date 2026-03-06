import { getScenarioFinancials } from "../actions";
import { RunwayDashboardClient } from "./runway-dashboard-client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { FinancialTimeline } from "@/lib/financial-engine";

type FinancialTableRowKind = "summary" | "lineItem";

type FinancialTableRow = {
  id: string;
  label: string;
  kind: FinancialTableRowKind;
  values: number[];
};

function formatAccounting(value: number): string {
  const abs = Math.abs(value);
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(abs) *>
    (value < 0 ? `(${formatted})` : formatted);
}

function buildFinancialTableRows(timeline: FinancialTimeline): FinancialTableRow[] {
  if (timeline.length === 0) return [];

  const mrrRow: FinancialTableRow = {
    id: "mrr",
    label: "MRR / Recurring Revenue",
    kind: "lineItem",
    values: timeline.map((m) => m.mrr),
  };

  const capitalOtherRow: FinancialTableRow = {
    id: "capital-other-inflows",
    label: "Capital & Other Inflows",
    kind: "lineItem",
    values: timeline.map((m) => m.totalCashIn - m.mrr),
  };

  const cashInflowsSummary: FinancialTableRow = {
    id: "cash-inflows",
    label: "Cash Inflows",
    kind: "summary",
    values: timeline.map((m) => m.totalCashIn),
  };

  const personnelRow: FinancialTableRow = {
    id: "personnel",
    label: "Personnel Costs",
    kind: "lineItem",
    values: timeline.map((m) => m.personnelOut),
  };

  const marketingRow: FinancialTableRow = {
    id: "marketing",
    label: "Marketing & Ads",
    kind: "lineItem",
    values: timeline.map((m) => m.totalCashOut - m.personnelOut - m.opexOut),
  };

  const opexRow: FinancialTableRow = {
    id: "opex",
    label: "General OpEx",
    kind: "lineItem",
    values: timeline.map((m) => m.opexOut),
  };

  const cashOutflowsSummary: FinancialTableRow = {
    id: "cash-outflows",
    label: "Cash Outflows / Gross Burn",
    kind: "summary",
    values: timeline.map((m) => m.totalCashOut),
  };

  const netBurnSummary: FinancialTableRow = {
    id: "net-burn",
    label: "Net Cash Flow / Net Burn",
    kind: "summary",
    values: timeline.map((m) => m.netBurn),
  };

  const endingCashSummary: FinancialTableRow = {
    id: "ending-cash",
    label: "Ending Cash Balance",
    kind: "summary",
    values: timeline.map((m) => m.endingCash),
  };

  return [
    cashInflowsSummary,
    mrrRow,
    capitalOtherRow,
    cashOutflowsSummary,
    personnelRow,
    marketingRow,
    opexRow,
    netBurnSummary,
    endingCashSummary,
  ];
}

function FinancialTable({ timeline }: { timeline: FinancialTimeline }) {
  const numMonths = timeline.length;
  if (numMonths === 0) return null;

  const rows = buildFinancialTableRows(timeline);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="sticky left-0 z-10 w-[180px] bg-background">
            Metric
          </TableHead>
          {timeline.map((m) => (
            <TableHead
              key={m.monthIndex}
              className="text-right tabular-nums"
            >
              M{m.monthIndex}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const isSummary = row.kind === "summary";
          const labelClasses = isSummary
            ? "sticky left-0 z-10 bg-background font-medium"
            : "sticky left-0 z-10 bg-background pl-6 text-muted-foreground";

          return (
            <TableRow key={row.id}>
              <TableCell className={labelClasses}>{row.label}</TableCell>
              {row.values.map((value, index) => {
                const isEndingCashRow = row.id === "ending-cash";
                const isWarning = isEndingCashRow && value < 0;
                return (
                  <TableCell
                    key={`${row.id}-${index}`}
                    className={`text-right tabular-nums${
                      isWarning ? " text-destructive" : ""
                    }`}
                  >
                    {formatAccounting(value)}
                  </TableCell>
                );
              })}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

type TimeframeMonths = 12 | 24 | 36;

async function parseMonthsFromSearchParams(
  searchParams: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>
): Promise<TimeframeMonths> {
  const raw = searchParams ?? {};
  const resolved: Record<string, string | string[] | undefined> =
    "then" in raw && typeof (raw as Promise<unknown>).then === "function"
      ? await (raw as Promise<Record<string, string | string[] | undefined>>)
      : (raw as Record<string, string | string[] | undefined>);
  const m = resolved.months;
  const value = Array.isArray(m) ? m[0] : m;
  if (value === "24") return 24;
  if (value === "36") return 36;
  return 12;
}

export default async function RunwayDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  const months = await parseMonthsFromSearchParams(searchParams ?? {});

  const result = await getScenarioFinancials();

  if (!result.ok) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-primary">Runway Dashboard</h1>
        <p className="text-sm text-muted-foreground">{result.error}</p>
      </div>
    );
  }

  const { name, financialTimeline } = result;

  return (
    <div className="w-full min-w-0 space-y-6">
      <RunwayDashboardClient
        financialTimeline={financialTimeline}
        scenarioName={name}
        months={months}
      />
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">
          {name} — 12‑month projection
        </h2>
        <FinancialTable timeline={financialTimeline} />
      </section>
    </div>
  );
}

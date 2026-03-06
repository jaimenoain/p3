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

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    signDisplay: "auto",
  }).format(value);
}

function FinancialTable({ timeline }: { timeline: FinancialTimeline }) {
  const numMonths = timeline.length;
  if (numMonths === 0) return null;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[140px]">Metric</TableHead>
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
        <TableRow>
          <TableCell className="font-medium">MRR</TableCell>
          {timeline.map((m) => (
            <TableCell key={m.monthIndex} className="text-right tabular-nums">
              {formatCurrency(m.mrr)}
            </TableCell>
          ))}
        </TableRow>
        <TableRow>
          <TableCell className="font-medium">Cash Inflows</TableCell>
          {timeline.map((m) => (
            <TableCell key={m.monthIndex} className="text-right tabular-nums">
              {formatCurrency(m.totalCashIn)}
            </TableCell>
          ))}
        </TableRow>
        <TableRow>
          <TableCell className="font-medium">Personnel</TableCell>
          {timeline.map((m) => (
            <TableCell key={m.monthIndex} className="text-right tabular-nums">
              {formatCurrency(m.personnelOut)}
            </TableCell>
          ))}
        </TableRow>
        <TableRow>
          <TableCell className="font-medium">OpEx</TableCell>
          {timeline.map((m) => (
            <TableCell key={m.monthIndex} className="text-right tabular-nums">
              {formatCurrency(m.opexOut)}
            </TableCell>
          ))}
        </TableRow>
        <TableRow>
          <TableCell className="font-medium">Net Burn</TableCell>
          {timeline.map((m) => (
            <TableCell key={m.monthIndex} className="text-right tabular-nums">
              {formatCurrency(m.netBurn)}
            </TableCell>
          ))}
        </TableRow>
        <TableRow>
          <TableCell className="font-medium">Ending Cash</TableCell>
          {timeline.map((m) => (
            <TableCell key={m.monthIndex} className="text-right tabular-nums">
              {formatCurrency(m.endingCash)}
            </TableCell>
          ))}
        </TableRow>
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

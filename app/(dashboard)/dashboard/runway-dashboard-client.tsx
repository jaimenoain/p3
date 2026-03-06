"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import type { FinancialTimeline } from "@/lib/financial-engine";

const TIMEFRAME_OPTIONS = [12, 24, 36] as const;
type TimeframeMonths = (typeof TIMEFRAME_OPTIONS)[number];

function extendTimeline(
  base: FinancialTimeline,
  targetMonths: TimeframeMonths
): FinancialTimeline {
  if (base.length === 0) return [];
  if (targetMonths <= 12) return base.slice(0, targetMonths);
  const result = [...base];
  const last = base[base.length - 1];
  let runningCash = last.endingCash;
  for (let m = 13; m <= targetMonths; m++) {
    runningCash += last.netBurn;
    result.push({
      monthIndex: m,
      mrr: last.mrr,
      totalCashIn: last.totalCashIn,
      personnelOut: last.personnelOut,
      opexOut: last.opexOut,
      totalCashOut: last.totalCashOut,
      netBurn: last.netBurn,
      endingCash: runningCash,
    });
  }
  return result;
}

/** First month index (1-based) where ending cash <= 0, or null if runway survives. */
function tripwireMonth(timeline: FinancialTimeline): number | null {
  const found = timeline.find((m) => m.endingCash <= 0);
  return found ? found.monthIndex : null;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    signDisplay: "auto",
  }).format(value);
}

export function RunwayDashboardClient({
  financialTimeline,
  scenarioName,
  months,
}: {
  financialTimeline: FinancialTimeline;
  scenarioName: string;
  months: TimeframeMonths;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // Defer chart render until after mount to avoid Recharts hydration mismatch (no SSR DOM for ResponsiveContainer).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: client-only mount gate for chart
    setMounted(true);
  }, []);

  const timeline = extendTimeline(financialTimeline, months);
  const cashOutMonth = tripwireMonth(timeline);

  const chartData = timeline.map((m) => ({
    month: `M${m.monthIndex}`,
    grossBurn: m.totalCashOut,
    endingCash: Math.max(0, m.endingCash),
  }));

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-primary">Runway Dashboard</h1>
        <nav
          className="flex rounded-lg border border-border bg-muted/30 p-1"
          aria-label="Timeframe"
        >
          {TIMEFRAME_OPTIONS.map((m) => (
            <Link
              key={m}
              href={`/dashboard?months=${m}`}
              className={`rounded-md px-4 py-2 text-sm font-medium tabular-nums transition-colors ${
                months === m
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {m} months
            </Link>
          ))}
        </nav>
      </div>

      <section
        className="w-full min-w-0 rounded-xl border border-border bg-card p-6 shadow-sm"
        aria-live="polite"
      >
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">
          Tripwire
        </h2>
        {cashOutMonth !== null ? (
          <div className="rounded-lg border border-destructive bg-destructive/10 px-4 py-3">
            <p className="text-sm font-medium text-destructive tabular-nums">
              Tripwire: Cash Out in M{cashOutMonth}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-green-600 bg-green-50 px-4 py-3 dark:border-green-500 dark:bg-green-950/30">
            <p className="text-sm font-medium text-green-700 tabular-nums dark:text-green-400">
              Runway Clear
            </p>
          </div>
        )}
      </section>

      <section className="w-full min-w-0 overflow-hidden rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">
          {scenarioName} — Runway (stacked area)
        </h2>
        <div className="h-[320px] min-h-[240px] w-full">
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, className: "tabular-nums" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, className: "tabular-nums" }}
                  tickLine={false}
                  tickFormatter={(v) => formatCurrency(v)}
                />
                <Area
                  type="monotone"
                  dataKey="grossBurn"
                  stackId="1"
                  stroke="var(--chart-1)"
                  fill="var(--chart-1)"
                  fillOpacity={0.7}
                  name="Gross Burn"
                />
                <Area
                  type="monotone"
                  dataKey="endingCash"
                  stackId="1"
                  stroke="var(--chart-2)"
                  fill="var(--chart-2)"
                  fillOpacity={0.7}
                  name="Ending Cash"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div
              className="h-full w-full animate-pulse rounded-md bg-muted"
              aria-hidden
            />
          )}
        </div>
      </section>
    </div>
  );
}

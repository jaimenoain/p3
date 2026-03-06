"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
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

/** Base year for projection (must match financial-engine projectionMonthToKey). */
const PROJECTION_BASE_YEAR = 2026;

const MONTH_ABBREV = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Full label for tooltips, e.g. Jan26, Feb26, Dec27. */
function monthIndexToLabel(monthIndex: number): string {
  const year = PROJECTION_BASE_YEAR + Math.floor((monthIndex - 1) / 12);
  const month = ((monthIndex - 1) % 12) + 1;
  const date = new Date(year, month - 1, 1);
  const shortMonth = date.toLocaleDateString("en-US", { month: "short" });
  const shortYear = String(year).slice(-2);
  return `${shortMonth}${shortYear}`;
}

/** Long label for Tripwire and copy, e.g. November 2026. */
function monthIndexToLongLabel(monthIndex: number): string {
  const year = PROJECTION_BASE_YEAR + Math.floor((monthIndex - 1) / 12);
  const month = ((monthIndex - 1) % 12) + 1;
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/**
 * Axis label: year only on January (e.g. "26"), month abbreviation elsewhere (e.g. "Feb", "Mar").
 * Keeps the chart legible in 12/24/36-month views without crowding.
 */
function getAxisMonthLabel(monthIndex: number): string {
  const isJanuary = (monthIndex - 1) % 12 === 0;
  if (isJanuary) {
    const year = PROJECTION_BASE_YEAR + Math.floor((monthIndex - 1) / 12);
    return String(year).slice(-2);
  }
  return MONTH_ABBREV[(monthIndex - 1) % 12];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    signDisplay: "auto",
  }).format(value);
}

function formatCurrencyWithSymbol(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

type RunwayTooltipProps = {
  active?: boolean;
  label?: string;
  payload?: Array<{
    value: number;
    dataKey: string;
    payload: { month: string; revenue: number; grossBurn: number; endingCash: number };
  }>;
};

function RunwayTooltip({ active, payload }: RunwayTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0].payload;
  const endingCashNegative = data.endingCash < 0;

  return (
    <div className="rounded-md border border-border bg-background px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-foreground">{data.month}</p>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center text-muted-foreground">
            <span className="mr-2 h-2 w-2 rounded-full bg-[var(--chart-3)]" />
            Revenue
          </span>
          <span className="tabular-nums">
            {formatCurrencyWithSymbol(data.revenue)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center text-muted-foreground">
            <span className="mr-2 h-2 w-2 rounded-full bg-[var(--chart-1)]" />
            Gross Burn
          </span>
          <span className="tabular-nums">
            {formatCurrencyWithSymbol(data.grossBurn)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center text-muted-foreground">
            <span className="mr-2 h-2 w-2 rounded-full bg-[var(--chart-2)]" />
            Ending Cash
          </span>
          <span
            className={`tabular-nums ${endingCashNegative ? "font-medium text-destructive" : ""}`}
          >
            {formatCurrencyWithSymbol(data.endingCash)}
          </span>
        </div>
      </div>
    </div>
  );
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
    month: monthIndexToLabel(m.monthIndex),
    monthLabel: getAxisMonthLabel(m.monthIndex),
    revenue: m.totalCashIn,
    grossBurn: m.totalCashOut,
    endingCash: m.endingCash,
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
              Tripwire: Cash Out in {monthIndexToLongLabel(cashOutMonth)}
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
          {scenarioName} — Runway
        </h2>
        <div className="h-[320px] min-h-[240px] w-full">
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 10, right: 16, left: 0, bottom: 8 }}
              >
                <defs>
                  <linearGradient
                    id="endingCashGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="var(--chart-2)"
                      stopOpacity={0.35}
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--chart-2)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  stroke="var(--border)"
                  strokeOpacity={0.4}
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="monthLabel"
                  tick={{ fontSize: 12, className: "tabular-nums" }}
                  axisLine={false}
                  tickLine={false}
                  tickMargin={8}
                />
                <YAxis
                  tick={{ fontSize: 12, className: "tabular-nums" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatCurrency(v)}
                  tickMargin={8}
                  domain={["auto", "auto"]}
                />
                <ReferenceLine
                  y={0}
                  stroke="var(--border)"
                  strokeDasharray="4 4"
                  strokeOpacity={0.8}
                />
                <Tooltip
                  cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }}
                  content={<RunwayTooltip />}
                />
                <Bar
                  dataKey="revenue"
                  name="Revenue"
                  fill="var(--chart-3)"
                  radius={[4, 4, 0, 0]}
                  barSize={18}
                />
                <Bar
                  dataKey="grossBurn"
                  name="Gross Burn"
                  fill="var(--chart-1)"
                  radius={[4, 4, 0, 0]}
                  barSize={18}
                />
                <Area
                  type="monotone"
                  dataKey="endingCash"
                  stroke="var(--chart-2)"
                  strokeWidth={2}
                  fill="url(#endingCashGradient)"
                  name="Ending Cash"
                />
              </ComposedChart>
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

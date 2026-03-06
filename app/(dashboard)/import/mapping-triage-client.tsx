"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import {
  commitDraftMonthMutation,
  getChartOfAccountsAction,
  getDefaultWorkspaceIdAction,
  type ChartOfAccountEntry,
  type CommitDraftMonthRecord,
  type ParsedCsvRow,
} from "../actions";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const SUSPENSE_VALUE = "__suspense__";

/** Normalized row for display: Date, Description, Amount. */
export type TriageRow = {
  date: string;
  description: string;
  amount: string;
};

function normalizeRow(row: ParsedCsvRow, headers: string[]): TriageRow {
  const lower = (s: string) => s.toLowerCase();
  const dateKey = headers.find((h) => lower(h).includes("date")) ?? headers[0];
  const descKey =
    headers.find((h) => lower(h).includes("description") || lower(h).includes("desc")) ??
    headers[1];
  const amountKey =
    headers.find(
      (h) => lower(h).includes("amount") || lower(h).includes("balance")
    ) ?? headers[2];
  return {
    date: row[dateKey] ?? "",
    description: row[descKey] ?? "",
    amount: row[amountKey] ?? "",
  };
}

const MOCK_ROWS: TriageRow[] = [
  { date: "2026-01-15", description: "Stripe Payout", amount: "5000.00" },
  { date: "2026-01-28", description: "Gusto Payroll", amount: "-12000.00" },
  { date: "2026-02-01", description: "Revenue - Subscription", amount: "4500.00" },
];

/** Format YYYY-MM-DD to "Mon YYYY" for calendar_month payload. */
function dateToCalendarMonthLabel(dateStr: string): string {
  const [y, m] = dateStr.split("-");
  const monthNum = parseInt(m ?? "1", 10);
  const year = parseInt(y ?? "2026", 10);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthLabel = months[Math.max(0, monthNum - 1)] ?? "Jan";
  return `${monthLabel} ${year}`;
}

type Props = {
  /** Parsed CSV rows from upload; when undefined or empty, mock 3 rows are used. */
  initialRows?: ParsedCsvRow[];
  /** Headers from parsed CSV for column mapping. */
  headers?: string[];
};

export function MappingTriageClient({
  initialRows,
  headers = [],
}: Props) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<ChartOfAccountEntry[]>([]);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [categoryByIndex, setCategoryByIndex] = useState<Record<number, string>>({});
  const [commitError, setCommitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const rows = useMemo(() => {
    if (initialRows && initialRows.length > 0 && headers.length > 0) {
      return initialRows.map((r) => normalizeRow(r, headers));
    }
    return MOCK_ROWS;
  }, [initialRows, headers]);

  useEffect(() => {
    getChartOfAccountsAction().then((res) => {
      if (res.ok) {
        setAccounts(res.accounts);
        setAccountsError(null);
      } else {
        setAccountsError(res.error);
      }
    });
  }, []);

  useEffect(() => {
    getDefaultWorkspaceIdAction().then((res) => {
      if (res.ok) {
        setWorkspaceId(res.workspaceId);
      }
    });
  }, []);

  const handleCategoryChange = (rowIndex: number, value: string) => {
    setCategoryByIndex((prev) => ({ ...prev, [rowIndex]: value }));
    setCommitError(null);
  };

  const allMapped =
    rows.length > 0 &&
    rows.every((_, i) => {
      const v = categoryByIndex[i];
      return v != null && v !== "";
    });

  const handleCommitMonth = () => {
    if (!allMapped || !workspaceId) return;
    setCommitError(null);
    startTransition(async () => {
      const calendar_month =
        rows.length > 0 ? dateToCalendarMonthLabel(rows[0].date) : dateToCalendarMonthLabel(new Date().toISOString().slice(0, 10));
      const records: CommitDraftMonthRecord[] = rows.map((row, i) => {
        const accountId = categoryByIndex[i];
        return {
          transaction_date: row.date,
          amount: parseFloat(row.amount) || 0,
          description: row.description || null,
          account_id: accountId === SUSPENSE_VALUE || accountId === "" ? null : accountId,
        };
      });
      const result = await commitDraftMonthMutation({
        workspace_id: workspaceId,
        calendar_month,
        records,
      });
      if (result.ok) {
        setSuccessMessage("Import successful. Draft month created.");
        router.push("/actuals");
      } else {
        setCommitError(result.error);
      }
    });
  };

  if (accountsError) {
    return (
      <div className="rounded-lg border border-destructive bg-destructive/10 px-4 py-3">
        <p className="text-sm font-medium text-destructive">{accountsError}</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {successMessage && (
        <div className="fixed bottom-4 right-4 z-50 rounded-md border border-green-600 bg-green-50 px-4 py-3 text-sm font-medium text-green-800 shadow-sm dark:border-green-500 dark:bg-green-950/30 dark:text-green-200">
          {successMessage}
        </div>
      )}
      {commitError && (
        <div className="rounded-lg border border-destructive bg-destructive/10 px-4 py-3" role="alert">
          <p className="text-sm font-medium text-destructive">{commitError}</p>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-primary">
          Map to Chart of Accounts
        </h2>
        <Button
          disabled={!allMapped || !workspaceId || isPending}
          type="button"
          onClick={handleCommitMonth}
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Committing…
            </>
          ) : (
            "Commit Month"
          )}
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[120px]">Date</TableHead>
              <TableHead className="min-w-[200px]">Description</TableHead>
              <TableHead className="text-right min-w-[100px]">Amount</TableHead>
              <TableHead className="min-w-[220px]">Category</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={index}>
                <TableCell className="tabular-nums">{row.date}</TableCell>
                <TableCell>{row.description}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.amount}
                </TableCell>
                <TableCell>
                  <select
                    value={categoryByIndex[index] ?? ""}
                    onChange={(e) => handleCategoryChange(index, e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={`Category for row ${index + 1}`}
                  >
                    <option value="">Select category…</option>
                    <option value={SUSPENSE_VALUE}>Suspense</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.category})
                      </option>
                    ))}
                  </select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

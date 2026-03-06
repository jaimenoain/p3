"use client";

import { useEffect, useState, useTransition } from "react";
import { ChevronDown, ChevronUp, Loader2, Pencil, Trash2 } from "lucide-react";
import type { BlockRecord, BlockType, NumericInputMode } from "../actions";
import {
  createBlockMutation,
  updateBlockMutation,
  updateBlockDependencyMutation,
  updateScenarioBlocksMutation,
  deleteBlockMutation,
} from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const BLOCK_TYPES: BlockType[] = [
  "Personnel",
  "Revenue",
  "Marketing",
  "OpEx",
  "Capital",
];

/**
 * Derives the "new customers" output value from a block when it is used as a
 * reference (e.g. Revenue block's new customers source). Uses block payload only;
 * no timeline/ramp so Marketing is spend/CAC, Personnel (sales) is headcount ×
 * clients per month at full ramp.
 */
function getReferencedNewCustomersValue(refBlock: BlockRecord): number | null {
  const p = (refBlock.payload ?? {}) as Record<string, unknown>;
  if (refBlock.type === "Marketing") {
    const spend = Number(p.monthlyAdSpend ?? 0);
    const cac = Number(p.targetCac ?? 0);
    if (cac <= 0) return null;
    return Math.round((spend / cac) * 100) / 100;
  }
  if (refBlock.type === "Personnel") {
    const roleType = String(p.roleType ?? "standard");
    if (roleType !== "sales") return null;
    const headcount = Number(p.headcountCount ?? 1) || 0;
    const perMonth = Number(p.salesClientsPerMonth ?? 0) || 0;
    return Math.round(headcount * perMonth * 100) / 100;
  }
  return null;
}

type Props = {
  scenarioId: string;
  initialBlocks: BlockRecord[];
};

export function ProjectionCanvasClient({ scenarioId, initialBlocks }: Props) {
  const [blocks, setBlocks] = useState<BlockRecord[]>(initialBlocks);
  const [selectedType, setSelectedType] = useState<BlockType>("Personnel");
  const [error, setError] = useState<string | null>(null);
  const [isCreating, startCreateTransition] = useTransition();
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [newBlockInModal, setNewBlockInModal] = useState<BlockRecord | null>(null);

  useEffect(() => {
    if (!toastMessage) return;
    const id = setTimeout(() => setToastMessage(null), 3000);
    return () => clearTimeout(id);
  }, [toastMessage]);

  async function runWithRecalculation<T>(fn: () => Promise<T>): Promise<T> {
    setIsRecalculating(true);
    try {
      const [result] = await Promise.all([
        fn(),
        new Promise((resolve) => setTimeout(resolve, 1000)),
      ]);
      return result as T;
    } finally {
      setIsRecalculating(false);
    }
  }

  async function handleAddBlock(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const type = selectedType;

    startCreateTransition(async () => {
      const result = await runWithRecalculation(() =>
        createBlockMutation({
          scenarioId,
          type,
        })
      );

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setNewBlockInModal(result.block);
    });
  }

  async function handleCloseNewBlockModal() {
    if (!newBlockInModal) return;
    await deleteBlockMutation({ blockId: newBlockInModal.id });
    setNewBlockInModal(null);
  }

  function handleNewBlockSaved(updated: BlockRecord) {
    setBlocks((prev) => [...prev, updated]);
    setNewBlockInModal(null);
  }

  const activeBlocks = blocks.filter((block) => block.is_active);
  const inactiveBlocks = blocks.filter((block) => !block.is_active);

  const [showInactiveTray, setShowInactiveTray] = useState(true);

  return (
    <div className="relative">
      <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Projection Canvas
          </h1>
          <p className="text-sm text-muted-foreground">
            Add modular financial building blocks to your baseline scenario.
          </p>
        </div>
        <form
          onSubmit={handleAddBlock}
          className="flex flex-col gap-2 sm:flex-row sm:items-center"
        >
          <label className="text-sm font-medium" htmlFor="block-type">
            New block
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              id="block-type"
              name="blockType"
              className="flex h-9 w-full min-w-[10rem] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:w-auto"
              value={selectedType}
              onChange={(event) =>
                setSelectedType(event.target.value as BlockType)
              }
              disabled={isCreating}
            >
              {BLOCK_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <Button
              type="submit"
              className="sm:ml-2"
              disabled={isCreating}
              aria-busy={isCreating}
            >
              {isCreating && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              )}
              {isCreating ? "Adding..." : "Add block"}
            </Button>
          </div>
        </form>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

        {activeBlocks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No blocks yet. Add your first block to start modeling.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeBlocks.map((block) => (
              <BlockCard
                key={block.id}
                block={block}
                allBlocks={blocks}
                onUpdated={(updated) => {
                  setBlocks((prev) =>
                    prev.map((b) => (b.id === updated.id ? updated : b))
                  );
                }}
                onDeleted={(blockId) => {
                  setBlocks((prev) => prev.filter((b) => b.id !== blockId));
                }}
                runWithRecalculation={runWithRecalculation}
                showToast={(message) => setToastMessage(message)}
              />
            ))}
          </div>
        )}

        {inactiveBlocks.length > 0 && (
          <div className="mt-4 rounded-md border border-border bg-muted/40">
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-2 text-sm font-medium"
              onClick={() => setShowInactiveTray((prev) => !prev)}
            >
              <span>Inactive Projections</span>
              <span className="text-xs text-muted-foreground">
                {showInactiveTray ? "Hide" : "Show"} ({inactiveBlocks.length})
              </span>
            </button>
            {showInactiveTray && (
              <div className="border-t border-border px-4 py-3">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {inactiveBlocks.map((block) => (
                    <BlockCard
                      key={block.id}
                      block={block}
                      allBlocks={blocks}
                      onUpdated={(updated) => {
                        setBlocks((prev) =>
                          prev.map((b) => (b.id === updated.id ? updated : b))
                        );
                      }}
                      onDeleted={(blockId) => {
                        setBlocks((prev) => prev.filter((b) => b.id !== blockId));
                      }}
                      runWithRecalculation={runWithRecalculation}
                      showToast={(message) => setToastMessage(message)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {isRecalculating && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/80">
          <div className="flex items-center gap-2 rounded-md border bg-card px-4 py-3 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            <span>Recalculating model...</span>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className="rounded-md border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive shadow-sm">
            {toastMessage}
          </div>
        </div>
      )}

      <Dialog
        open={!!newBlockInModal}
        onOpenChange={(open) => {
          if (!open && newBlockInModal) void handleCloseNewBlockModal();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configure new block</DialogTitle>
          </DialogHeader>
          {newBlockInModal && (
            <BlockCard
              block={newBlockInModal}
              allBlocks={blocks}
              onUpdated={(updated) => {
                setNewBlockInModal(updated);
              }}
              onDeleted={() => setNewBlockInModal(null)}
              runWithRecalculation={runWithRecalculation}
              showToast={setToastMessage}
              isNewBlockModal
              onSaveSuccess={handleNewBlockSaved}
              onCancel={() => void handleCloseNewBlockModal()}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

type BlockCardProps = {
  block: BlockRecord;
  allBlocks: BlockRecord[];
  onUpdated: (block: BlockRecord) => void;
  onDeleted: (blockId: string) => void;
  runWithRecalculation: <T>(fn: () => Promise<T>) => Promise<T>;
  showToast: (message: string) => void;
  /** When true, card is shown inside "new block" modal: form only, Cancel/Save, no delete/switch. */
  isNewBlockModal?: boolean;
  onSaveSuccess?: (block: BlockRecord) => void;
  onCancel?: () => void;
};

/** Labels shown in compact read-only view; the rest are behind "Show more". */
const KEY_READONLY_LABELS: Record<BlockType, string[]> = {
  Personnel: ["Role name", "Type", "Monthly gross salary", "Headcount count"],
  Revenue: ["Starting MRR", "New customers (source)", "ARPA"],
  Marketing: ["Monthly ad spend", "Target CAC"],
  OpEx: ["Expense name", "Expense type", "Monthly cost"],
  Capital: ["Funding type", "Amount", "Month received"],
};

function getOpExKeyLabels(expenseType: string): string[] {
  if (expenseType === "variable")
    return ["Expense name", "Expense type", "Percentage of Revenue"];
  if (expenseType === "one-off")
    return ["Expense name", "Expense type", "Amount", "Month"];
  return ["Expense name", "Expense type", "Monthly cost"];
}

type ReadOnlyRowItem = { label: string; value: string | number | null | undefined };

function getReadOnlyRows(
  block: BlockRecord,
  formState: Record<string, string>,
  allBlocks: BlockRecord[],
  newCustomersMode: NumericInputMode,
  newCustomersReferenceId: string
): ReadOnlyRowItem[] {
  const p = formState;
  if (block.type === "Personnel") {
    return [
      { label: "Role name", value: p.roleName },
      { label: "Type", value: p.roleType === "sales" ? "Sales" : "Standard" },
      ...(p.roleType === "sales"
        ? [
            { label: "New clients per month (at full ramp)", value: p.salesClientsPerMonth },
            { label: "Months until first client", value: p.salesMonthsToFirstClient },
          ]
        : []),
      { label: "Monthly gross salary", value: p.monthlyGrossSalary },
      { label: "Employer burden %", value: p.employerBurdenPercent },
      { label: "Start month", value: p.startMonth },
      { label: "End month", value: p.endMonth },
      { label: "Headcount count", value: p.headcountCount },
    ];
  }
  if (block.type === "Revenue") {
    const newCustomersDisplay =
      newCustomersMode === "Referenced" && newCustomersReferenceId
        ? (() => {
            const refBlock = allBlocks.find((b) => b.id === newCustomersReferenceId);
            const refTitle = refBlock?.title ?? refBlock?.type ?? "block";
            const refValue = refBlock ? getReferencedNewCustomersValue(refBlock) : null;
            if (refValue !== null) return `${refValue} (from ${refTitle})`;
            return `From ${refTitle}`;
          })()
        : p.newCustomersStatic;
    return [
      { label: "Starting MRR", value: p.startingMrr },
      { label: "New customers (source)", value: newCustomersDisplay },
      { label: "ARPA", value: p.arpa },
      { label: "Setup fee", value: p.setupFee },
      { label: "Monthly churn %", value: p.monthlyChurnPercent },
      {
        label: "Upsell / expansion growth %",
        value:
          p.monthlyMrrGrowthPercent !== undefined && p.monthlyMrrGrowthPercent !== ""
            ? p.monthlyMrrGrowthPercent
            : "—",
      },
      { label: "Billing frequency", value: p.billingFrequency },
    ];
  }
  if (block.type === "Marketing") {
    return [
      { label: "Monthly ad spend", value: p.monthlyAdSpend },
      { label: "Target CAC", value: p.targetCac },
      { label: "Sales cycle lag (months)", value: p.salesCycleLagMonths },
    ];
  }
  if (block.type === "OpEx") {
    const expenseType = p.expenseType ?? "fixed";
    const typeLabel =
      expenseType === "variable"
        ? "Variable"
        : expenseType === "one-off"
          ? "One-off"
          : "Fixed";
    const base: ReadOnlyRowItem[] = [
      { label: "Expense name", value: p.expenseName },
      { label: "Expense type", value: typeLabel },
    ];
    if (expenseType === "fixed") {
      base.push(
        { label: "Monthly cost", value: p.monthlyCost },
        { label: "Annual growth rate %", value: p.annualGrowthRatePercent }
      );
    } else if (expenseType === "variable") {
      base.push(
        { label: "Percentage of Revenue", value: p.percentageOfRevenue },
        { label: "Fixed cost per customer", value: p.fixedCostPerCustomer }
      );
    } else {
      base.push(
        { label: "Amount", value: p.amount },
        { label: "Month", value: p.month }
      );
    }
    return base;
  }
  if (block.type === "Capital") {
    return [
      { label: "Funding type", value: p.fundingType },
      { label: "Amount", value: p.amount },
      { label: "Month received", value: p.monthReceived },
    ];
  }
  return [];
}

function ReadOnlyRow({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  const display = value === "" || value === null || value === undefined ? "—" : String(value);
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-sm tabular-nums">{display}</span>
    </div>
  );
}

function ReadOnlyCardContent({
  block,
  formState,
  allBlocks,
  newCustomersMode,
  newCustomersReferenceId,
  isReadOnlyExpanded,
  onToggleExpanded,
}: {
  block: BlockRecord;
  formState: Record<string, string>;
  allBlocks: BlockRecord[];
  newCustomersMode: NumericInputMode;
  newCustomersReferenceId: string;
  isReadOnlyExpanded: boolean;
  onToggleExpanded: () => void;
}) {
  const rows = getReadOnlyRows(
    block,
    formState,
    allBlocks,
    newCustomersMode,
    newCustomersReferenceId
  );
  const keyLabels =
    block.type === "OpEx"
      ? getOpExKeyLabels(formState.expenseType ?? "fixed")
      : (KEY_READONLY_LABELS[block.type] ?? []);
  const keyRows = rows.filter((r) => keyLabels.includes(r.label));
  const restRows = rows.filter((r) => !keyLabels.includes(r.label));
  const hasRest = restRows.length > 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {keyRows.map(({ label, value }) => (
          <ReadOnlyRow key={label} label={label} value={value} />
        ))}
        {isReadOnlyExpanded && restRows.map(({ label, value }) => (
          <ReadOnlyRow key={label} label={label} value={value} />
        ))}
      </div>
      {hasRest && (
        <button
          type="button"
          onClick={onToggleExpanded}
          className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {isReadOnlyExpanded ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" aria-hidden />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
              Show more
            </>
          )}
        </button>
      )}
    </div>
  );
}

function BlockCard({
  block,
  allBlocks,
  onUpdated,
  onDeleted,
  runWithRecalculation,
  showToast,
  isNewBlockModal = false,
  onSaveSuccess,
  onCancel,
}: BlockCardProps) {
  const [localError, setLocalError] = useState<string | null>(null);
  const [isUpdating, startUpdateTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isActive, setIsActive] = useState(block.is_active);

  const initialPayload = (block.payload ?? {}) as Record<string, unknown>;
  const initialDependencies = (initialPayload.dependencies ??
    {}) as Record<
    string,
    { mode: NumericInputMode; value?: number; referenceId?: string }
  >;
  const initialNewCustomersDependency = initialDependencies["newCustomers"] ?? {
    mode: "Static" as NumericInputMode,
    value: 0,
  };

  const [isEditing, setIsEditing] = useState<boolean>(
    isNewBlockModal || Object.keys(initialPayload).length === 0
  );
  const [isReadOnlyExpanded, setIsReadOnlyExpanded] = useState(false);

  const [title, setTitle] = useState<string>(block.title ?? block.type);

  const [formState, setFormState] = useState<Record<string, string>>(() => {
    const base: Record<string, string> = {};

    if (block.type === "Personnel") {
      base.roleName = String(initialPayload.roleName ?? "");
      base.monthlyGrossSalary = String(initialPayload.monthlyGrossSalary ?? "");
      base.employerBurdenPercent = String(
        initialPayload.employerBurdenPercent ?? ""
      );
      base.startMonth = String(initialPayload.startMonth ?? "");
      base.endMonth = String(initialPayload.endMonth ?? "");
      base.headcountCount = String(initialPayload.headcountCount ?? "1");
      base.roleType = String(initialPayload.roleType ?? "standard");
      base.salesClientsPerMonth = String(
        initialPayload.salesClientsPerMonth ?? ""
      );
      base.salesMonthsToFirstClient = String(
        initialPayload.salesMonthsToFirstClient ?? ""
      );
    } else if (block.type === "Revenue") {
      base.startingMrr = String(initialPayload.startingMrr ?? "");
      base.newCustomersStatic = String(
        initialNewCustomersDependency.mode === "Static"
          ? initialNewCustomersDependency.value ?? 0
          : 0
      );
      base.monthlyMrrGrowthPercent = String(
        initialPayload.monthlyMrrGrowthPercent ?? ""
      );
      base.arpa = String(initialPayload.arpa ?? "");
      base.setupFee = String(initialPayload.setupFee ?? "");
      base.monthlyChurnPercent = String(
        initialPayload.monthlyChurnPercent ?? ""
      );
      base.billingFrequency = String(
        initialPayload.billingFrequency ?? "Monthly"
      );
    } else if (block.type === "Marketing") {
      base.monthlyAdSpend = String(initialPayload.monthlyAdSpend ?? "");
      base.targetCac = String(initialPayload.targetCac ?? "");
      base.salesCycleLagMonths = String(
        initialPayload.salesCycleLagMonths ?? "0"
      );
    } else if (block.type === "OpEx") {
      base.expenseType = String(initialPayload.expenseType ?? "fixed");
      base.expenseName = String(initialPayload.expenseName ?? "");
      base.monthlyCost = String(initialPayload.monthlyCost ?? "");
      base.annualGrowthRatePercent = String(
        initialPayload.annualGrowthRatePercent ?? ""
      );
      base.percentageOfRevenue = String(
        initialPayload.percentageOfRevenue ?? ""
      );
      base.fixedCostPerCustomer = String(
        initialPayload.fixedCostPerCustomer ?? ""
      );
      base.amount = String(initialPayload.amount ?? "");
      base.month = String(initialPayload.month ?? "");
    } else if (block.type === "Capital") {
      base.fundingType = String(initialPayload.fundingType ?? "Equity");
      base.amount = String(initialPayload.amount ?? "");
      base.monthReceived = String(initialPayload.monthReceived ?? "");
    }

    return base;
  });

  const [newCustomersMode, setNewCustomersMode] =
    useState<NumericInputMode>(initialNewCustomersDependency.mode);
  const [newCustomersReferenceId, setNewCustomersReferenceId] = useState(
    initialNewCustomersDependency.referenceId ?? ""
  );

  function handleChange(name: string, value: string) {
    setFormState((prev) => ({ ...prev, [name]: value }));
  }

  function buildDependencyEdges() {
    const edges = new Map<string, Set<string>>();
    for (const b of allBlocks) {
      const payload = (b.payload ?? {}) as Record<string, unknown>;
      const deps = (payload.dependencies ??
        {}) as Record<string, { mode: string; referenceId?: string }>;
      for (const cfg of Object.values(deps)) {
        if (cfg?.mode === "Referenced" && cfg.referenceId) {
          if (!edges.has(b.id)) edges.set(b.id, new Set<string>());
          edges.get(b.id)!.add(cfg.referenceId);
        }
      }
    }
    return edges;
  }

  function getDownstreamIdsForBlock() {
    const edges = buildDependencyEdges();
    const visited = new Set<string>();
    const stack: string[] = [block.id];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      const neighbors = edges.get(current);
      if (neighbors) for (const id of neighbors) stack.push(id);
    }
    visited.delete(block.id);
    return visited;
  }

  async function handleNewCustomersModeChange(
    mode: NumericInputMode
  ): Promise<void> {
    const previous = newCustomersMode;
    setNewCustomersMode(mode);
    const result = await runWithRecalculation(() =>
      updateBlockDependencyMutation({
        blockId: block.id,
        field: "newCustomers",
        mode,
        value:
          mode === "Static"
            ? Number(formState.newCustomersStatic) || 0
            : undefined,
        referenceId:
          mode === "Referenced" ? newCustomersReferenceId || undefined : undefined,
      })
    );
    if (!result.ok) {
      setNewCustomersMode(previous);
      showToast(result.error);
      return;
    }
    onUpdated(result.block);
  }

  async function handleNewCustomersReferenceChange(
    referenceId: string
  ): Promise<void> {
    const previous = newCustomersReferenceId;
    setNewCustomersReferenceId(referenceId);
    const result = await runWithRecalculation(() =>
      updateBlockDependencyMutation({
        blockId: block.id,
        field: "newCustomers",
        mode: "Referenced",
        referenceId: referenceId || undefined,
      })
    );
    if (!result.ok) {
      setNewCustomersReferenceId(previous);
      showToast(result.error);
      return;
    }
    onUpdated(result.block);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);

    const payload: Record<string, unknown> = {};
    Object.entries(formState).forEach(([key, value]) => {
      if (value === "") {
        payload[key] = null;
      } else {
        payload[key] = value;
      }
    });

    if (block.type === "Revenue") {
      const existingDeps = (initialPayload.dependencies ?? {}) as Record<
        string,
        { mode: string; value?: number; referenceId?: string }
      >;
      const newCustomersValue =
        newCustomersMode === "Static"
          ? Number(formState.newCustomersStatic) || 0
          : undefined;
      payload.dependencies = {
        ...existingDeps,
        startingMrr: { mode: "Static" },
        newCustomers: {
          mode: newCustomersMode,
          ...(newCustomersValue !== undefined ? { value: newCustomersValue } : {}),
          ...(newCustomersMode === "Referenced" && newCustomersReferenceId
            ? { referenceId: newCustomersReferenceId }
            : {}),
        },
      };
      delete payload.newCustomersStatic;
    }

    startUpdateTransition(async () => {
      const result = await runWithRecalculation(() =>
        updateBlockMutation({
          blockId: block.id,
          title: (title ?? "").trim() || block.type,
          payload,
        })
      );

      if (!result.ok) {
        setLocalError(result.error);
        return;
      }

      onUpdated(result.block);
      setTitle(result.block.title ?? result.block.type);
      if (isNewBlockModal && onSaveSuccess) {
        onSaveSuccess(result.block);
      } else {
        setIsEditing(false);
      }
    });
  }

  async function handleToggle(checked: boolean) {
    const previous = isActive;
    setIsActive(checked);

    startUpdateTransition(async () => {
      const result = await runWithRecalculation(() =>
        updateScenarioBlocksMutation({
          blockId: block.id,
          isActive: checked,
        })
      );

      if (!result.ok) {
        setIsActive(previous);
        showToast(result.error);
        return;
      }

      onUpdated(result.block);
    });
  }

  async function handleDelete() {
    if (
      !confirm(
        "Are you sure you want to delete this block? This cannot be undone."
      )
    ) {
      return;
    }
    startDeleteTransition(async () => {
      const result = await deleteBlockMutation({ blockId: block.id });
      if (!result.ok) {
        showToast(result.error);
        return;
      }
      onDeleted(block.id);
    });
  }

  const showForm = isEditing || isNewBlockModal;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            {showForm ? (
              <Input
                className="h-8 text-sm font-semibold"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                onBlur={(event) => {
                  const trimmed = (event.target.value ?? "").trim();
                  setTitle(trimmed || block.type);
                }}
                disabled={isUpdating}
                aria-label="Block title"
              />
            ) : (
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold">
                  {title || block.type}
                </CardTitle>
              </div>
            )}
            <CardDescription>
              {block.type} • {isActive ? "Active" : "Inactive"} block
            </CardDescription>
          </div>
          {!isNewBlockModal && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => void handleDelete()}
                disabled={isDeleting}
                aria-label="Delete block"
                className="text-muted-foreground hover:text-destructive"
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Trash2 className="h-4 w-4" aria-hidden />
                )}
              </Button>
              {!isEditing && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsEditing(true)}
                  aria-label="Edit block"
                >
                  <Pencil className="h-4 w-4" aria-hidden />
                </Button>
              )}
              <Switch
                checked={isActive}
                onCheckedChange={(checked) => void handleToggle(checked)}
                aria-label="Toggle block on or off"
              />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {showForm ? (
          <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
            {block.type === "Personnel" && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium" htmlFor={`${block.id}-roleName`}>
                    Role name
                  </label>
                  <Input
                    id={`${block.id}-roleName`}
                    name="roleName"
                    value={formState.roleName ?? ""}
                    onChange={(event) =>
                      handleChange("roleName", event.target.value)
                    }
                    disabled={isUpdating}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label
                    className="text-sm font-medium"
                    htmlFor={`${block.id}-roleType`}
                  >
                    Type
                  </label>
                  <select
                    id={`${block.id}-roleType`}
                    name="roleType"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={formState.roleType ?? "standard"}
                    onChange={(event) =>
                      handleChange("roleType", event.target.value)
                    }
                    disabled={isUpdating}
                  >
                    <option value="standard">Standard</option>
                    <option value="sales">Sales</option>
                  </select>
                </div>
                {formState.roleType === "sales" && (
                  <>
                    <div className="flex flex-col gap-1">
                      <label
                        className="text-sm font-medium"
                        htmlFor={`${block.id}-salesClientsPerMonth`}
                      >
                        New clients per month (at full ramp)
                      </label>
                      <Input
                        id={`${block.id}-salesClientsPerMonth`}
                        name="salesClientsPerMonth"
                        type="number"
                        className="tabular-nums"
                        value={formState.salesClientsPerMonth ?? ""}
                        onChange={(event) =>
                          handleChange(
                            "salesClientsPerMonth",
                            event.target.value
                          )
                        }
                        disabled={isUpdating}
                        min={0}
                        step="any"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label
                        className="text-sm font-medium"
                        htmlFor={`${block.id}-salesMonthsToFirstClient`}
                      >
                        Months until first client
                      </label>
                      <Input
                        id={`${block.id}-salesMonthsToFirstClient`}
                        name="salesMonthsToFirstClient"
                        type="number"
                        className="tabular-nums"
                        value={formState.salesMonthsToFirstClient ?? ""}
                        onChange={(event) =>
                          handleChange(
                            "salesMonthsToFirstClient",
                            event.target.value
                          )
                        }
                        disabled={isUpdating}
                        min={0}
                        step={1}
                      />
                    </div>
                  </>
                )}
                <div className="flex flex-col gap-1">
                  <label
                    className="text-sm font-medium"
                    htmlFor={`${block.id}-monthlyGrossSalary`}
                  >
                    Monthly gross salary
                  </label>
                  <Input
                    id={`${block.id}-monthlyGrossSalary`}
                    name="monthlyGrossSalary"
                    type="number"
                    className="tabular-nums"
                    value={formState.monthlyGrossSalary ?? ""}
                    onChange={(event) =>
                      handleChange("monthlyGrossSalary", event.target.value)
                    }
                    disabled={isUpdating}
                    min={0}
                    step="any"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label
                    className="text-sm font-medium"
                    htmlFor={`${block.id}-employerBurdenPercent`}
                  >
                    Employer burden %
                  </label>
                  <Input
                    id={`${block.id}-employerBurdenPercent`}
                    name="employerBurdenPercent"
                    type="number"
                    className="tabular-nums"
                    value={formState.employerBurdenPercent ?? ""}
                    onChange={(event) =>
                      handleChange("employerBurdenPercent", event.target.value)
                    }
                    disabled={isUpdating}
                    min={0}
                    max={1}
                    step="any"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label
                    className="text-sm font-medium"
                    htmlFor={`${block.id}-startMonth`}
                  >
                    Start month
                  </label>
                  <Input
                    id={`${block.id}-startMonth`}
                    name="startMonth"
                    type="month"
                    value={formState.startMonth ?? ""}
                    onChange={(event) =>
                      handleChange("startMonth", event.target.value)
                    }
                    disabled={isUpdating}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label
                    className="text-sm font-medium"
                    htmlFor={`${block.id}-endMonth`}
                  >
                    End month (optional)
                  </label>
                  <Input
                    id={`${block.id}-endMonth`}
                    name="endMonth"
                    type="month"
                    value={formState.endMonth ?? ""}
                    onChange={(event) =>
                      handleChange("endMonth", event.target.value)
                    }
                    disabled={isUpdating}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label
                    className="text-sm font-medium"
                    htmlFor={`${block.id}-headcountCount`}
                  >
                    Headcount count
                  </label>
                  <Input
                    id={`${block.id}-headcountCount`}
                    name="headcountCount"
                    type="number"
                    className="tabular-nums"
                    value={formState.headcountCount ?? ""}
                    onChange={(event) =>
                      handleChange("headcountCount", event.target.value)
                    }
                    disabled={isUpdating}
                    min={1}
                    step={1}
                  />
                </div>
              </>
            )}

          {block.type === "Revenue" && (
            <>
              <div className="flex flex-col gap-1">
                <label
                  className="text-sm font-medium"
                  htmlFor={`${block.id}-startingMrr`}
                >
                  Starting MRR
                </label>
                <Input
                  id={`${block.id}-startingMrr`}
                  name="startingMrr"
                  type="number"
                  className="tabular-nums"
                  value={formState.startingMrr ?? ""}
                  onChange={(event) =>
                    handleChange("startingMrr", event.target.value)
                  }
                  disabled={isUpdating}
                  min={0}
                  step="any"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label
                  className="text-sm font-medium"
                  htmlFor={`${block.id}-newCustomers-mode`}
                >
                  New customers (source)
                </label>
                <select
                  id={`${block.id}-newCustomers-mode`}
                  name="newCustomersMode"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={newCustomersMode}
                  onChange={(event) =>
                    void handleNewCustomersModeChange(
                      event.target.value as NumericInputMode
                    )
                  }
                  disabled={isUpdating}
                >
                  <option value="Static">Static</option>
                  <option value="Referenced">Referenced</option>
                </select>
              </div>
              {newCustomersMode === "Static" && (
                <div className="flex flex-col gap-1">
                  <label
                    className="text-sm font-medium"
                    htmlFor={`${block.id}-newCustomersStatic`}
                  >
                    New customers per month
                  </label>
                  <Input
                    id={`${block.id}-newCustomersStatic`}
                    name="newCustomersStatic"
                    type="number"
                    className="tabular-nums"
                    value={formState.newCustomersStatic ?? ""}
                    onChange={(event) =>
                      handleChange("newCustomersStatic", event.target.value)
                    }
                    disabled={isUpdating}
                    min={0}
                    step="any"
                  />
                </div>
              )}
              {newCustomersMode === "Referenced" && (
                <>
                  <div className="flex flex-col gap-1">
                    <label
                      className="text-sm font-medium"
                      htmlFor={`${block.id}-newCustomers-reference`}
                    >
                      Reference block
                    </label>
                    <select
                      id={`${block.id}-newCustomers-reference`}
                      name="newCustomersReference"
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={newCustomersReferenceId}
                      onChange={(event) =>
                        void handleNewCustomersReferenceChange(event.target.value)
                      }
                      disabled={isUpdating}
                    >
                      <option value="">Select block...</option>
                      {allBlocks
                        .filter(
                          (candidate) =>
                            getReferencedNewCustomersValue(candidate) !== null
                        )
                        .map((candidate) => {
                          const downstreamIds = getDownstreamIdsForBlock();
                          const disabled =
                            candidate.id === block.id ||
                            downstreamIds.has(candidate.id);
                          const label = candidate.title
                            ? `${candidate.title} (${candidate.type})`
                            : candidate.type;
                          return (
                            <option
                              key={candidate.id}
                              value={candidate.id}
                              disabled={disabled}
                            >
                              {label}
                            </option>
                          );
                        })}
                    </select>
                  </div>
                  {newCustomersReferenceId && (() => {
                    const refBlock = allBlocks.find(
                      (b) => b.id === newCustomersReferenceId
                    );
                    const refValue = refBlock
                      ? getReferencedNewCustomersValue(refBlock)
                      : null;
                    if (refValue !== null) {
                      return (
                        <p className="text-xs text-muted-foreground">
                          Value from reference: <span className="tabular-nums font-medium text-foreground">{refValue}</span> new customers per month
                        </p>
                      );
                    }
                    return null;
                  })()}
                </>
              )}
              <div className="flex flex-col gap-1">
                <label
                  className="text-sm font-medium"
                  htmlFor={`${block.id}-arpa`}
                >
                  ARPA
                </label>
                <Input
                  id={`${block.id}-arpa`}
                  name="arpa"
                  type="number"
                  className="tabular-nums"
                  value={formState.arpa ?? ""}
                  onChange={(event) =>
                    handleChange("arpa", event.target.value)
                  }
                  disabled={isUpdating}
                  min={0}
                  step="any"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label
                  className="text-sm font-medium"
                  htmlFor={`${block.id}-setupFee`}
                >
                  Setup fee
                </label>
                <Input
                  id={`${block.id}-setupFee`}
                  name="setupFee"
                  type="number"
                  className="tabular-nums"
                  value={formState.setupFee ?? ""}
                  onChange={(event) =>
                    handleChange("setupFee", event.target.value)
                  }
                  disabled={isUpdating}
                  min={0}
                  step="any"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label
                  className="text-sm font-medium"
                  htmlFor={`${block.id}-monthlyChurnPercent`}
                >
                  Monthly churn %
                </label>
                <Input
                  id={`${block.id}-monthlyChurnPercent`}
                  name="monthlyChurnPercent"
                  type="number"
                  className="tabular-nums"
                  value={formState.monthlyChurnPercent ?? ""}
                  onChange={(event) =>
                    handleChange("monthlyChurnPercent", event.target.value)
                  }
                  disabled={isUpdating}
                  min={0}
                  max={1}
                  step="any"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label
                  className="text-sm font-medium"
                  htmlFor={`${block.id}-monthlyMrrGrowthPercent`}
                >
                  Upsell / expansion growth %
                </label>
                <span className="text-xs text-muted-foreground">
                  Monthly growth on existing MRR only (e.g. price increases, upsell). Does not apply to new customers.
                </span>
                <Input
                  id={`${block.id}-monthlyMrrGrowthPercent`}
                  name="monthlyMrrGrowthPercent"
                  type="number"
                  className="tabular-nums"
                  value={formState.monthlyMrrGrowthPercent ?? ""}
                  onChange={(event) =>
                    handleChange("monthlyMrrGrowthPercent", event.target.value)
                  }
                  disabled={isUpdating}
                  min={0}
                  max={1}
                  step="any"
                  placeholder="e.g. 0.05 for 5%"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label
                  className="text-sm font-medium"
                  htmlFor={`${block.id}-billingFrequency`}
                >
                  Billing frequency
                </label>
                <select
                  id={`${block.id}-billingFrequency`}
                  name="billingFrequency"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={formState.billingFrequency ?? "Monthly"}
                  onChange={(event) =>
                    handleChange("billingFrequency", event.target.value)
                  }
                  disabled={isUpdating}
                >
                  <option value="Monthly">Monthly</option>
                  <option value="Annual Prepaid">Annual Prepaid</option>
                </select>
              </div>
            </>
          )}

          {block.type === "Marketing" && (
            <>
              <div className="flex flex-col gap-1">
                <label
                  className="text-sm font-medium"
                  htmlFor={`${block.id}-monthlyAdSpend`}
                >
                  Monthly ad spend
                </label>
                <Input
                  id={`${block.id}-monthlyAdSpend`}
                  name="monthlyAdSpend"
                  type="number"
                  className="tabular-nums"
                  value={formState.monthlyAdSpend ?? ""}
                  onChange={(event) =>
                    handleChange("monthlyAdSpend", event.target.value)
                  }
                  disabled={isUpdating}
                  min={0}
                  step="any"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label
                  className="text-sm font-medium"
                  htmlFor={`${block.id}-targetCac`}
                >
                  Target CAC
                </label>
                <Input
                  id={`${block.id}-targetCac`}
                  name="targetCac"
                  type="number"
                  className="tabular-nums"
                  value={formState.targetCac ?? ""}
                  onChange={(event) =>
                    handleChange("targetCac", event.target.value)
                  }
                  disabled={isUpdating}
                  min={0}
                  step="any"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label
                  className="text-sm font-medium"
                  htmlFor={`${block.id}-salesCycleLagMonths`}
                >
                  Sales cycle lag (months)
                </label>
                <Input
                  id={`${block.id}-salesCycleLagMonths`}
                  name="salesCycleLagMonths"
                  type="number"
                  className="tabular-nums"
                  value={formState.salesCycleLagMonths ?? ""}
                  onChange={(event) =>
                    handleChange("salesCycleLagMonths", event.target.value)
                  }
                  disabled={isUpdating}
                  min={0}
                  step={1}
                />
              </div>
            </>
          )}

          {block.type === "OpEx" && (
            <>
              <div className="flex flex-col gap-1">
                <label
                  className="text-sm font-medium"
                  htmlFor={`${block.id}-opex-expenseType`}
                >
                  Expense type
                </label>
                <select
                  id={`${block.id}-opex-expenseType`}
                  name="expenseType"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={formState.expenseType ?? "fixed"}
                  onChange={(event) =>
                    handleChange("expenseType", event.target.value)
                  }
                  disabled={isUpdating}
                >
                  <option value="fixed">Fixed (recurring)</option>
                  <option value="variable">Variable (% of revenue)</option>
                  <option value="one-off">One-off</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label
                  className="text-sm font-medium"
                  htmlFor={`${block.id}-expenseName`}
                >
                  Expense name
                </label>
                <Input
                  id={`${block.id}-expenseName`}
                  name="expenseName"
                  value={formState.expenseName ?? ""}
                  onChange={(event) =>
                    handleChange("expenseName", event.target.value)
                  }
                  disabled={isUpdating}
                />
              </div>
              {(formState.expenseType ?? "fixed") === "fixed" && (
                <>
                  <div className="flex flex-col gap-1">
                    <label
                      className="text-sm font-medium"
                      htmlFor={`${block.id}-monthlyCost`}
                    >
                      Monthly cost
                    </label>
                    <Input
                      id={`${block.id}-monthlyCost`}
                      name="monthlyCost"
                      type="number"
                      className="tabular-nums"
                      value={formState.monthlyCost ?? ""}
                      onChange={(event) =>
                        handleChange("monthlyCost", event.target.value)
                      }
                      disabled={isUpdating}
                      min={0}
                      step="any"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label
                      className="text-sm font-medium"
                      htmlFor={`${block.id}-annualGrowthRatePercent`}
                    >
                      Annual growth rate %
                    </label>
                    <Input
                      id={`${block.id}-annualGrowthRatePercent`}
                      name="annualGrowthRatePercent"
                      type="number"
                      className="tabular-nums"
                      value={formState.annualGrowthRatePercent ?? ""}
                      onChange={(event) =>
                        handleChange(
                          "annualGrowthRatePercent",
                          event.target.value
                        )
                      }
                      disabled={isUpdating}
                      min={0}
                      max={1}
                      step="any"
                    />
                  </div>
                </>
              )}
              {(formState.expenseType ?? "fixed") === "variable" && (
                <>
                  <div className="flex flex-col gap-1">
                    <label
                      className="text-sm font-medium"
                      htmlFor={`${block.id}-percentageOfRevenue`}
                    >
                      Percentage of Revenue
                    </label>
                    <span className="text-xs text-muted-foreground">
                      Decimal (e.g. 0.029 for 2.9%)
                    </span>
                    <Input
                      id={`${block.id}-percentageOfRevenue`}
                      name="percentageOfRevenue"
                      type="number"
                      className="tabular-nums"
                      value={formState.percentageOfRevenue ?? ""}
                      onChange={(event) =>
                        handleChange("percentageOfRevenue", event.target.value)
                      }
                      disabled={isUpdating}
                      min={0}
                      max={1}
                      step="any"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label
                      className="text-sm font-medium"
                      htmlFor={`${block.id}-fixedCostPerCustomer`}
                    >
                      Fixed cost per customer
                    </label>
                    <Input
                      id={`${block.id}-fixedCostPerCustomer`}
                      name="fixedCostPerCustomer"
                      type="number"
                      className="tabular-nums"
                      value={formState.fixedCostPerCustomer ?? ""}
                      onChange={(event) =>
                        handleChange("fixedCostPerCustomer", event.target.value)
                      }
                      disabled={isUpdating}
                      min={0}
                      step="any"
                    />
                  </div>
                </>
              )}
              {(formState.expenseType ?? "fixed") === "one-off" && (
                <>
                  <div className="flex flex-col gap-1">
                    <label
                      className="text-sm font-medium"
                      htmlFor={`${block.id}-opex-amount`}
                    >
                      Amount
                    </label>
                    <Input
                      id={`${block.id}-opex-amount`}
                      name="amount"
                      type="number"
                      className="tabular-nums"
                      value={formState.amount ?? ""}
                      onChange={(event) =>
                        handleChange("amount", event.target.value)
                      }
                      disabled={isUpdating}
                      min={0}
                      step="any"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label
                      className="text-sm font-medium"
                      htmlFor={`${block.id}-opex-month`}
                    >
                      Month
                    </label>
                    <Input
                      id={`${block.id}-opex-month`}
                      name="month"
                      type="month"
                      value={formState.month ?? ""}
                      onChange={(event) =>
                        handleChange("month", event.target.value)
                      }
                      disabled={isUpdating}
                    />
                  </div>
                </>
              )}
            </>
          )}

          {block.type === "Capital" && (
            <>
              <div className="flex flex-col gap-1">
                <label
                  className="text-sm font-medium"
                  htmlFor={`${block.id}-fundingType`}
                >
                  Funding type
                </label>
                <select
                  id={`${block.id}-fundingType`}
                  name="fundingType"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={formState.fundingType ?? "Equity"}
                  onChange={(event) =>
                    handleChange("fundingType", event.target.value)
                  }
                  disabled={isUpdating}
                >
                  <option value="Equity">Equity</option>
                  <option value="Debt">Debt</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label
                  className="text-sm font-medium"
                  htmlFor={`${block.id}-amount`}
                >
                  Amount
                </label>
                <Input
                  id={`${block.id}-amount`}
                  name="amount"
                  type="number"
                  className="tabular-nums"
                  value={formState.amount ?? ""}
                  onChange={(event) =>
                    handleChange("amount", event.target.value)
                  }
                  disabled={isUpdating}
                  min={0}
                  step="any"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label
                  className="text-sm font-medium"
                  htmlFor={`${block.id}-monthReceived`}
                >
                  Month received
                </label>
                <Input
                  id={`${block.id}-monthReceived`}
                  name="monthReceived"
                  type="month"
                  value={formState.monthReceived ?? ""}
                  onChange={(event) =>
                    handleChange("monthReceived", event.target.value)
                  }
                  disabled={isUpdating}
                />
              </div>
            </>
          )}

          {localError && (
            <p className="text-sm text-destructive" role="alert">
              {localError}
            </p>
          )}

          <div className="flex justify-end gap-2">
            {isNewBlockModal && onCancel && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCancel}
                disabled={isUpdating}
              >
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              size="sm"
              disabled={isUpdating}
              aria-busy={isUpdating}
            >
              {isUpdating && (
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden
                />
              )}
              {isUpdating ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
        ) : (
          <ReadOnlyCardContent
            block={block}
            formState={formState}
            allBlocks={allBlocks}
            newCustomersMode={newCustomersMode}
            newCustomersReferenceId={newCustomersReferenceId}
            isReadOnlyExpanded={isReadOnlyExpanded}
            onToggleExpanded={() => setIsReadOnlyExpanded((prev) => !prev)}
          />
        )}
      </CardContent>
    </Card>
  );
}


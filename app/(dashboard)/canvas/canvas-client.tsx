"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Pencil } from "lucide-react";
import type { BlockRecord, BlockType, NumericInputMode } from "../actions";
import {
  createBlockMutation,
  updateBlockMutation,
  updateBlockDependencyMutation,
  updateScenarioBlocksMutation,
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

const BLOCK_TYPES: BlockType[] = [
  "Personnel",
  "Revenue",
  "Marketing",
  "OpEx",
  "Capital",
];

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

      setBlocks((prev) => [...prev, result.block]);
    });
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
    </div>
  );
}

type BlockCardProps = {
  block: BlockRecord;
  allBlocks: BlockRecord[];
  onUpdated: (block: BlockRecord) => void;
  runWithRecalculation: <T>(fn: () => Promise<T>) => Promise<T>;
  showToast: (message: string) => void;
};

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

function BlockCard({
  block,
  allBlocks,
  onUpdated,
  runWithRecalculation,
  showToast,
}: BlockCardProps) {
  const [localError, setLocalError] = useState<string | null>(null);
  const [isUpdating, startUpdateTransition] = useTransition();
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
    Object.keys(initialPayload).length === 0
  );

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
      base.expenseName = String(initialPayload.expenseName ?? "");
      base.monthlyCost = String(initialPayload.monthlyCost ?? "");
      base.annualGrowthRatePercent = String(
        initialPayload.annualGrowthRatePercent ?? ""
      );
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
      setIsEditing(false);
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            {isEditing ? (
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
          <div className="flex items-center gap-2">
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
            <span className="text-xs font-medium text-muted-foreground">
              On/Off
            </span>
            <Switch
              checked={isActive}
              onCheckedChange={(checked) => void handleToggle(checked)}
              aria-label="Toggle block on or off"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isEditing ? (
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
                    {allBlocks.map((candidate) => {
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
                  Monthly MRR growth %
                </label>
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

          <div className="flex justify-end">
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
          <div className="flex flex-col gap-3">
            {block.type === "Personnel" && (
              <div className="flex flex-col gap-2">
                <ReadOnlyRow label="Role name" value={formState.roleName} />
                <ReadOnlyRow
                  label="Type"
                  value={
                    formState.roleType === "sales" ? "Sales" : "Standard"
                  }
                />
                {formState.roleType === "sales" && (
                  <>
                    <ReadOnlyRow
                      label="New clients per month (at full ramp)"
                      value={formState.salesClientsPerMonth}
                    />
                    <ReadOnlyRow
                      label="Months until first client"
                      value={formState.salesMonthsToFirstClient}
                    />
                  </>
                )}
                <ReadOnlyRow
                  label="Monthly gross salary"
                  value={formState.monthlyGrossSalary}
                />
                <ReadOnlyRow
                  label="Employer burden %"
                  value={formState.employerBurdenPercent}
                />
                <ReadOnlyRow label="Start month" value={formState.startMonth} />
                <ReadOnlyRow label="End month" value={formState.endMonth} />
                <ReadOnlyRow
                  label="Headcount count"
                  value={formState.headcountCount}
                />
              </div>
            )}
            {block.type === "Revenue" && (
              <div className="flex flex-col gap-2">
                <ReadOnlyRow label="Starting MRR" value={formState.startingMrr} />
                <ReadOnlyRow
                  label="New customers (source)"
                  value={
                    newCustomersMode === "Referenced" && newCustomersReferenceId
                      ? `From ${allBlocks.find((b) => b.id === newCustomersReferenceId)?.title ?? "block"}`
                      : formState.newCustomersStatic
                  }
                />
                <ReadOnlyRow label="ARPA" value={formState.arpa} />
                <ReadOnlyRow
                  label="Monthly churn %"
                  value={formState.monthlyChurnPercent}
                />
                <ReadOnlyRow
                  label="Monthly MRR growth %"
                  value={
                    formState.monthlyMrrGrowthPercent !== undefined &&
                    formState.monthlyMrrGrowthPercent !== ""
                      ? formState.monthlyMrrGrowthPercent
                      : "—"
                  }
                />
                <ReadOnlyRow
                  label="Billing frequency"
                  value={formState.billingFrequency}
                />
              </div>
            )}
            {block.type === "Marketing" && (
              <div className="flex flex-col gap-2">
                <ReadOnlyRow
                  label="Monthly ad spend"
                  value={formState.monthlyAdSpend}
                />
                <ReadOnlyRow label="Target CAC" value={formState.targetCac} />
                <ReadOnlyRow
                  label="Sales cycle lag (months)"
                  value={formState.salesCycleLagMonths}
                />
              </div>
            )}
            {block.type === "OpEx" && (
              <div className="flex flex-col gap-2">
                <ReadOnlyRow
                  label="Expense name"
                  value={formState.expenseName}
                />
                <ReadOnlyRow label="Monthly cost" value={formState.monthlyCost} />
                <ReadOnlyRow
                  label="Annual growth rate %"
                  value={formState.annualGrowthRatePercent}
                />
              </div>
            )}
            {block.type === "Capital" && (
              <div className="flex flex-col gap-2">
                <ReadOnlyRow
                  label="Funding type"
                  value={formState.fundingType}
                />
                <ReadOnlyRow label="Amount" value={formState.amount} />
                <ReadOnlyRow
                  label="Month received"
                  value={formState.monthReceived}
                />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


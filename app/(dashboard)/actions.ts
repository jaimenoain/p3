"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  BlockTypeSchema,
  getPayloadSchemaForType,
  NumericInputModeSchema,
  type BlockPayload,
  type BlockType,
  type NumericInputConfig,
} from "@/lib/block-schemas";
import {
  calculateFinancials,
  type BlockDTO,
  type FinancialTimeline,
} from "@/lib/financial-engine";

export type ProvisionResult = { ok: true } | { ok: false; error: string };

const CashBalanceSchema = z.object({
  value: z.coerce.number().min(0, "Must be 0 or greater"),
});

export type UpdateCashBalanceResult =
  | { ok: true }
  | { ok: false; error: string };

export type {
  BlockPayload,
  BlockType,
  CapitalPayload,
  NumericInputConfig,
  NumericInputMode,
  OpExPayload,
  PersonnelPayload,
  RevenuePayload,
} from "@/lib/block-schemas";

export type BlockRecord = {
  id: string;
  scenario_id: string;
  title: string | null;
  type: BlockType;
  is_active: boolean;
  payload: BlockPayload;
  created_at: string;
  updated_at: string;
};

export type GetScenarioBlocksResult =
  | { ok: true; scenarioId: string; blocks: BlockRecord[] }
  | { ok: false; error: string };

export type CreateBlockResult =
  | { ok: true; block: BlockRecord }
  | { ok: false; error: string };

export type UpdateBlockResult =
  | { ok: true; block: BlockRecord }
  | { ok: false; error: string };

export type UpdateBlockDependencyResult =
  | { ok: true; block: BlockRecord }
  | { ok: false; error: string };

export type UpdateScenarioBlocksResult =
  | { ok: true; block: BlockRecord }
  | { ok: false; error: string };

export type DeleteBlockResult = { ok: true } | { ok: false; error: string };

/** Scenario plus computed 12-month financial timeline (DOMAIN_MODEL ScenarioDTO + financials). */
export type GetScenarioFinancialsResult =
  | {
      ok: true;
      scenarioId: string;
      name: string;
      globalAssumptions: Record<string, unknown>;
      blocks: BlockDTO[];
      financialTimeline: FinancialTimeline;
    }
  | { ok: false; error: string };

type PayloadWithDependencies = {
  dependencies?: Record<string, NumericInputConfig>;
  [key: string]: unknown;
};

/**
 * Ensures the authenticated user has a default tenant: one Organization, membership as owner,
 * one Workspace, and one baseline Scenario. Idempotent: if already provisioned, returns success.
 * Uses provision_tenant RPC (SECURITY DEFINER) so inserts bypass RLS and run atomically.
 */
export async function provisionTenantAction(): Promise<ProvisionResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: "Not authenticated." };
  }

  const userId = user.id;

  const { data: existingMember } = await supabase
    .from("organization_members")
    .select("id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (existingMember) {
    return { ok: true };
  }

  const { error } = await supabase.rpc("provision_tenant", {
    new_user_id: userId,
    org_name: "My Startup",
    workspace_name: "Primary Workspace",
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

/**
 * Updates the starting_cash_balance on the user's workspace. Form must include hidden field
 * "workspaceId". RLS ensures the user can only update workspaces in their organization.
 */
export async function updateWorkspaceCashBalanceAction(
  _prev: unknown,
  formData: FormData
): Promise<UpdateCashBalanceResult> {
  const workspaceId = formData.get("workspaceId");
  if (typeof workspaceId !== "string" || !workspaceId.trim()) {
    return { ok: false, error: "Workspace is required." };
  }

  const raw = formData.get("value") ?? formData.get("startingCashBalance") ?? "";
  const parsed = CashBalanceSchema.safeParse({ value: raw });
  if (!parsed.success) {
    const msg = parsed.error.flatten().formErrors[0] ?? parsed.error.message;
    return { ok: false, error: typeof msg === "string" ? msg : "Invalid amount." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { ok: false, error: "Not authenticated." };
  }

  const { error } = await supabase
    .from("workspaces")
    .update({ starting_cash_balance: parsed.data.value })
    .eq("id", workspaceId.trim());

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard");
  return { ok: true };
}

async function resolveDefaultScenarioId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string | undefined> {
  const { data: member, error: memberError } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (memberError || !member?.organization_id) {
    return undefined;
  }

  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("id")
    .eq("organization_id", member.organization_id)
    .limit(1)
    .maybeSingle();

  if (workspaceError || !workspace?.id) {
    return undefined;
  }

  const { data: scenario, error: scenarioError } = await supabase
    .from("scenarios")
    .select("id")
    .eq("workspace_id", workspace.id)
    .eq("is_active_baseline", true)
    .limit(1)
    .maybeSingle();

  if (scenarioError || !scenario?.id) {
    return undefined;
  }

  return scenario.id;
}

export async function getScenarioBlocksAction(
  scenarioId?: string
): Promise<GetScenarioBlocksResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: "Not authenticated." };
  }

  let effectiveScenarioId = scenarioId;
  if (!effectiveScenarioId) {
    effectiveScenarioId = await resolveDefaultScenarioId(supabase, user.id);
    if (!effectiveScenarioId) {
      return { ok: false, error: "No active scenario found for this workspace." };
    }
  }

  const { data, error } = await supabase
    .from("blocks")
    .select("id, scenario_id, title, type, is_active, payload, created_at, updated_at")
    .eq("scenario_id", effectiveScenarioId)
    .order("created_at", { ascending: true });

  if (error) {
    return { ok: false, error: error.message };
  }

  return {
    ok: true,
    scenarioId: effectiveScenarioId,
    blocks: (data ?? []) as BlockRecord[],
  };
}

const GetScenarioFinancialsInputSchema = z.object({
  scenarioId: z.string().uuid().optional(),
});

/**
 * Fetches scenario, workspace starting cash, and active blocks; runs the financial
 * engine to produce a 12-month timeline (MRR, cash in/out, net burn, ending cash).
 * When scenarioId is omitted, uses the authenticated user's active baseline scenario.
 * RLS on workspaces, scenarios, and blocks enforces tenant isolation.
 */
export async function getScenarioFinancials(
  scenarioId?: string
): Promise<GetScenarioFinancialsResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: "Not authenticated." };
  }

  let effectiveScenarioId = scenarioId;
  if (!effectiveScenarioId) {
    effectiveScenarioId = await resolveDefaultScenarioId(supabase, user.id);
    if (!effectiveScenarioId) {
      return { ok: false, error: "No active scenario found for this workspace." };
    }
  } else {
    const parsed = GetScenarioFinancialsInputSchema.safeParse({ scenarioId: effectiveScenarioId });
    if (!parsed.success) {
      return { ok: false, error: "Invalid scenario id." };
    }
  }

  const { data: scenario, error: scenarioError } = await supabase
    .from("scenarios")
    .select("id, workspace_id, name, global_assumptions")
    .eq("id", effectiveScenarioId)
    .maybeSingle();

  if (scenarioError || !scenario) {
    return { ok: false, error: "Scenario not found or access denied." };
  }

  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("starting_cash_balance")
    .eq("id", scenario.workspace_id)
    .maybeSingle();

  if (workspaceError || !workspace) {
    return { ok: false, error: "Workspace not found or access denied." };
  }

  const startingCash = Number(workspace.starting_cash_balance);
  const safeStartingCash = Number.isFinite(startingCash) && startingCash >= 0 ? startingCash : 0;

  const { data: blocksData, error: blocksError } = await supabase
    .from("blocks")
    .select("id, type, is_active, title, payload")
    .eq("scenario_id", effectiveScenarioId)
    .order("created_at", { ascending: true });

  if (blocksError) {
    return { ok: false, error: "Failed to load blocks." };
  }

  const blocks: BlockDTO[] = (blocksData ?? []).map((row) => ({
    blockId: row.id,
    type: row.type as BlockDTO["type"],
    isActive: row.is_active ?? true,
    title: row.title ?? null,
    properties: (row.payload as Record<string, unknown>) ?? {},
  }));

  const financialTimeline = calculateFinancials(safeStartingCash, blocks);

  const globalAssumptions =
    (scenario.global_assumptions as Record<string, unknown>) ?? {};

  return {
    ok: true,
    scenarioId: scenario.id,
    name: scenario.name,
    globalAssumptions,
    blocks,
    financialTimeline,
  };
}

const CreateBlockInputSchema = z.object({
  scenarioId: z.string().uuid().optional(),
  type: BlockTypeSchema,
});

export async function createBlockMutation(
  input: z.infer<typeof CreateBlockInputSchema>
): Promise<CreateBlockResult> {
  const parsed = CreateBlockInputSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors.type?.[0] ?? "Invalid block input.";
    return { ok: false, error: msg };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: "Not authenticated." };
  }

  let effectiveScenarioId = parsed.data.scenarioId;
  if (!effectiveScenarioId) {
    effectiveScenarioId = await resolveDefaultScenarioId(supabase, user.id);
    if (!effectiveScenarioId) {
      return { ok: false, error: "No active scenario found for this workspace." };
    }
  }

  const id = randomUUID();

  const { data, error } = await supabase
    .from("blocks")
    .insert({
      id,
      scenario_id: effectiveScenarioId,
      type: parsed.data.type,
      title: parsed.data.type,
      is_active: true,
      payload: {},
    })
    .select("id, scenario_id, title, type, is_active, payload, created_at, updated_at")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Unable to create block." };
  }

  revalidatePath("/canvas");

  return {
    ok: true,
    block: data as BlockRecord,
  };
}

const UpdateBlockInputSchema = z.object({
  blockId: z.string().uuid(),
  title: z.string().min(1).max(120).optional(),
  payload: z.record(z.string(), z.unknown()),
});

/**
 * Minimal default payload per block type so dependency-only updates validate
 * when the block has never been saved (payload is empty).
 */
function getDefaultPayloadForDependencyUpdate(type: BlockType): Record<string, unknown> {
  switch (type) {
    case "Revenue":
      return {
        startingMrr: 0,
        arpa: 0,
        monthlyChurnPercent: 0,
        billingFrequency: "Monthly",
      };
    case "Personnel":
      return {
        roleName: "Role",
        monthlyGrossSalary: 0,
        employerBurdenPercent: 0,
        startMonth: "2020-01",
        headcountCount: 1,
        roleType: "standard",
      };
    case "Marketing":
      return {
        monthlyAdSpend: 0,
        targetCac: 0,
        salesCycleLagMonths: 0,
      };
    case "OpEx":
      return {
        expenseType: "fixed",
        expenseName: "Expense",
        monthlyCost: 0,
        annualGrowthRatePercent: 0,
      };
    case "Capital":
      return {
        fundingType: "Equity",
        amount: 0,
        monthReceived: "2020-01",
      };
    default:
      return {};
  }
}

const UpdateBlockDependencyInputSchema = z.object({
  blockId: z.string().uuid(),
  field: z.string().min(1),
  mode: NumericInputModeSchema,
  referenceId: z.string().uuid().optional(),
  formula: z.string().optional(),
  value: z.number().optional(),
});

const UpdateScenarioBlocksInputSchema = z.object({
  blockId: z.string().uuid(),
  isActive: z.boolean(),
});

export async function updateBlockMutation(
  input: z.infer<typeof UpdateBlockInputSchema>
): Promise<UpdateBlockResult> {
  const parsed = UpdateBlockInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid block update payload." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: "Not authenticated." };
  }

  // Verify access to the underlying workspace via RLS on blocks:
  // if the block is not visible under current RLS, this select will fail.
  const {
    data: existingBlock,
    error: blockError,
  } = await supabase
    .from("blocks")
    .select("id, scenario_id, title, type")
    .eq("id", parsed.data.blockId)
    .maybeSingle();

  if (blockError || !existingBlock) {
    return { ok: false, error: "Block not found or access denied." };
  }

  const payloadSchema = getPayloadSchemaForType(existingBlock.type);
  const payloadResult = payloadSchema.safeParse(parsed.data.payload);

  if (!payloadResult.success) {
    const formatted = payloadResult.error.flatten();
    const message =
      formatted.formErrors[0] ??
      Object.values(formatted.fieldErrors)[0]?.[0] ??
      "Invalid block properties.";
    return {
      ok: false,
      error: typeof message === "string" ? message : "Invalid block properties.",
    };
  }

  const { data, error } = await supabase
    .from("blocks")
    .update({
      ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
      payload: payloadResult.data as BlockPayload,
    })
    .eq("id", existingBlock.id)
    .select("id, scenario_id, title, type, is_active, payload, created_at, updated_at")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Unable to update block." };
  }

  revalidatePath("/canvas");

  return {
    ok: true,
    block: data as BlockRecord,
  };
}

function buildDependencyGraphFromBlocks(
  blocks: { id: string; type: BlockType; payload: unknown }[]
) {
  const edges = new Map<string, Set<string>>();

  for (const block of blocks) {
    const payloadSchema = getPayloadSchemaForType(block.type);
    const parsed = payloadSchema.safeParse(block.payload ?? {});
    const payload: PayloadWithDependencies = parsed.success
      ? parsed.data
      : {};
    const dependencies = payload.dependencies ?? {};

    for (const cfg of Object.values(dependencies)) {
      if (cfg && cfg.mode === "Referenced" && cfg.referenceId) {
        if (!edges.has(block.id)) {
          edges.set(block.id, new Set<string>());
        }
        edges.get(block.id)!.add(cfg.referenceId);
      }
    }
  }

  return edges;
}

function wouldCreateCycle(
  edges: Map<string, Set<string>>,
  fromId: string,
  toId: string
) {
  if (fromId === toId) {
    return true;
  }

  const visited = new Set<string>();
  const stack: string[] = [toId];

  while (stack.length > 0) {
    const current = stack.pop() as string;
    if (current === fromId) {
      return true;
    }
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);
    const neighbors = edges.get(current);
    if (neighbors) {
      for (const neighbor of neighbors) {
        stack.push(neighbor);
      }
    }
  }

  return false;
}

export async function updateBlockDependencyMutation(
  input: z.infer<typeof UpdateBlockDependencyInputSchema>
): Promise<UpdateBlockDependencyResult> {
  const parsedInput = UpdateBlockDependencyInputSchema.safeParse(input);
  if (!parsedInput.success) {
    return { ok: false, error: "Invalid dependency update." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: "Not authenticated." };
  }

  const { blockId, field, mode, referenceId, formula, value } =
    parsedInput.data;

  const {
    data: currentBlock,
    error: blockError,
  } = await supabase
    .from("blocks")
    .select("id, scenario_id, type, payload")
    .eq("id", blockId)
    .maybeSingle();

  if (blockError || !currentBlock) {
    return { ok: false, error: "Block not found or access denied." };
  }

  const payloadSchema = getPayloadSchemaForType(currentBlock.type as BlockType);
  const parsedPayload = payloadSchema.safeParse(currentBlock.payload ?? {});
  const basePayload: PayloadWithDependencies = parsedPayload.success
    ? parsedPayload.data
    : {};

  const {
    data: allBlocks,
    error: allBlocksError,
  } = await supabase
    .from("blocks")
    .select("id, type, payload")
    .eq("scenario_id", currentBlock.scenario_id);

  if (allBlocksError || !allBlocks) {
    return { ok: false, error: "Unable to validate dependencies." };
  }

  const edges = buildDependencyGraphFromBlocks(
    allBlocks as { id: string; type: BlockType; payload: unknown }[]
  );

  // Remove any existing edge for this field on this block.
  const existingDeps =
    (basePayload.dependencies as Record<string, NumericInputConfig> | undefined) ??
    {};
  const existingCfg = existingDeps[field];
  if (
    existingCfg &&
    existingCfg.mode === "Referenced" &&
    existingCfg.referenceId
  ) {
    const neighbors = edges.get(currentBlock.id);
    if (neighbors) {
      neighbors.delete(existingCfg.referenceId);
    }
  }

  if (mode === "Referenced" && referenceId) {
    if (wouldCreateCycle(edges, currentBlock.id, referenceId)) {
      return {
        ok: false,
        error: "Circular dependency detected. This connection is not allowed.",
      };
    }
  }

  const nextConfig: NumericInputConfig = {
    mode,
    ...(typeof value === "number" ? { value } : {}),
    ...(referenceId ? { referenceId } : {}),
    ...(formula ? { formula } : {}),
  };

  const nextDeps: Record<string, NumericInputConfig> = {
    ...existingDeps,
    [field]: nextConfig,
  };

  // For new blocks, basePayload may be empty so validation would fail (e.g. Revenue
  // requires startingMrr, arpa, etc.; z.coerce.number() on undefined yields NaN).
  // Merge type-specific defaults so dependency-only updates validate.
  const defaults =
    Object.keys(basePayload).length === 0
      ? getDefaultPayloadForDependencyUpdate(currentBlock.type as BlockType)
      : {};
  const nextPayload = {
    ...defaults,
    ...basePayload,
    dependencies: nextDeps,
  };

  const validatedPayload = payloadSchema.safeParse(nextPayload);
  if (!validatedPayload.success) {
    const formatted = validatedPayload.error.flatten();
    const message =
      formatted.formErrors[0] ??
      Object.values(formatted.fieldErrors)[0]?.[0] ??
      "Unable to update dependency. Please make sure all required fields for this block are filled out and saved, then try again.";

    return {
      ok: false,
      error:
        typeof message === "string"
          ? message
          : "Unable to update dependency. Please make sure all required fields for this block are filled out and saved, then try again.",
    };
  }

  const { data, error } = await supabase
    .from("blocks")
    .update({
      payload: validatedPayload.data as BlockPayload,
    })
    .eq("id", currentBlock.id)
    .select("id, scenario_id, type, is_active, payload, created_at, updated_at")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Unable to update block." };
  }

  // Placeholder hook for invoking the 30/360-based engine in this authenticated session.
  // The actual monthly cashflow calculations will consume the updated dependencies.

  revalidatePath("/canvas");

  return {
    ok: true,
    block: data as BlockRecord,
  };
}

export async function updateScenarioBlocksMutation(
  input: z.infer<typeof UpdateScenarioBlocksInputSchema>
): Promise<UpdateScenarioBlocksResult> {
  const parsed = UpdateScenarioBlocksInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid block toggle." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: "Not authenticated." };
  }

  const { blockId, isActive } = parsed.data;

  const {
    data: existingBlock,
    error: blockError,
  } = await supabase
    .from("blocks")
    .select("id, scenario_id")
    .eq("id", blockId)
    .maybeSingle();

  if (blockError || !existingBlock) {
    return { ok: false, error: "Block not found or access denied." };
  }

  const { data, error } = await supabase
    .from("blocks")
    .update({ is_active: isActive })
    .eq("id", existingBlock.id)
    .select("id, scenario_id, type, is_active, payload, created_at, updated_at")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Unable to toggle block." };
  }

  // Placeholder: the projection engine will treat inactive blocks as having zero
  // financial impact when computing scenario outputs.

  revalidatePath("/canvas");

  return {
    ok: true,
    block: data as BlockRecord,
  };
}

const DeleteBlockInputSchema = z.object({
  blockId: z.string().uuid(),
});

export async function deleteBlockMutation(
  input: z.infer<typeof DeleteBlockInputSchema>
): Promise<DeleteBlockResult> {
  const parsed = DeleteBlockInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid block id." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: "Not authenticated." };
  }

  const { blockId } = parsed.data;

  const {
    data: existingBlock,
    error: selectError,
  } = await supabase
    .from("blocks")
    .select("id")
    .eq("id", blockId)
    .maybeSingle();

  if (selectError || !existingBlock) {
    return { ok: false, error: "Block not found or access denied." };
  }

  const { error } = await supabase.from("blocks").delete().eq("id", blockId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/canvas");
  return { ok: true };
}

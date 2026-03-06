"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type ProvisionResult = { ok: true } | { ok: false; error: string };

const CashBalanceSchema = z.object({
  value: z.coerce.number().min(0, "Must be 0 or greater"),
});

export type UpdateCashBalanceResult =
  | { ok: true }
  | { ok: false; error: string };

const BlockTypeSchema = z.enum([
  "Personnel",
  "Revenue",
  "Marketing",
  "OpEx",
  "Capital",
]);

export type BlockType = z.infer<typeof BlockTypeSchema>;

const MonthStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "Month must be in YYYY-MM format");

const NumericInputModeSchema = z.enum(["Static", "Referenced", "Formula"]);

const NumericInputConfigSchema = z.object({
  mode: NumericInputModeSchema,
  value: z.number().optional(),
  referenceId: z.string().uuid().optional(),
  formula: z.string().optional(),
});

export type NumericInputMode = z.infer<typeof NumericInputModeSchema>;
export type NumericInputConfig = z.infer<typeof NumericInputConfigSchema>;

const BlockDependenciesSchema = z.object({
  dependencies: z
    .record(z.string(), NumericInputConfigSchema)
    .optional(),
});

const PersonnelRoleTypeSchema = z.enum(["standard", "sales"]);

const PersonnelPayloadSchema = z
  .object({
    roleName: z.string().min(1, "Role name is required"),
    monthlyGrossSalary: z
      .coerce.number()
      .min(0, "Monthly gross salary must be 0 or greater"),
    employerBurdenPercent: z
      .coerce.number()
      .min(0, "Employer burden % must be between 0 and 1")
      .max(1, "Employer burden % must be between 0 and 1"),
    startMonth: MonthStringSchema,
    endMonth: MonthStringSchema.optional().nullable(),
    headcountCount: z
      .coerce.number()
      .int("Headcount must be an integer")
      .min(1, "Headcount must be at least 1"),
    roleType: PersonnelRoleTypeSchema.optional().default("standard"),
    salesClientsPerMonth: z
      .union([
        z.coerce
          .number()
          .min(0, "New clients per month must be 0 or greater"),
        z.null(),
      ])
      .optional(),
    salesMonthsToFirstClient: z
      .union([
        z.coerce
          .number()
          .int("Months until first client must be an integer")
          .min(0, "Months until first client cannot be negative"),
        z.null(),
      ])
      .optional(),
  })
  .merge(BlockDependenciesSchema);

const BillingFrequencySchema = z.enum(["Monthly", "Annual Prepaid"]);

const RevenuePayloadSchema = z
  .object({
  startingMrr: z
    .coerce.number()
    .min(0, "Starting MRR must be 0 or greater"),
  arpa: z.coerce.number().min(0, "ARPA must be 0 or greater"),
  monthlyChurnPercent: z
    .coerce.number()
    .min(0, "Monthly churn % must be between 0 and 1")
    .max(1, "Monthly churn % must be between 0 and 1"),
  monthlyMrrGrowthPercent: z
    .union([
      z
        .coerce.number()
        .min(0, "Monthly MRR growth % must be between 0 and 1")
        .max(1, "Monthly MRR growth % must be between 0 and 1"),
      z.null(),
    ])
    .optional(),
  billingFrequency: BillingFrequencySchema,
})
  .merge(BlockDependenciesSchema);

const MarketingPayloadSchema = z
  .object({
  monthlyAdSpend: z
    .coerce.number()
    .min(0, "Monthly ad spend must be 0 or greater"),
  targetCac: z
    .coerce.number()
    .min(0, "Target CAC must be 0 or greater"),
  salesCycleLagMonths: z
    .coerce.number()
    .int("Sales cycle lag must be an integer number of months")
    .min(0, "Sales cycle lag cannot be negative"),
})
  .merge(BlockDependenciesSchema);

const OpExPayloadSchema = z
  .object({
  expenseName: z.string().min(1, "Expense name is required"),
  monthlyCost: z
    .coerce.number()
    .min(0, "Monthly cost must be 0 or greater"),
  annualGrowthRatePercent: z
    .coerce.number()
    .min(0, "Annual growth rate % must be between 0 and 1")
    .max(1, "Annual growth rate % must be between 0 and 1"),
})
  .merge(BlockDependenciesSchema);

const FundingTypeSchema = z.enum(["Equity", "Debt"]);

const CapitalPayloadSchema = z
  .object({
  fundingType: FundingTypeSchema,
  amount: z.coerce.number().min(0, "Amount must be 0 or greater"),
  monthReceived: MonthStringSchema,
})
  .merge(BlockDependenciesSchema);

export type PersonnelPayload = z.infer<typeof PersonnelPayloadSchema>;
export type RevenuePayload = z.infer<typeof RevenuePayloadSchema>;
export type MarketingPayload = z.infer<typeof MarketingPayloadSchema>;
export type OpExPayload = z.infer<typeof OpExPayloadSchema>;
export type CapitalPayload = z.infer<typeof CapitalPayloadSchema>;

export type BlockPayload =
  | PersonnelPayload
  | RevenuePayload
  | MarketingPayload
  | OpExPayload
  | CapitalPayload;

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
  payload: z.record(z.string(), z.any()),
});

function getPayloadSchemaForType(type: BlockType) {
  switch (type) {
    case "Personnel":
      return PersonnelPayloadSchema;
    case "Revenue":
      return RevenuePayloadSchema;
    case "Marketing":
      return MarketingPayloadSchema;
    case "OpEx":
      return OpExPayloadSchema;
    case "Capital":
      return CapitalPayloadSchema;
    default:
      return PersonnelPayloadSchema;
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

  const nextPayload = {
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

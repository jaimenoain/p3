"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type ProvisionResult = { ok: true } | { ok: false; error: string };

const CashBalanceSchema = z.object({
  value: z.coerce.number().min(0, "Must be 0 or greater"),
});

export type UpdateCashBalanceResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Ensures the authenticated user has a default tenant: one Organization, membership as owner,
 * one Workspace, and one baseline Scenario. Idempotent: if already provisioned, returns success.
 * RLS: organization_members.user_id must match the current auth user.
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

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({ name: "My Startup" })
    .select("id")
    .single();

  if (orgError || !org) {
    return { ok: false, error: orgError?.message ?? "Failed to create organization." };
  }

  const { error: memberError } = await supabase.from("organization_members").insert({
    organization_id: org.id,
    user_id: userId,
    role: "owner",
  });

  if (memberError) {
    return { ok: false, error: memberError.message };
  }

  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .insert({
      organization_id: org.id,
      name: "Primary Workspace",
      starting_cash_balance: null,
    })
    .select("id")
    .single();

  if (workspaceError || !workspace) {
    return { ok: false, error: workspaceError?.message ?? "Failed to create workspace." };
  }

  const { error: scenarioError } = await supabase.from("scenarios").insert({
    workspace_id: workspace.id,
    name: "Baseline",
    is_active_baseline: true,
    global_assumptions: {},
  });

  if (scenarioError) {
    return { ok: false, error: scenarioError.message };
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
  return { ok: true };
}

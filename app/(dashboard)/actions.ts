"use server";

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

/**
 * Phase 5 RLS/trigger verification: confirms the database trigger
 * prevent_historical_records_mutation_when_closed blocks INSERT into
 * historical_records when the parent monthly_periods.status is 'Closed'.
 *
 * Run: npx tsx test/verify_phase5_rls.ts
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (to create a Closed period and attempt insert).
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.log(
    "Phase 5 trigger verification SKIPPED (set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to run against DB)."
  );
  process.exit(0);
}

const supabase = createClient(url, serviceRoleKey);

async function verifyClosedPeriodTrigger() {
  let periodId: string | null = null;

  try {
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (!workspace?.id) {
      console.error("No workspace found; create a workspace first (e.g. via app provisioning).");
      process.exit(1);
    }

    const { data: period, error: insertPeriodError } = await supabase
      .from("monthly_periods")
      .insert({
        workspace_id: workspace.id,
        calendar_month: "2099-12-01",
        status: "Closed",
        ignore_variance: false,
      })
      .select("id")
      .single();

    if (insertPeriodError || !period?.id) {
      if (insertPeriodError?.code === "23505") {
        const { data: existing } = await supabase
          .from("monthly_periods")
          .select("id")
          .eq("workspace_id", workspace.id)
          .eq("calendar_month", "2099-12-01")
          .eq("status", "Closed")
          .maybeSingle();
        periodId = existing?.id ?? null;
        if (!periodId) {
          console.error("Unique violation but could not find existing period:", insertPeriodError.message);
          process.exit(1);
        }
      } else {
        console.error("Failed to create Closed period:", insertPeriodError?.message ?? "unknown");
        process.exit(1);
      }
    } else {
      periodId = period.id;
    }

    const { error: insertRecordError } = await supabase.from("historical_records").insert({
      monthly_period_id: periodId,
      account_id: null,
      transaction_date: "2099-12-15",
      amount: 0,
      description: "Phase 5 trigger test",
      is_duplicate_quarantined: false,
    });

    if (!insertRecordError) {
      console.error("FAIL: Insert into historical_records should have been blocked by trigger when period is Closed.");
      process.exit(1);
    }

    const msg = insertRecordError.message;
    if (!msg.includes("Closed") && !msg.includes("monthly period")) {
      console.error("FAIL: Expected trigger message about Closed period. Got:", msg);
      process.exit(1);
    }

    console.log("Phase 5 trigger verification: PASSED.");
    console.log("The database correctly blocks INSERT into historical_records when monthly_periods.status is 'Closed'.");
  } finally {
    if (periodId) {
      await supabase.from("monthly_periods").delete().eq("id", periodId);
    }
  }
}

verifyClosedPeriodTrigger().catch((err) => {
  console.error(err);
  process.exit(1);
});

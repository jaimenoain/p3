"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateWorkspaceCashBalanceAction, type UpdateCashBalanceResult } from "./actions";

type Props = { workspaceId: string };

export function CashBalancePrompt({ workspaceId }: Props) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(updateWorkspaceCashBalanceAction, null as UpdateCashBalanceResult | null);

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
    }
  }, [state?.ok, router]);

  return (
    <Dialog open>
      <DialogContent
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>Starting cash balance</DialogTitle>
          <DialogDescription>
            Enter your current cash balance to ground your financial model. You can change this later in settings.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <div className="space-y-2">
            <label htmlFor="cash-balance" className="text-sm font-medium">
              Cash balance
            </label>
            <Input
              id="cash-balance"
              name="value"
              type="number"
              min={0}
              step="any"
              placeholder="0.00"
              className="tabular-nums"
              required
              autoComplete="off"
            />
          </div>
          {state && !state.ok && (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" className="w-full sm:w-auto" disabled={isPending}>
              {isPending ? "Saving..." : "Save Cash Balance"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

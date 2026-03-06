"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { forgotPasswordAction, type ActionResult } from "./actions";

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(forgotPasswordAction, null as ActionResult | null);

  return (
    <div className="w-full max-w-sm space-y-6 rounded-lg border border-border bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold tracking-tight">Forgot password</h1>
      {state?.success ? (
        <p className="text-sm text-muted-foreground">
          If an account exists for that email, we&apos;ve sent a reset link.
        </p>
      ) : (
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
              autoComplete="email"
              className="w-full"
            />
          </div>
          {state?.error && (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          )}
          <Button type="submit" className="w-full">
            Send reset link
          </Button>
        </form>
      )}
      <p className="text-center text-sm">
        <Link href="/login" className="text-muted-foreground underline-offset-4 hover:underline">
          Back to log in
        </Link>
      </p>
    </div>
  );
}

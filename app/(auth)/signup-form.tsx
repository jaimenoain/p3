"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signUpAction, type ActionResult } from "./actions";

export function SignUpForm() {
  const [state, formAction] = useActionState(signUpAction, null as ActionResult | null);

  return (
    <div className="w-full max-w-sm space-y-6 rounded-lg border border-border bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold tracking-tight">Sign up</h1>
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
        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="new-password"
            minLength={6}
            className="w-full"
          />
        </div>
        {state?.error && (
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
        )}
        <Button type="submit" className="w-full">
          Sign up
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}

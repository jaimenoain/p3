"use server";

import { createClient } from "@/lib/supabase/server";

export type ActionResult = { error?: string; success?: boolean; redirectTo?: string };

/** Base URL for auth redirects (e.g. confirmation, password reset). Must be set in production so email links point to the app, not localhost. */
function getAuthRedirectBase(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return raw.trim().replace(/\/$/, "");
}

export async function loginAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const email = formData.get("email") as string | null;
  const password = formData.get("password") as string | null;
  if (!email?.trim() || !password) {
    return { error: "Email and password are required." };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) {
    return { error: "Invalid email or password." };
  }
  // Return success and let the client redirect to avoid "unexpected response" errors
  // when the Server Action redirect is altered by proxies (e.g. Amplify).
  return { success: true, redirectTo: "/dashboard" };
}

export async function signUpAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const email = formData.get("email") as string | null;
  const password = formData.get("password") as string | null;
  if (!email?.trim() || !password) {
    return { error: "Email and password are required." };
  }
  const base = getAuthRedirectBase();
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    ...(base && { options: { emailRedirectTo: `${base}/login` } }),
  });
  // Data contract (pending): ensure a corresponding User row is created via DB trigger or
  // post-signup hook in the upcoming database schema phase. Code is prepped; no client changes needed.
  if (error) {
    return { error: error.message };
  }
  return { success: true, redirectTo: "/login" };
}

export async function forgotPasswordAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const email = formData.get("email") as string | null;
  if (!email?.trim()) {
    return { error: "Email is required." };
  }
  const base = getAuthRedirectBase();
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    ...(base && { redirectTo: `${base}/login` }),
  });
  if (error) {
    return { error: error.message };
  }
  return { success: true };
}

export async function logoutAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Server Action signature for useActionState
  _prev: unknown,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Server Action signature for useActionState
  _formData?: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return { success: true, redirectTo: "/login" };
}

"use server";

import { createClient } from "@/lib/supabase/server";

export type ActionResult = { error?: string; success?: boolean; redirectTo?: string };

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
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/login` },
  });
  // Data contract: ensure a corresponding User row is created (DB trigger or post-signup hook).
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
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/login`,
  });
  if (error) {
    return { error: error.message };
  }
  return { success: true };
}

export async function logoutAction(
  _prev: unknown,
  _formData?: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return { success: true, redirectTo: "/login" };
}

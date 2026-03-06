/**
 * Task 1.2 — Supabase clients, middleware, auth UI verification (TDD Lite).
 * Runnable equivalent: test/verify_task_1_2.mjs (run with: node test/verify_task_1_2.mjs)
 *
 * Asserts:
 * - lib/supabase/server.ts and lib/supabase/client.ts exist
 * - Next.js middleware.ts at src/ root (or project root) protects /dashboard and /settings
 * - Login, Sign Up, and Forgot Password UI exist in app/(auth) (login, signup, forgot-password pages/components)
 */

export const TASK_1_2_REQUIREMENTS = {
  supabase: {
    server: "lib/supabase/server.ts",
    client: "lib/supabase/client.ts",
  },
  middleware: {
    path: "src/middleware.ts or middleware.ts",
    protectedRoutes: ["/dashboard", "/settings"],
  },
  authUi: {
    login: "(auth)/login (page or component)",
    signUp: "(auth)/signup (page or component)",
    forgotPassword: "(auth)/forgot-password (page or component)",
  },
} as const;

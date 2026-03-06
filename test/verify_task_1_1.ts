/**
 * Task 1.1 — Layout shell & navigation verification (TDD Lite).
 * Runnable equivalent: test/verify_task_1_1.mjs (run with: node test/verify_task_1_1.mjs)
 *
 * Asserts:
 * - (auth)/layout.tsx: default export, items-center, justify-center, h-screen, renders children
 * - (dashboard)/layout.tsx: default export, Sidebar with Links to /dashboard, /assets, /airlock,
 *   /vault, /governance, /settings, and Logout placeholder; renders children.
 */

// This file documents the verification contract. Execute test/verify_task_1_1.mjs for assertions.

export const TASK_1_1_REQUIREMENTS = {
  authLayout: {
    flexCentered: ["items-center", "justify-center", "h-screen"],
    rendersChildren: true,
  },
  dashboardLayout: {
    hasSidebar: true,
    links: ["/dashboard", "/assets", "/airlock", "/vault", "/governance", "/settings"],
    hasLogoutPlaceholder: true,
    rendersChildren: true,
  },
} as const;

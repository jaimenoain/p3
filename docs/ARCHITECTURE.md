# Architecture

## Phase 1: Walking Skeleton (Baseline)

Phase 1 delivers a minimal end-to-end slice: public landing, auth flows, protected dashboard shell, and guest route. The app uses the Next.js App Router with route groups; session is enforced by middleware and React context.

### App router structure (as implemented)

```
app/
├── layout.tsx                 # Root: fonts, AuthProvider, globals
├── page.tsx                   # Landing / (teaser)
├── globals.css
├── favicon.ico
├── (auth)/
│   ├── layout.tsx             # Centered full-screen shell (bg-slate-50)
│   ├── login/page.tsx         # /login
│   ├── signup/page.tsx        # /signup
│   ├── forgot-password/page.tsx  # /forgot-password
│   ├── login-form.tsx         # Client form + useActionState
│   ├── signup-form.tsx
│   ├── forgot-password-form.tsx
│   └── actions.ts             # Server Actions (Supabase auth)
├── (dashboard)/
│   ├── layout.tsx             # Sidebar + header + main content area
│   ├── dashboard/page.tsx     # /dashboard
│   ├── assets/page.tsx        # /assets
│   ├── airlock/page.tsx       # /airlock
│   ├── vault/page.tsx         # /vault
│   ├── governance/page.tsx    # /governance
│   └── settings/page.tsx      # /settings
└── (guest)/
    ├── layout.tsx
    └── guest/view/page.tsx    # /guest/view
```

### Key implementation details

- **Middleware** (`middleware.ts`): Supabase server client; protects dashboard and reserved application prefixes (`/dashboard`, `/canvas`, `/import`, `/actuals`, `/settings`, `/assets`, `/airlock`, `/vault`, `/governance`) plus guest routes (`/guest`); redirects unauthenticated users to `/login`; redirects authenticated users from `/` or `/login` to `/dashboard`.
- **AuthProvider** (`components/auth-provider.tsx`): Wraps root layout; exposes `session` and `isLoading` via React Context (`useAuth()`); uses Supabase browser client and `onAuthStateChange`.
- **Dashboard layout**: Uses `@/components/ui/sidebar` (Client Component with `usePathname` for active state); links to the six dashboard routes and a logout action.
- **Auth layout**: Centered flex full-screen shell; no sidebar.
- **Design**: Tailwind + shadcn tokens; Geist fonts. UI components in use: `button`, `input`, `card`, `sidebar`.

### Route inventory (Phase 1)

| Experience   | Route group   | Paths |
|-------------|---------------|-------|
| Public      | (none)        | `/` (landing) |
| Auth        | `(auth)`      | `/login`, `/signup`, `/forgot-password` |
| Protected   | `(dashboard)` | `/dashboard`, `/assets`, `/airlock`, `/vault`, `/governance`, `/settings` |
| Guest       | `(guest)`     | `/guest/view` |

---

## Phase 2: Tenant provisioning & workspace initialization (Current State additions)

Phase 2 introduced a minimal but fully functional multi-tenant onboarding flow on top of the Phase 1 shell. The Projection Canvas and other feature surfaces remain planned; only tenant provisioning, workspace selection, and starting cash balance capture are implemented.

### Dashboard layout: tenant-aware shell

- **Async server layout** (`app/(dashboard)/layout.tsx`): Uses the Supabase server client to fetch the authenticated user, their first `organization_members` row, the owning `organizations` record, and the first `workspaces` row for that organization (`id`, `name`, `starting_cash_balance`). All reads rely on database RLS to enforce tenant isolation.
- **Provisioning gate** (`DashboardProvisioningGate`): If the user has no `organization_members` row, the layout renders this client component instead of the shell. It calls `provisionTenantAction`, shows a full-screen loading state ("Setting up your workspace..."), and on success triggers `router.refresh()` so the newly created organization/workspace becomes visible.

### Tenant provisioning and starting cash balance

- **Server Actions** (`app/(dashboard)/actions.ts`):
  - `provisionTenantAction`: Looks up the authenticated user and short-circuits if they already belong to an organization. Otherwise it invokes the `public.provision_tenant(new_user_id, org_name, workspace_name)` RPC (SECURITY DEFINER) so organization, membership, workspace, and a baseline scenario are created atomically under the caller's user id.
  - `updateWorkspaceCashBalanceAction`: Validates a non-negative number via Zod, ensures a `workspaceId` is present, and updates `workspaces.starting_cash_balance` for that row. RLS on `workspaces` ensures users can only update workspaces in organizations where they are members. On success it calls `revalidatePath("/dashboard")`.
- **Cash balance onboarding UI** (`CashBalancePrompt`): When the selected workspace has `starting_cash_balance IS NULL`, the dashboard layout overlays a modal dialog that blocks interaction with the rest of the app. The dialog uses `useActionState` wired to `updateWorkspaceCashBalanceAction`; on success it refreshes the router so the shell renders with the updated balance and no prompt.

## Phase 2 and future phases

Phase 2 and beyond are specified in **docs/UX_SPEC.md** (Vertical UI Specification) and **docs/FUNCTIONAL_SPEC.md**. They include:

- **Phase 2:** Projection Canvas, Output Dashboard, CSV Ingestion & Mapping Wizard, Month Close & Health Score, Authentication & Global Navigation Shell, Period Management & History.

Do not remove or overwrite these phase plans when updating Phase 1 or current-state documentation.

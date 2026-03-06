# Architecture

## Phase 1 & Phase 2: Walking Skeleton & Tenant Provisioning (Current State)

Phase 1 & 2 deliver a minimal end-to-end slice with full tenant isolation: public landing, auth flows, protected dashboard shell, guest route, and automated tenant provisioning with Row Level Security (RLS) enforcement. The app uses the Next.js App Router with route groups; session is enforced by middleware and React context.

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
│   ├── layout.tsx                     # Sidebar, header, workspace fetching & gating
│   ├── dashboard-provisioning-gate.tsx # Triggers provisionTenantAction if no org found
│   ├── cash-balance-prompt.tsx        # UI dialog blocking access until cash balance is set
│   ├── actions.ts                     # Server actions for provisioning & cash updates
│   ├── dashboard/page.tsx             # /dashboard
│   ├── assets/page.tsx                # /assets
│   ├── airlock/page.tsx               # /airlock
│   ├── vault/page.tsx                 # /vault
│   ├── governance/page.tsx            # /governance
│   └── settings/page.tsx              # /settings
└── (guest)/
    ├── layout.tsx
    └── guest/view/page.tsx    # /guest/view
```

### Key implementation details

- **Middleware** (`src/middleware.ts`): Supabase server client; protects `/dashboard`, `/assets`, `/airlock`, `/vault`, `/governance`, `/settings`, and `/guest`; redirects unauthenticated users to `/login`; redirects authenticated users from `/` or `/login` to `/dashboard`.
- **AuthProvider** (`components/auth-provider.tsx`): Wraps root layout; exposes `session` and `isLoading` via React Context (`useAuth()`); uses Supabase browser client and `onAuthStateChange`.
- **Dashboard layout & Provisioning Flow**:
  - Validates organization membership. If missing, renders `<DashboardProvisioningGate />` which triggers a server action that calls a PostgreSQL RPC (`provision_tenant`) bypassing RLS to safely initialize the `organizations`, `organization_members`, `workspaces`, and `scenarios` tables.
  - Fetches the current `workspace`. If `starting_cash_balance` is null, it renders `<CashBalancePrompt />`, which blocks access and requires the user to submit an initial balance.
  - Renders the shell using `@/components/ui/sidebar` (Client Component linking to the six dashboard routes and a logout action).
- **Data Firewall & Multi-Tenancy**: RLS policies physically isolate `workspaces` and `organizations` based on `organization_members` roles linked directly to the authenticated user's `auth.uid()`.
- **Auth layout**: Centered flex full-screen shell; no sidebar.
- **Design**: Tailwind + shadcn tokens; Geist fonts. UI components in use: `button`, `input`, `card`, `sidebar`, `dialog`.

### Route inventory (Phase 1)

| Experience   | Route group   | Paths |
|-------------|---------------|-------|
| Public      | (none)        | `/` (landing) |
| Auth        | `(auth)`      | `/login`, `/signup`, `/forgot-password` |
| Protected   | `(dashboard)` | `/dashboard`, `/assets`, `/airlock`, `/vault`, `/governance`, `/settings` |
| Guest       | `(guest)`     | `/guest/view` |

---

## Phase 2 and future phases

Phase 2 and beyond are specified in **docs/UX_SPEC.md** (Vertical UI Specification) and **docs/FUNCTIONAL_SPEC.md**. They include:

- **Phase 2:** Projection Canvas, Output Dashboard, CSV Ingestion & Mapping Wizard, Month Close & Health Score, Authentication & Global Navigation Shell, Period Management & History.

Do not remove or overwrite these phase plans when updating Phase 1 or current-state documentation.

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
│   ├── actions.ts             # Server Actions (provision, cash balance, block CRUD, dependencies)
│   ├── dashboard/page.tsx     # /dashboard
│   ├── canvas/
│   │   ├── page.tsx           # /canvas — server component, fetches blocks via getScenarioBlocksAction
│   │   └── canvas-client.tsx  # ProjectionCanvasClient + BlockCard (client UI, dependency dropdown, inactive tray)
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
| Protected   | `(dashboard)` | `/dashboard`, `/canvas`, `/assets`, `/airlock`, `/vault`, `/governance`, `/settings` |
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

---

## Phase 3: Projection Canvas (Current State)

Phase 3 delivers the Projection Canvas: block CRUD, typed JSONB payloads, dependency wiring for the Revenue block’s “New customers” source, cycle detection, soft disable (Inactives tray), and a recalculation UX lock. All data flows use Server Actions in `app/(dashboard)/actions.ts`; there are no `/api/v1/*` HTTP routes for scenarios or blocks.

### Canvas route and data flow

- **Route:** `/canvas` (protected by middleware).
- **Page** (`app/(dashboard)/canvas/page.tsx`): Server component that calls `getScenarioBlocksAction()`. Resolves the default active-baseline scenario for the current workspace when no `scenarioId` is provided. On success, passes `scenarioId` and `initialBlocks` to the client component; on error, renders an error message.
- **Client** (`app/(dashboard)/canvas/canvas-client.tsx`): `ProjectionCanvasClient` holds local state for blocks and drives the UI. It offers a “New block” type selector and “Add block” form (wired to `createBlockMutation`), a responsive grid of `BlockCard` components for active blocks, and a collapsible “Inactive Projections” tray for blocks with `is_active = false`. Each block card supports edit/save (via `updateBlockMutation`), delete (`deleteBlockMutation`), and an On/Off switch (`updateScenarioBlocksMutation`). Editable block title is persisted via `updateBlockMutation` (maps to `blocks.title`).

### Block recalculation and dependency UI

- **Recalculation overlay:** Any mutation that affects the model (add block, update block, update dependency, toggle active) is wrapped in `runWithRecalculation`: a full-canvas overlay is shown for at least ~1 second with the text “Recalculating model...” while the Server Action runs. This provides a synchronous lock as specified; the actual 30/360 engine computation is not yet wired — the overlay is UX-only.
- **Dependency graph (client):** The client builds a directed graph from `payload.dependencies`: for each block, entries with `mode === 'Referenced'` and `referenceId` define edges (child → parent). Used to disable options in the Revenue “New customers” reference dropdown: the current block and any block already downstream (reachable from the current block) are shown but disabled to prevent cycles.
- **Dependency updates (server):** `updateBlockDependencyMutation` builds the same graph from all blocks in the scenario, performs cycle detection (`wouldCreateCycle`), and rejects with “Circular dependency detected. This connection is not allowed.” if adding the chosen reference would create a cycle. Valid updates are written into `blocks.payload.dependencies` and the path `/canvas` is revalidated.
- **Reference field in UI (V1):** Only the Revenue block’s “New customers (source)” field is implemented as a referenceable input. It can be Static (numeric value) or Referenced (dropdown of Marketing or Personnel sales blocks that expose a new-customers value). Formula mode exists in the payload schema but is not yet exposed in the Canvas UI.

### Blocks schema and payloads

- **Table:** `public.blocks` — `id`, `scenario_id`, `type` (Personnel | Revenue | Marketing | OpEx | Capital), `is_active`, `payload` (JSONB), `title` (nullable), `created_at`, `updated_at`. RLS restricts access to blocks whose scenario belongs to a workspace in an organization where the user is a member.
- **Payload:** Type-specific keys plus optional `dependencies` map. All validation is done in Server Actions via Zod schemas keyed by `blocks.type`; no separate REST DTO layer.

---

## Phase 2 and future phases

Phase 2 and beyond are specified in **docs/UX_SPEC.md** (Vertical UI Specification) and **docs/FUNCTIONAL_SPEC.md**. They include:

- **Phase 2:** Projection Canvas, Output Dashboard, CSV Ingestion & Mapping Wizard, Month Close & Health Score, Authentication & Global Navigation Shell, Period Management & History.

Do not remove or overwrite these phase plans when updating Phase 1 or current-state documentation.

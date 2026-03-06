# Architecture

## Phase 1: Walking Skeleton (Current State)

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

- **Middleware** (`src/middleware.ts`): Supabase server client; protects `/dashboard`, `/assets`, `/airlock`, `/vault`, `/governance`, `/settings`, and `/guest`; redirects unauthenticated users to `/login`; redirects authenticated users from `/` or `/login` to `/dashboard`.
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

## Phase 2 and future phases

Phase 2 and beyond are specified in **docs/UX_SPEC.md** (Vertical UI Specification) and **docs/FUNCTIONAL_SPEC.md**. They include:

- **Phase 2:** Projection Canvas, Output Dashboard, CSV Ingestion & Mapping Wizard, Month Close & Health Score, Authentication & Global Navigation Shell, Period Management & History.

Do not remove or overwrite these phase plans when updating Phase 1 or current-state documentation.

# NudgePay Frontend

The web app for NudgePay — invoice follow-up automation for small businesses
and agencies. Landing page, sign up/sign in, an onboarding wizard, and the
day-to-day dashboard (clients, invoices, automations, activity, analytics,
settings).

Talks to the NudgePay API at [`../backend`](../backend) over HTTPS — this app
never touches a database directly.

## Tech stack

- [TanStack Start](https://tanstack.com/start) (React, file-based routing, SSR) + Vite
- Tailwind CSS + [shadcn/ui](https://ui.shadcn.com) components
- Zustand for client state (some of it still local-only mock data — see below)
- React Hook Form + Zod for form validation

## Setup

```bash
npm install
cp .env.example .env   # only needed if the backend isn't on http://localhost:4000
npm run dev             # http://localhost:3000
```

The backend must be running for sign up/sign in/onboarding to work — see
[`../backend/README.md`](../backend/README.md).

## Scripts

```bash
npm run dev       # start the dev server
npm run build     # production build
npm run preview   # preview the production build locally
npm run lint       # eslint
npm run format     # prettier
```

## Project structure

```
src/
  routes/            File-based routes (TanStack Router). index.tsx is the
                      public landing page; login/signup/onboarding are public;
                      everything else is wrapped in AppLayout, which requires
                      a signed-in user.
  components/
    layout/           AppLayout (auth guard + sidebar/header shell), Sidebar, Header
    ui/               shadcn/ui primitives
    common/           EmptyState, ConfirmDialog, etc.
  features/           Feature-scoped components/services (invoices, dashboard,
                      customers, automations, onboarding)
  store/              Zustand stores
  lib/
    api-client.ts     Fetch wrapper for the real backend — auth headers,
                      401 refresh-and-retry, the {success,data}/{error} envelope
    mock-db.ts        Empty seed arrays for stores not yet wired to the API
    constants.ts, format.ts, utils.ts
```

## What's real vs. mock right now

Authentication (`/signup`, `/login`, `/onboarding`) and the data created
during onboarding (organization settings, first client, first invoice,
reminder sequence) go through the real backend API via `authStore` and
`api-client.ts`.

The rest of the app — the dashboard's stats, the invoices/customers/
automations/activity/analytics pages — still runs on local-only Zustand
stores seeded from empty arrays in `lib/mock-db.ts`. Wiring those to the
backend is the natural next step, not yet done.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | Backend base URL. Defaults to `http://localhost:4000/api/v1` if unset. |

## Routing conventions (TanStack Router)

File-based routing — every `.tsx` file in `src/routes/` defines a route.
`src/routes/__root.tsx` is the only root layout. Dynamic segments use a bare
`$` (`invoices.$invoiceId.tsx` → `/invoices/:invoiceId`), and
`routeTree.gen.ts` is auto-generated — never edit it by hand, it's
regenerated whenever the dev server runs.

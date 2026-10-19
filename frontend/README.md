# Benevolent Fund Platform — Frontend

Next.js 14 (App Router) + TypeScript + Tailwind CSS. Talks to the `backend/` Express API, never
directly to Fabric or the ML service.

## Setup

```bash
npm install
cp .env.local.example .env.local   # set NEXT_PUBLIC_API_URL if the backend isn't on localhost:4000
npm run dev                        # http://localhost:3000
```

For a production build: `npm run build && npm start`.

The backend must be running first (see `backend/README.md`) — the frontend has no data of its
own, it only renders what the API returns.

## Demo accounts

Seeded in `backend/src/auth/users.ts` (a demo in-memory user store — see that file's own notes
on swapping it for a real database later):

| Username     | Password     | Role        | Dashboard        |
|--------------|--------------|-------------|-------------------|
| admin        | Admin@123    | Admin       | `/admin`          |
| fundmanager  | FundMgr@123  | FundManager | `/fund-manager`   |
| donor1       | Donor@123    | Donor       | `/donor`          |

## Pages

- `/login` — sign in, redirects to the dashboard for the account's role.
- `/admin` (Admin) — create a fund (FR1), open a fund by ID, approve/reject pending
  disbursements (FR2, with the ML-predicted impact level shown on each item), and view the full
  transaction ledger for a fund.
- `/fund-manager` (FundManager) — open a fund, request a disbursement (FR2/FR7 — the backend
  calls the ML service first and returns the predicted impact level + class probabilities, shown
  immediately after submitting), and record an outcome report against an approved disbursement
  (FR3).
- `/donor` (Donor) — open a fund, contribute to it, see your own contribution history, and the
  real-time donor impact dashboard (Objective 3 / Section 4.5.2): cumulative giving over time, a
  breakdown of where the fund's disbursements went by category, and the predicted-impact-level
  mix of those disbursements, all via Recharts.

Route access is also enforced by `src/middleware.ts` (redirects an unauthenticated or
wrong-role visitor), but that is a UX convenience only — the backend independently re-verifies
the JWT and role on every request, which is the actual security boundary.

## Known gaps (flagged, not hidden)

- **No "browse all funds" view.** The chaincode only exposes `GetFund` by ID, so every dashboard
  requires typing in a Fund ID to open it. A `ListFunds` CouchDB rich query (similar to
  `GetAllTransactionsForFund`) would be a natural next addition to the chaincode + backend +
  an admin "browse funds" page here.
- **One Fabric identity per role, not per user.** Every Donor (for example) shares the same
  Fabric identity on the backend; individual attribution is kept at the application layer via
  the JWT `sub` claim (e.g. `donorId` on a `Contribution`). This is a deliberate simplification
  documented in `backend/README.md` and `fabric-network/03_enroll_users.sh`, not an oversight.
- **Demo user store.** Login currently checks a hardcoded array in `backend/src/auth/users.ts`,
  not a database. Fine for the thesis demo/evaluation; would need replacing for any real
  deployment.
- The ML impact predictions are clearly labelled as *predicted* / *interim* in the donor
  dashboard, since the trained model currently reaches ~70% cross-validated accuracy, below the
  85% target set in the thesis methodology (Section 5.10) — this is disclosed in the UI itself
  rather than presented as a finished, guaranteed figure.

## Verification performed

- `npx tsc --noEmit` — clean, no type errors.
- `npm run build` — production build succeeds; all 6 routes (`/`, `/login`, `/admin`,
  `/fund-manager`, `/donor`, plus the Next.js `_not-found` page) compile and prerender.
- Not yet run: a live end-to-end click-through against a running backend + Fabric network,
  since that network can only run on your own machine (see the top-level status message for
  why, and `fabric-network/README.md` for how to bring it up).

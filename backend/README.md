# Benevolent Fund Backend (Node.js + Express + Fabric Gateway SDK)

Thesis Section 4.3 / 4.8's "Django REST Framework backend" role, built in
Node.js per the implementation-stack decision (2026-10-15) — it validates
requests, applies role-based rules, calls the ML service, and brokers
every ledger write through the Fabric Gateway SDK.

**Already verified (no Fabric network needed for this part):**
`npm install && npm run build` compiles clean, and `/health`, `/auth/login`,
missing-token rejection, and role enforcement (a Donor token gets a 403
trying to create a fund) all work correctly — tested live while building
this.

## Routes

| Method | Path | Role | Maps to |
|---|---|---|---|
| POST | `/auth/login` | — | issues a JWT |
| POST | `/funds` | Admin | chaincode `CreateFund` (FR1) |
| GET | `/funds` | any | chaincode `ListFunds` (Admin dashboard fund directory) |
| GET | `/funds/:fundId` | any | chaincode `GetFund` |
| POST | `/funds/:fundId/close` | Admin | chaincode `CloseFund` |
| GET | `/funds/:fundId/transactions` | any | chaincode `GetAllTransactionsForFund` (FR1, FR5) |
| POST | `/funds/:fundId/contributions` | Donor | chaincode `RecordContribution` (FR4) |
| GET | `/donors/me/impact` | Donor | chaincode `GetAllTransactionsForDonor` + `GetFund`/`GetAllTransactionsForFund` per supported fund (FR5, Objective 3: cross-fund donor dashboard) |
| POST | `/disbursements/:fundId/disbursements` | FundManager | calls ML `/predict`, then chaincode `RequestDisbursement` (FR2, FR7) |
| GET | `/disbursements/:disbursementId` | any | chaincode `GetDisbursement` |
| POST | `/disbursements/:disbursementId/approve` | Admin | chaincode `ApproveDisbursement` (FR2) |
| POST | `/disbursements/:disbursementId/reject` | Admin | chaincode `RejectDisbursement` |
| POST | `/disbursements/:disbursementId/outcome` | FundManager | chaincode `RecordOutcomeReport` (FR3) |
| GET | `/assets/:assetId/history` | any | chaincode `GetHistoryForAsset` (audit trail) |

## Running it

1. Finish `fabric-network/` steps 1-3 and `ml_service/` so you have a live
   peer, a deployed chaincode, three enrolled role identities, and the
   FastAPI service running.
2. `cp .env.example .env` and fill in the paths/endpoints those steps
   printed out.
3. `npm install`
4. `npm run dev` (hot-reload) or `npm run build && npm start`

## Known simplification, stated plainly

`src/auth/users.ts` is a small seeded in-memory list of three demo users
(one per role), not a real user database — see the comment at the top of
that file. It's enough to exercise the full role-based flow end-to-end
(login → create fund → contribute → request disbursement with ML
prediction → approve → outcome report) before a real persistence layer
(e.g. PostgreSQL) is added; swapping it out only touches that one file.

`GET /donors/me/impact` (the route behind the donor dashboard's
cross-fund totals) fans out from one `GetAllTransactionsForDonor` call to
a `GetFund` + `GetAllTransactionsForFund` pair per fund the donor has
supported, then aggregates in the backend — it never asks the chaincode
to join across funds itself, since a CouchDB rich query only runs within
one world-state selector and the contract has no per-donor index beyond
`donorId` on contribution docs. Type-checks clean (`npm run build`); like
every other route here, it needs a live Fabric network to exercise end
to end.

Likewise, there is one Fabric ledger identity per **role**, not per
individual user — `fabric-network/03_enroll_users.sh`'s header comment
explains the reasoning and how individual accountability is still kept
(the real user ID is written into each transaction's payload, e.g.
`donorId` in `RecordContribution`).

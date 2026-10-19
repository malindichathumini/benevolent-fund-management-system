# Benevolent Fund Chaincode

Hyperledger Fabric chaincode (TypeScript) implementing the fund /
contribution / disbursement business rules behind FR1-FR7 (Thesis Section
4.2.1) and the "immutable, auditable ledger" half of Objective 2.

## What's here

- `src/assets.ts` — the three on-ledger asset types: `Fund`, `Contribution`,
  `Disbursement`.
- `src/fundContract.ts` — the contract: `CreateFund`, `CloseFund`,
  `GetFund`, `ListFunds`, `RecordContribution`, `RequestDisbursement`,
  `ApproveDisbursement`, `RejectDisbursement`, `RecordOutcomeReport`,
  `GetDisbursement`, `GetAllTransactionsForFund`,
  `GetAllTransactionsForDonor`, `GetHistoryForAsset`.
- `test/fundContract.test.ts` — logic smoke tests (role enforcement,
  balance tracking, the request→approve flow; that one donor's
  contributions are correctly isolated across multiple funds and from
  other donors' via `GetAllTransactionsForDonor`; and that `ListFunds`
  returns every fund, filtered to `docType: FUND` only, ignoring
  contribution/disbursement keys sharing the same world state) against an
  in-memory fake of the chaincode stub, including a minimal fake of
  CouchDB's rich-query `selector` shape so the three query methods have
  something to run against. These pass right now with no Fabric network
  at all:
  ```
  npm install
  npx tsc --outDir dist-test --rootDir . src/assets.ts src/fundContract.ts test/fundContract.test.ts \
    --target es2019 --module commonjs --esModuleInterop --experimentalDecorators \
    --emitDecoratorMetadata --skipLibCheck --resolveJsonModule
  npx mocha dist-test/test/fundContract.test.js
  ```
  (The package's own `npm test` — `nyc mocha --recursive` with no mocha
  config — doesn't actually discover `test/*.test.ts` in this Node
  version; run the `tsc`-then-`mocha` two-step above instead, or let
  `deployCC`'s own build/test step handle it.)
  This is **not** a substitute for Section 5.4.1's functional test log
  against the real test-network — it only proves the business logic is
  correct in isolation.

## Role-based access control

Every transaction function calls `requireRole(ctx, [...])`, which reads the
`role` attribute off the caller's enrollment certificate
(`ctx.clientIdentity.getAttributeValue("role")`). For this to work, each
user must be **registered through the Fabric CA with that attribute set**,
e.g.:

```bash
fabric-ca-client register --caname ca-org1 \
  --id.name admin-jeevin --id.secret adminpw --id.type client \
  --id.attrs 'role=Admin:ecert' \
  --tls.certfiles "$ORG1_CA_CERT"

fabric-ca-client register --caname ca-org1 \
  --id.name fundmanager1 --id.secret fmpw --id.type client \
  --id.attrs 'role=FundManager:ecert' \
  --tls.certfiles "$ORG1_CA_CERT"

fabric-ca-client register --caname ca-org1 \
  --id.name donor1 --id.secret donorpw --id.type client \
  --id.attrs 'role=Donor:ecert' \
  --tls.certfiles "$ORG1_CA_CERT"
```

The `:ecert` suffix is what makes the attribute appear on the issued
certificate so the chaincode can read it — without it,
`getAttributeValue` returns `null` and every transaction is rejected. The
Node/Express backend (next piece) enrolls each user through this same CA
and stores their identity in a wallet, so the JWT role used at the
application layer and the ledger-layer role are issued from the same
source of truth.

## Deploying onto the test-network

This cannot run inside the cloud sandbox I'm building it in (Docker Hub
pulls are blocked there — see the chat), so on your own machine, once you
have the [`fabric-samples`](https://github.com/hyperledger/fabric-samples)
`test-network` up with the CouchDB profile (needed for
`GetAllTransactionsForFund`'s rich query):

```bash
cd fabric-samples/test-network
./network.sh up createChannel -c fundchannel -s couchdb

./network.sh deployCC -c fundchannel -ccn fundcc \
  -ccp /path/to/this/fund-chaincode -ccl typescript
```

`deployCC` runs `npm install && npm run build` inside this directory as
part of packaging, so there's nothing extra to prepare beyond having
Node.js available.

## Why the ML prediction is passed in, not computed here

`RequestDisbursement` takes `predictedImpactLevel` as a parameter rather
than calling the FastAPI `/predict` service itself. Chaincode executes on
every endorsing peer and Fabric requires all of them to produce byte-
identical results (endorsement matching) — a live HTTP call to a model
service is neither deterministic nor guaranteed reachable from every peer,
so the Node/Express backend calls `/predict` first and submits the result
as a transaction argument, exactly as Section 4.3 describes ("A FastAPI
machine learning service ... is called by the backend to classify each
disbursement's predicted impact before it reaches an administrator for
approval").

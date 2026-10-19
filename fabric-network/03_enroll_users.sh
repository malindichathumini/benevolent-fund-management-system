#!/usr/bin/env bash
# Step 3 of 4. Registers and enrolls three Fabric CA identities - one per
# ROLE (Admin, FundManager, Donor) - each carrying the `role` ecert
# attribute the chaincode's requireRole() checks (see
# fund-chaincode/README.md).
#
# Design note: this project uses ONE Fabric identity per role, not one per
# individual user. Individual accountability (which specific donor made a
# contribution) is handled at the application layer by the Node/Express
# backend's own user table + JWT, exactly as Section 4.2.1's FR4 describes
# ("secure, role-based login (JWT)") - the backend picks which of these
# three Fabric identities to sign a transaction with, based on the
# authenticated user's role claim, and records the real individual donor
# ID as a field inside the transaction payload (see donorId in
# RecordContribution). This keeps the chaincode's access-control model
# simple and auditable while still giving every individual user a
# traceable record in the ledger's transaction data.
#
# Usage:
#   ./03_enroll_users.sh "$HOME/benevolent-fund-fabric"
set -euo pipefail

INSTALL_DIR="${1:-$HOME/benevolent-fund-fabric}"
TEST_NETWORK="${INSTALL_DIR}/fabric-samples/test-network"
FABRIC_CA_CLIENT="${INSTALL_DIR}/fabric-samples/bin/fabric-ca-client"
OUT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/identities"

export FABRIC_CA_CLIENT_HOME="${OUT_DIR}/.ca-client-home"
mkdir -p "${OUT_DIR}" "${FABRIC_CA_CLIENT_HOME}"

CA_ORG1_ADDR="localhost:7054"
CA_ORG1_TLS_CERT="${TEST_NETWORK}/organizations/fabric-ca/org1/tls-cert.pem"

# The `register` calls below authenticate using whatever identity is
# already enrolled under $FABRIC_CA_CLIENT_HOME - which starts out empty.
# Bootstrap that identity first, as the CA's built-in registrar admin
# (bootstrap credentials set by the test-network's own CA bring-up), so
# `register` has a registrar to sign as.
echo "== Enrolling CA bootstrap admin for ca-org1 (needed to register new identities) =="
"${FABRIC_CA_CLIENT}" enroll \
  -u "https://admin:adminpw@localhost:7054" \
  --caname ca-org1 \
  --tls.certfiles "${CA_ORG1_TLS_CERT}"

register_and_enroll() {
  local name="$1" secret="$2" role="$3"
  echo "== Registering ${name} (role=${role}) =="
  "${FABRIC_CA_CLIENT}" register --caname ca-org1 \
    --id.name "${name}" --id.secret "${secret}" --id.type client \
    --id.attrs "role=${role}:ecert" \
    --tls.certfiles "${CA_ORG1_TLS_CERT}" \
    -u "https://localhost:7054" || echo "  (already registered - continuing)"

  echo "== Enrolling ${name} =="
  mkdir -p "${OUT_DIR}/${name}"
  "${FABRIC_CA_CLIENT}" enroll \
    -u "https://${name}:${secret}@localhost:7054" \
    --caname ca-org1 \
    -M "${OUT_DIR}/${name}/msp" \
    --tls.certfiles "${CA_ORG1_TLS_CERT}"
  echo "  -> ${OUT_DIR}/${name}/msp/signcerts  (cert)"
  echo "  -> ${OUT_DIR}/${name}/msp/keystore   (private key)"
}

register_and_enroll "fund-admin" "adminpw1"  "Admin"
register_and_enroll "fund-manager" "fmpw1"   "FundManager"
register_and_enroll "fund-donor" "donorpw1"  "Donor"

echo ""
echo "All three role identities are enrolled under: ${OUT_DIR}"
echo "The Node backend (next step) reads each identity's cert + private key from"
echo "  identities/<role-name>/msp/signcerts/*.pem"
echo "  identities/<role-name>/msp/keystore/*_sk"
echo ""
echo "Next: run the Node backend and point it at:"
echo "  - connection profile: ${TEST_NETWORK}/organizations/peerOrganizations/org1.example.com/connection-org1.json"
echo "  - identities dir:     ${OUT_DIR}"

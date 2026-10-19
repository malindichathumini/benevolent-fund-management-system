#!/usr/bin/env bash
# Step 2 of 4. Brings up the standard 2-org Fabric test-network with the
# CouchDB state database (needed for GetAllTransactionsForFund's rich
# query in the chaincode), creates "fundchannel", and deploys this
# project's chaincode onto it.
#
# Usage:
#   ./02_bring_up_network.sh "$HOME/benevolent-fund-fabric" /path/to/fund-chaincode
set -euo pipefail

INSTALL_DIR="${1:-$HOME/benevolent-fund-fabric}"
CHAINCODE_PATH="${2:?Usage: $0 <install_dir> <path-to-fund-chaincode>}"
CHANNEL_NAME="fundchannel"
CC_NAME="fundcc"

cd "${INSTALL_DIR}/fabric-samples/test-network"

echo "== Bringing up the network (2 orgs, CouchDB state DB) =="
./network.sh up createChannel -ca -c "${CHANNEL_NAME}" -s couchdb

echo ""
echo "== Deploying chaincode '${CC_NAME}' from ${CHAINCODE_PATH} =="
./network.sh deployCC -c "${CHANNEL_NAME}" -ccn "${CC_NAME}" -ccp "${CHAINCODE_PATH}" -ccl typescript

echo ""
echo "Network is up. Channel: ${CHANNEL_NAME}  Chaincode: ${CC_NAME}"
echo "Connection profile (for the Node backend) is at:"
echo "  ${INSTALL_DIR}/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/connection-org1.json"
echo ""
echo "Next: ./03_enroll_users.sh \"${INSTALL_DIR}\""
echo ""
echo "To tear everything down later: cd \"${INSTALL_DIR}/fabric-samples/test-network\" && ./network.sh down"

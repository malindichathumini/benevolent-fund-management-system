#!/usr/bin/env bash
# Step 1 of 4. Downloads Hyperledger Fabric's own "fabric-samples" repo,
# which contains the standard, maintained test-network (2 orgs + 1 orderer,
# exactly what Thesis Section 4.4 / 4.8 specifies) plus the `peer` CLI and
# Fabric CA binaries. We build on this instead of writing our own
# docker-compose files from scratch, because the official scripts are the
# ones actually maintained against each Fabric release.
#
# Prerequisites (check each with --version):
#   - Docker Desktop (includes Docker Compose v2)   docker --version
#   - Git                                            git --version
#   - cURL                                           curl --version
#
# Usage:
#   chmod +x 01_install_fabric_samples.sh
#   ./01_install_fabric_samples.sh
set -euo pipefail

FABRIC_VERSION="2.5.9"
CA_VERSION="1.5.12"
INSTALL_DIR="${1:-$HOME/benevolent-fund-fabric}"

echo "Installing fabric-samples + Fabric ${FABRIC_VERSION} binaries into: ${INSTALL_DIR}"
mkdir -p "${INSTALL_DIR}"
cd "${INSTALL_DIR}"

curl -sSL https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh -o install-fabric.sh
chmod +x install-fabric.sh
./install-fabric.sh --fabric-version "${FABRIC_VERSION}" --ca-version "${CA_VERSION}" docker samples binary

echo ""
echo "Done. fabric-samples is now at: ${INSTALL_DIR}/fabric-samples"
echo "Next: ./02_bring_up_network.sh \"${INSTALL_DIR}\""

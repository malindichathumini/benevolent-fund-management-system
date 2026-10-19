# Fabric Test-Network Setup (run this on your own machine)

This cannot run inside the cloud workspace I'm building the project in —
its network policy blocks Docker Hub, which is where all of Hyperledger
Fabric's images (`peer`, `orderer`, `ca`, `couchdb`) live. Everything here
is ready to go; it just needs a real machine with Docker.

## 0. Check what you have

Open a terminal (macOS: Terminal; Windows: PowerShell) and run:

```bash
docker --version
docker compose version
git --version
```

If `docker` isn't found: install **Docker Desktop** —
https://www.docker.com/products/docker-desktop/ (macOS or Windows, pick
your chip — Apple Silicon vs Intel matters on Mac). It includes Docker
Compose, so you don't need to install that separately. After installing,
**open the Docker Desktop app once** so its background engine starts —
the `docker` command won't work until that app is running.

**On resources:** the test-network here is the same lightweight 2-org
setup used in Fabric's own getting-started tutorials — a couple of peer
containers, one orderer, two Certificate Authorities, and CouchDB. It's
fine on any laptop with a few GB of free RAM, nothing stays running after
you shut it down (`network.sh down`), and it only touches files inside
the folder you install it into — nothing system-level.

## 1. Install Fabric + fabric-samples

```bash
chmod +x 01_install_fabric_samples.sh
./01_install_fabric_samples.sh
```

Downloads the `peer`/`fabric-ca-client` binaries and the official
`fabric-samples` repo (which contains the test-network's docker-compose
files — maintained by the Fabric project itself, so we build on those
rather than hand-rolling our own) into `~/benevolent-fund-fabric`.

## 2. Bring the network up + deploy the chaincode

```bash
chmod +x 02_bring_up_network.sh
./02_bring_up_network.sh "$HOME/benevolent-fund-fabric" /path/to/fund-chaincode
```

`/path/to/fund-chaincode` is wherever you unzipped the chaincode project I
sent earlier (the folder containing `package.json`, `src/`, etc.). This
creates a channel called `fundchannel`, starts the network with CouchDB as
the state database (needed for the chaincode's rich-query function), and
installs + commits the chaincode as `fundcc`.

## 3. Register the three role identities

```bash
chmod +x 03_enroll_users.sh
./03_enroll_users.sh "$HOME/benevolent-fund-fabric"
```

Creates one Fabric identity per **role** (Admin, Fund Manager, Donor) —
see the comment at the top of that script for why it's one identity per
role rather than one per individual user, and how individual donor
accountability still works. These three identities' certs/keys end up in
`./identities/<role-name>/msp/...`, which the Node/Express backend (next
piece) will load.

## Sanity-check it worked

```bash
cd "$HOME/benevolent-fund-fabric/fabric-samples/test-network"
export PATH="${PWD}/../bin:$PATH"
export FABRIC_CFG_PATH="${PWD}/../config"
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_TLS_ROOTCERT_FILE="${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt"
export CORE_PEER_MSPCONFIGPATH="${PWD}/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp"
export CORE_PEER_ADDRESS=localhost:7051

peer chaincode query -C fundchannel -n fundcc -c '{"function":"GetFund","Args":["nonexistent"]}'
```

You should get back an error like `No asset found for key nonexistent` —
that's success, it means the chaincode is live and responding (there's
just no fund with that ID yet, which is correct).

## Tearing it down / starting fresh

```bash
cd "$HOME/benevolent-fund-fabric/fabric-samples/test-network"
./network.sh down
```

Safe to run any time — it stops and removes the containers. Re-run step 2
to bring everything back up again (you'll need to re-run step 3 too,
since a fresh network means fresh CAs).

## Troubleshooting

- **"Cannot connect to the Docker daemon"** — Docker Desktop isn't
  running; open the app and wait for its icon to show "running," then
  retry.
- **Port already in use (7050/7051/etc.)** — something else is bound to a
  Fabric port, usually a previous network that didn't shut down cleanly:
  run `./network.sh down` first.
- **`deployCC` fails on `npm install`** — make sure Node.js (v18+) is
  installed and on your PATH; `deployCC` runs the chaincode's own
  `npm install && npm run build` as part of packaging it.

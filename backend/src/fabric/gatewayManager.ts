import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import * as grpc from "@grpc/grpc-js";
import { connect, Contract, Gateway, Identity, signers } from "@hyperledger/fabric-gateway";
import { config } from "../config";
import { Role, ROLE_TO_FABRIC_IDENTITY } from "../auth/users";

/**
 * Connects to the Fabric network using the Gateway SDK (Section 4.3: "a
 * Django REST Framework backend ... brokers every write to the
 * Hyperledger Fabric ledger" - here, the Node/Express equivalent) with
 * ONE gRPC connection + Gateway + Contract handle PER ROLE, matching the
 * one-identity-per-role design documented in
 * fabric-network/03_enroll_users.sh. Connections are created lazily on
 * first use and cached for the lifetime of the backend process.
 */

interface RoleConnection {
  grpcClient: grpc.Client;
  gateway: Gateway;
  contract: Contract;
}

const connections = new Map<Role, RoleConnection>();

function newGrpcClient(): grpc.Client {
  const tlsRootCert = fs.readFileSync(config.fabric.peerTlsCertPath);
  const credentials = grpc.credentials.createSsl(tlsRootCert);
  return new grpc.Client(config.fabric.peerEndpoint, credentials, {
    "grpc.ssl_target_name_override": config.fabric.peerHostAlias,
  });
}

function loadIdentity(roleIdentityName: string): Identity {
  const certDir = path.join(config.fabric.identitiesDir, roleIdentityName, "msp", "signcerts");
  const certFile = fs.readdirSync(certDir).find((f) => f.endsWith(".pem")) ?? fs.readdirSync(certDir)[0];
  const credentials = fs.readFileSync(path.join(certDir, certFile));
  return { mspId: config.fabric.mspId, credentials };
}

function loadSigner(roleIdentityName: string) {
  const keyDir = path.join(config.fabric.identitiesDir, roleIdentityName, "msp", "keystore");
  const keyFile = fs.readdirSync(keyDir)[0];
  const privateKeyPem = fs.readFileSync(path.join(keyDir, keyFile));
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  return signers.newPrivateKeySigner(privateKey);
}

function connectForRole(role: Role): RoleConnection {
  const roleIdentityName = ROLE_TO_FABRIC_IDENTITY[role];

  const grpcClient = newGrpcClient();
  const gateway = connect({
    client: grpcClient,
    identity: loadIdentity(roleIdentityName),
    signer: loadSigner(roleIdentityName),
    // Generous timeouts are fine for a thesis demo network; tune down for
    // anything resembling production use.
    evaluateOptions: () => ({ deadline: Date.now() + 5000 }),
    endorseOptions: () => ({ deadline: Date.now() + 15000 }),
    submitOptions: () => ({ deadline: Date.now() + 5000 }),
    commitStatusOptions: () => ({ deadline: Date.now() + 60000 }),
  });

  const network = gateway.getNetwork(config.fabric.channelName);
  const contract = network.getContract(config.fabric.chaincodeName);

  return { grpcClient, gateway, contract };
}

/** Returns the cached contract handle for a role, connecting on first use. */
export function getContractForRole(role: Role): Contract {
  let conn = connections.get(role);
  if (!conn) {
    conn = connectForRole(role);
    connections.set(role, conn);
  }
  return conn.contract;
}

export function closeAllConnections(): void {
  for (const conn of connections.values()) {
    conn.gateway.close();
    conn.grpcClient.close();
  }
  connections.clear();
}

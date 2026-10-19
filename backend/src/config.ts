import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name} (see .env.example)`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: required("JWT_SECRET", "dev-only-insecure-secret-change-me"),

  fabric: {
    connectionProfilePath: required("FABRIC_CONNECTION_PROFILE", ""),
    identitiesDir: required("FABRIC_IDENTITIES_DIR", ""),
    channelName: process.env.FABRIC_CHANNEL_NAME ?? "fundchannel",
    chaincodeName: process.env.FABRIC_CHAINCODE_NAME ?? "fundcc",
    peerEndpoint: process.env.FABRIC_PEER_ENDPOINT ?? "localhost:7051",
    peerHostAlias: process.env.FABRIC_PEER_HOST_ALIAS ?? "peer0.org1.example.com",
    peerTlsCertPath: required("FABRIC_PEER_TLS_CERT_PATH", ""),
    mspId: process.env.FABRIC_MSP_ID ?? "Org1MSP",
  },

  mlServiceUrl: process.env.ML_SERVICE_URL ?? "http://localhost:8000",
};

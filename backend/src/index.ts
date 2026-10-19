import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { config } from "./config";
import { closeAllConnections } from "./fabric/gatewayManager";
import authRoutes from "./routes/auth";
import contributionRoutes from "./routes/contributions";
import disbursementRoutes from "./routes/disbursements";
import donorRoutes from "./routes/donors";
import fundRoutes from "./routes/funds";
import ledgerRoutes from "./routes/ledger";

const app = express();

app.use(helmet());
app.use(cors()); // tighten to the Next.js frontend's origin before any real deployment
app.use(morgan("dev"));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/auth", authRoutes);
app.use("/funds", fundRoutes);
app.use("/funds", contributionRoutes);
app.use("/disbursements", disbursementRoutes);
app.use("/donors", donorRoutes);
app.use("/", ledgerRoutes);

app.use((req, res) => {
  res.status(404).json({ error: `No route for ${req.method} ${req.path}` });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const server = app.listen(config.port, () => {
  console.log(`Benevolent Fund backend listening on http://localhost:${config.port}`);
});

function shutdown() {
  console.log("Shutting down...");
  closeAllConnections();
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

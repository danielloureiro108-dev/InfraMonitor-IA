import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";

import { bootstrap } from "./bootstrap";
import { errorHandler, notFound } from "./middleware/errorHandler";
import { iniciarWebSocket } from "./services/wsServer";
import { iniciarMonitorWorker } from "./services/monitorWorker";

import { authRouter } from "./routes/auth.routes";
import { oauthRouter } from "./routes/oauth.routes";
import { equipamentosRouter } from "./routes/equipamentos.routes";
import { dashboardRouter } from "./routes/dashboard.routes";
import { historicoRouter } from "./routes/historico.routes";
import { alertasRouter } from "./routes/alertas.routes";
import { discoveryRouter } from "./routes/discovery.routes";
import { orgsRouter } from "./routes/orgs.routes";
import { configRouter, logsRouter } from "./routes/config.routes";
import { trafegoRouter, sincronizarColetoresTrafego } from "./routes/trafego.routes";
import { agentRouter } from "./routes/agent.routes";
import { relatoriosRouter } from "./routes/relatorios.routes";
import { permissoesRouter } from "./routes/permissoes.routes";

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ status: "ok", servico: "InfraMonitor AI API" }));

app.use("/api/auth", authRouter);
app.use("/api/auth", oauthRouter);
app.use("/api/equipamentos", equipamentosRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/historico", historicoRouter);
app.use("/api/alertas", alertasRouter);
app.use("/api/discovery", discoveryRouter);
app.use("/api/org", orgsRouter);
app.use("/api/configuracoes", configRouter);
app.use("/api/logs", logsRouter);
app.use("/api/trafego", trafegoRouter);
app.use("/api/agent", agentRouter);
app.use("/api/relatorios", relatoriosRouter);
app.use("/api/permissoes", permissoesRouter);

app.use(notFound);
app.use(errorHandler);

const PORT = Number(process.env.PORT || 4000);
const server = http.createServer(app);

async function start() {
  await bootstrap();
  iniciarWebSocket(server);
  iniciarMonitorWorker();
  await sincronizarColetoresTrafego();
  server.listen(PORT, () => {
    console.log(`[InfraMonitor AI] API rodando em http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Falha ao iniciar o servidor:", err);
  process.exit(1);
});

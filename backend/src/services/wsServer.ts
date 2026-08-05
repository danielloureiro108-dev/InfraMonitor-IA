import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";

let wss: WebSocketServer | null = null;

export function iniciarWebSocket(server: Server) {
  wss = new WebSocketServer({ server, path: "/ws" });
  wss.on("connection", (socket) => {
    socket.send(JSON.stringify({ tipo: "conectado", mensagem: "InfraMonitor AI - tempo real conectado" }));
  });
  console.log("[ws] servidor de tempo real disponível em /ws");
}

/** Envia um evento para todos os clientes conectados (dashboard, mapa de equipamentos, etc.). */
export function transmitir(tipo: string, dados: any) {
  if (!wss) return;
  const payload = JSON.stringify({ tipo, dados, quando: new Date().toISOString() });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  });
}

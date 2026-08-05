import dgram from "dgram";

function intParaIp(valor: number): string {
  return [(valor >>> 24) & 255, (valor >>> 16) & 255, (valor >>> 8) & 255, valor & 255].join(".");
}

const PROTOCOLOS: Record<number, string> = { 1: "ICMP", 6: "TCP", 17: "UDP" };

function parsearNetflowV5(buffer: Buffer) {
  if (buffer.length < 24 || buffer.readUInt16BE(0) !== 5) return [];
  const count = buffer.readUInt16BE(2);
  const flows = [];
  for (let i = 0; i < count; i++) {
    const offset = 24 + i * 48;
    if (offset + 48 > buffer.length) break;
    flows.push({
      ipOrigem: intParaIp(buffer.readUInt32BE(offset)),
      ipDestino: intParaIp(buffer.readUInt32BE(offset + 4)),
      pacotes: buffer.readUInt32BE(offset + 16),
      bytes: buffer.readUInt32BE(offset + 20),
      portaOrigem: buffer.readUInt16BE(offset + 32),
      portaDestino: buffer.readUInt16BE(offset + 34),
      protocolo: PROTOCOLOS[buffer.readUInt8(offset + 38)] || `Proto ${buffer.readUInt8(offset + 38)}`,
    });
  }
  return flows;
}

/** Ouve NetFlow v5 localmente e envia os fluxos em lotes para o backend a cada `intervaloMs`. */
export function iniciarRelayNetflow(porta: number, intervaloMs: number, enviar: (flows: any[]) => Promise<any>) {
  let lote: any[] = [];
  const socket = dgram.createSocket("udp4");

  socket.on("message", (msg) => {
    try {
      lote.push(...parsearNetflowV5(msg));
    } catch (e) {
      console.error("[agente:netflow] erro ao parsear pacote:", e);
    }
  });

  socket.on("error", (err) => console.error("[agente:netflow] erro no socket:", err));
  socket.bind(porta, () => console.log(`[agente:netflow] ouvindo em UDP:${porta}`));

  setInterval(async () => {
    if (lote.length === 0) return;
    const paraEnviar = lote;
    lote = [];
    try {
      await enviar(paraEnviar);
    } catch (e) {
      console.error("[agente:netflow] falha ao enviar lote para o backend:", e);
    }
  }, intervaloMs);

  return socket;
}

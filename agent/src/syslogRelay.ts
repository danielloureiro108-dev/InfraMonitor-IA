import dgram from "dgram";

/** Ouve Syslog UDP localmente e envia as mensagens em lotes para o backend a cada `intervaloMs`. */
export function iniciarRelaySyslog(porta: number, intervaloMs: number, enviar: (mensagens: any[]) => Promise<any>) {
  let lote: any[] = [];
  const socket = dgram.createSocket("udp4");

  socket.on("message", (msg, rinfo) => {
    const mensagem = msg.toString("utf8").trim();
    if (mensagem) lote.push({ ipOrigem: rinfo.address, mensagem });
  });

  socket.on("error", (err) => console.error("[agente:syslog] erro no socket:", err));
  socket.bind(porta, () => console.log(`[agente:syslog] ouvindo em UDP:${porta}`));

  setInterval(async () => {
    if (lote.length === 0) return;
    const paraEnviar = lote;
    lote = [];
    try {
      await enviar(paraEnviar);
    } catch (e) {
      console.error("[agente:syslog] falha ao enviar lote para o backend:", e);
    }
  }, intervaloMs);

  return socket;
}

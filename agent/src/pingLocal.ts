import ping from "ping";

export interface ResultadoPing {
  online: boolean;
  tempoMs: number | null;
  ttl: number | null;
  packetLossPct: number | null;
}

/** Executa um ping ICMP real contra o host, usando o utilitário nativo do SO (funciona no Windows sem privilégios especiais). */
export async function executarPing(host: string, timeoutMs = 2000, tentativas = 1): Promise<ResultadoPing> {
  let melhor: ResultadoPing = { online: false, tempoMs: null, ttl: null, packetLossPct: 100 };

  for (let i = 0; i < Math.max(1, tentativas); i++) {
    // eslint-disable-next-line no-await-in-loop
    const resposta = await ping.promise.probe(host, { timeout: Math.max(1, Math.round(timeoutMs / 1000)) });
    const online = !!resposta.alive;
    const tempoMs = resposta.time && resposta.time !== "unknown" ? Number(resposta.time) : null;
    const ttl = resposta.ttl ? Number(resposta.ttl) : null;
    const packetLossPct = resposta.packetLoss ? Number(resposta.packetLoss) : online ? 0 : 100;

    melhor = { online, tempoMs, ttl, packetLossPct };
    if (online) break;
  }

  return melhor;
}

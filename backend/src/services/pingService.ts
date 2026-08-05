import ping from "ping";

export interface PingResultado {
  online: boolean;
  tempoMs: number | null;
  ttl: number | null;
  packetLossPct: number | null;
}

/**
 * Executa um ping ICMP real contra o host informado.
 * Requer que o container tenha a capability NET_RAW (ver docker-compose.yml)
 * e o pacote "iputils" instalado na imagem (ver Dockerfile).
 */
export async function executarPing(host: string, timeoutMs = 2000, tentativas = 1): Promise<PingResultado> {
  let melhor: PingResultado = { online: false, tempoMs: null, ttl: null, packetLossPct: 100 };

  for (let i = 0; i < Math.max(1, tentativas); i++) {
    // eslint-disable-next-line no-await-in-loop
    const resposta = await ping.promise.probe(host, {
      timeout: Math.max(1, Math.round(timeoutMs / 1000)),
      extra: ["-c", "1"],
    });

    const online = !!resposta.alive;
    const tempoMs = resposta.time && resposta.time !== "unknown" ? Number(resposta.time) : null;
    const ttl = resposta.ttl ? Number(resposta.ttl) : null;
    const packetLossPct = resposta.packetLoss ? Number(resposta.packetLoss) : online ? 0 : 100;

    if (online) {
      melhor = { online, tempoMs, ttl, packetLossPct };
      break; // já respondeu, não precisa gastar mais tentativas
    }
    melhor = { online, tempoMs, ttl, packetLossPct };
  }

  return melhor;
}

/** Calcula o jitter (variação de latência) entre a última amostra e a atual. */
export function calcularJitter(tempoAtualMs: number | null, tempoAnteriorMs: number | null): number | null {
  if (tempoAtualMs === null || tempoAnteriorMs === null) return null;
  return Math.abs(tempoAtualMs - tempoAnteriorMs);
}

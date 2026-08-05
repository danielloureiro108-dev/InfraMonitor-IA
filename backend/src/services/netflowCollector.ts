import dgram from "dgram";
import { query } from "../db";
import { mapearAplicacao, nomeProtocoloIp } from "../utils/portas";

let socket: dgram.Socket | null = null;

function intParaIp(valor: number): string {
  return [(valor >>> 24) & 255, (valor >>> 16) & 255, (valor >>> 8) & 255, valor & 255].join(".");
}

interface FlowV5 {
  ipOrigem: string;
  ipDestino: string;
  portaOrigem: number;
  portaDestino: number;
  protocolo: string;
  bytes: number;
  pacotes: number;
}

/** Faz o parse de um pacote NetFlow v5 (cabeçalho de 24 bytes + registros de 48 bytes cada). */
export function parsearNetflowV5(buffer: Buffer): FlowV5[] {
  if (buffer.length < 24) return [];
  const version = buffer.readUInt16BE(0);
  if (version !== 5) return []; // v9/IPFIX usam template dinâmico — fora do escopo desta versão

  const count = buffer.readUInt16BE(2);
  const flows: FlowV5[] = [];

  for (let i = 0; i < count; i++) {
    const offset = 24 + i * 48;
    if (offset + 48 > buffer.length) break;

    const srcaddr = buffer.readUInt32BE(offset + 0);
    const dstaddr = buffer.readUInt32BE(offset + 4);
    const dPkts = buffer.readUInt32BE(offset + 16);
    const dOctets = buffer.readUInt32BE(offset + 20);
    const srcport = buffer.readUInt16BE(offset + 32);
    const dstport = buffer.readUInt16BE(offset + 34);
    const prot = buffer.readUInt8(offset + 38);

    flows.push({
      ipOrigem: intParaIp(srcaddr),
      ipDestino: intParaIp(dstaddr),
      portaOrigem: srcport,
      portaDestino: dstport,
      protocolo: nomeProtocoloIp(prot),
      bytes: dOctets,
      pacotes: dPkts,
    });
  }

  return flows;
}

export function iniciarColetorNetflow(porta: number) {
  pararColetorNetflow();

  socket = dgram.createSocket("udp4");

  socket.on("message", async (msg, rinfo) => {
    try {
      const flows = parsearNetflowV5(msg);
      if (flows.length === 0) return;

      // Tenta casar o exportador (quem enviou o pacote) com um equipamento cadastrado
      const { rows: equipamentoRows } = await query(`SELECT id FROM equipamentos WHERE ip = $1 LIMIT 1`, [rinfo.address]);
      const equipamentoId = equipamentoRows[0]?.id || null;

      await Promise.all(
        flows.map((f) =>
          query(
            `INSERT INTO trafego_flows (origem_tipo, equipamento_id, ip_exportador, ip_origem, ip_destino, porta_origem, porta_destino, protocolo, aplicacao, bytes, pacotes)
             VALUES ('netflow', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              equipamentoId, rinfo.address, f.ipOrigem, f.ipDestino, f.portaOrigem, f.portaDestino,
              f.protocolo, mapearAplicacao(f.portaDestino), f.bytes, f.pacotes,
            ]
          )
        )
      );
    } catch (e) {
      console.error("[netflow] erro ao processar pacote:", e);
    }
  });

  socket.on("error", (err) => {
    console.error(`[netflow] erro no socket UDP:`, err);
  });

  socket.bind(porta, () => {
    console.log(`[netflow] coletor NetFlow v5 ouvindo em UDP:${porta}`);
  });
}

export function pararColetorNetflow() {
  if (socket) {
    socket.close();
    socket = null;
  }
}

export function statusColetorNetflow() {
  return { ativo: socket !== null };
}

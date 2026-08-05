import dgram from "dgram";
import { query } from "../db";
import { mapearAplicacao } from "../utils/portas";

let socket: dgram.Socket | null = null;

const REGEX_IP = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g;
const REGEX_SRC = /\bSRC=(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/i;
const REGEX_DST = /\bDST=(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/i;
const REGEX_SPT = /\bSPT=(\d+)/i;
const REGEX_DPT = /\bDPT=(\d+)/i;
const REGEX_PROTO = /\bPROTO=([A-Z]+)/i;
const REGEX_LEN = /\bLEN=(\d+)/i;

interface FluxoExtraido {
  ipOrigem: string;
  ipDestino: string;
  portaOrigem: number | null;
  portaDestino: number | null;
  protocolo: string | null;
  bytes: number;
}

/**
 * Extrai um fluxo estruturado de uma linha de syslog, quando possível.
 * Reconhece o padrão SRC=/DST=/SPT=/DPT=/PROTO=/LEN= (comum em iptables,
 * pfSense/OPNsense e diversos firewalls). Quando esse padrão não existe,
 * cai para uma heurística simples: se a mensagem contém exatamente duas
 * combinações IP, assume a primeira como origem e a segunda como destino.
 * Mensagens sem nenhum IP reconhecível voltam null (ficam só como log bruto).
 */
export function extrairFluxoDeSyslog(mensagem: string): FluxoExtraido | null {
  const src = mensagem.match(REGEX_SRC)?.[1];
  const dst = mensagem.match(REGEX_DST)?.[1];
  if (src && dst) {
    return {
      ipOrigem: src,
      ipDestino: dst,
      portaOrigem: mensagem.match(REGEX_SPT)?.[1] ? Number(mensagem.match(REGEX_SPT)![1]) : null,
      portaDestino: mensagem.match(REGEX_DPT)?.[1] ? Number(mensagem.match(REGEX_DPT)![1]) : null,
      protocolo: mensagem.match(REGEX_PROTO)?.[1] || null,
      bytes: mensagem.match(REGEX_LEN)?.[1] ? Number(mensagem.match(REGEX_LEN)![1]) : 0,
    };
  }

  const ipsEncontrados = [...new Set(mensagem.match(REGEX_IP) || [])];
  if (ipsEncontrados.length === 2) {
    return { ipOrigem: ipsEncontrados[0], ipDestino: ipsEncontrados[1], portaOrigem: null, portaDestino: null, protocolo: null, bytes: 0 };
  }

  return null;
}

export function iniciarColetorSyslog(porta: number) {
  pararColetorSyslog();

  socket = dgram.createSocket("udp4");

  socket.on("message", async (msg, rinfo) => {
    try {
      const mensagem = msg.toString("utf8").trim();
      if (!mensagem) return;

      await query(`INSERT INTO logs_syslog (ip_origem, mensagem) VALUES ($1, $2)`, [rinfo.address, mensagem]);

      const fluxo = extrairFluxoDeSyslog(mensagem);
      if (fluxo) {
        const { rows: equipamentoRows } = await query(`SELECT id FROM equipamentos WHERE ip = $1 LIMIT 1`, [rinfo.address]);
        await query(
          `INSERT INTO trafego_flows (origem_tipo, equipamento_id, ip_exportador, ip_origem, ip_destino, porta_origem, porta_destino, protocolo, aplicacao, bytes, pacotes)
           VALUES ('syslog', $1, $2, $3, $4, $5, $6, $7, $8, $9, 1)`,
          [
            equipamentoRows[0]?.id || null, rinfo.address, fluxo.ipOrigem, fluxo.ipDestino,
            fluxo.portaOrigem, fluxo.portaDestino, fluxo.protocolo, mapearAplicacao(fluxo.portaDestino), fluxo.bytes,
          ]
        );
      }
    } catch (e) {
      console.error("[syslog] erro ao processar mensagem:", e);
    }
  });

  socket.on("error", (err) => {
    console.error(`[syslog] erro no socket UDP:`, err);
  });

  socket.bind(porta, () => {
    console.log(`[syslog] coletor Syslog ouvindo em UDP:${porta}`);
  });
}

export function pararColetorSyslog() {
  if (socket) {
    socket.close();
    socket = null;
  }
}

export function statusColetorSyslog() {
  return { ativo: socket !== null };
}

import * as snmp from "net-snmp";
import { decryptSecret } from "../utils/crypto";

export interface SnmpResultado {
  hostname: string | null;
  descricao: string | null;
  uptimeSeconds: number | null;
  cpuPct: number | null;
  memoriaPct: number | null;
  discoPct: number | null;
  temperaturaC: number | null;
  modelo: string | null;
  versaoFirmware: string | null;
  raw: Record<string, any>;
}

// OIDs padrão MIB-2, válidos para praticamente qualquer dispositivo com agente SNMP
const OIDS_PADRAO = {
  sysDescr: "1.3.6.1.2.1.1.1.0",
  sysUpTime: "1.3.6.1.2.1.1.3.0",
  sysName: "1.3.6.1.2.1.1.5.0",
};

// Mapa de OIDs específicos por fabricante para métricas de CPU/memória.
// Ponto de extensão: adicione aqui os OIDs de Cisco, Fortinet, HP, Dell,
// Mikrotik, Ubiquiti, Synology, QNAP etc. conforme a MIB de cada um.
const OIDS_POR_FABRICANTE: Record<string, { cpu?: string; memoria?: string; temperatura?: string }> = {
  cisco: { cpu: "1.3.6.1.4.1.9.9.109.1.1.1.1.7.1" },
  generico_linux: { cpu: "1.3.6.1.4.1.2021.11.9.0", memoria: "1.3.6.1.4.1.2021.4.6.0" },
};

interface SnmpParams {
  host: string;
  version: string; // "v1" | "v2c" | "v3"
  communityEnc?: string | null;
  community?: string | null; // texto puro — usado no teste avulso de Configurações
  username?: string | null;
  passwordEnc?: string | null;
  authProtocol?: string | null;
  privProtocol?: string | null;
  timeoutMs: number;
  fabricante?: string | null;
}

export interface InterfaceSnmp {
  ifIndex: number;
  ifDescr: string;
  ifSpeed: number | null; // bits por segundo
  inOctets: number | null; // contador cumulativo de bytes recebidos
  outOctets: number | null; // contador cumulativo de bytes enviados
}

/**
 * Consulta a tabela de interfaces (IF-MIB / ifTable) de um dispositivo via SNMP.
 * Usa os contadores padrão de 32 bits (ifInOctets/ifOutOctets), suportados por
 * praticamente qualquer equipamento com agente SNMP. Em enlaces muito rápidos
 * (>~1 Gbps sustentado) esses contadores podem estourar entre duas coletas;
 * o cálculo de taxa em historico.routes.ts já trata esse caso (delta negativo
 * é descartado). Para redes de altíssima velocidade, o ponto de extensão
 * natural é somar os contadores de 64 bits (ifXTable: ifHCInOctets/ifHCOutOctets,
 * OID 1.3.6.1.2.1.31.1.1.1.6 e .10).
 */
export async function consultarInterfacesSnmp(params: SnmpParams): Promise<InterfaceSnmp[]> {
  const community = params.community || decryptSecret(params.communityEnc) || "public";
  const versionMap: Record<string, any> = { v1: snmp.Version1, v2c: snmp.Version2c };
  const version = versionMap[params.version] ?? snmp.Version2c;

  const session = snmp.createSession(params.host, community, {
    version,
    timeout: params.timeoutMs,
    retries: 1,
  });

  const IF_TABLE_OID = "1.3.6.1.2.1.2.2.1"; // ifDescr=.2  ifSpeed=.5  ifInOctets=.10  ifOutOctets=.16

  return new Promise((resolve) => {
    session.table(IF_TABLE_OID, 20, (error: any, table: any) => {
      session.close();
      if (error || !table) {
        resolve([]);
        return;
      }
      const interfaces: InterfaceSnmp[] = Object.keys(table).map((indexStr) => {
        const linha = table[indexStr];
        return {
          ifIndex: Number(indexStr),
          ifDescr: linha[2]?.toString?.() ?? `if${indexStr}`,
          ifSpeed: linha[5] != null ? Number(linha[5]) : null,
          inOctets: linha[10] != null ? Number(linha[10]) : null,
          outOctets: linha[16] != null ? Number(linha[16]) : null,
        };
      });
      resolve(interfaces);
    });
  });
}

export async function consultarSnmp(params: SnmpParams): Promise<SnmpResultado> {
  const community = params.community || decryptSecret(params.communityEnc) || "public";
  const versionMap: Record<string, any> = { v1: snmp.Version1, v2c: snmp.Version2c };
  const version = versionMap[params.version] ?? snmp.Version2c;

  const session = snmp.createSession(params.host, community, {
    version,
    timeout: params.timeoutMs,
    retries: 1,
  });

  const fabricanteKey = (params.fabricante || "").toLowerCase();
  const extraOids = OIDS_POR_FABRICANTE[fabricanteKey] || {};
  const oidsParaConsultar = [OIDS_PADRAO.sysDescr, OIDS_PADRAO.sysUpTime, OIDS_PADRAO.sysName, ...Object.values(extraOids)];

  return new Promise((resolve) => {
    session.get(oidsParaConsultar, (error: any, varbinds: any[]) => {
      session.close();

      if (error) {
        resolve({
          hostname: null,
          descricao: null,
          uptimeSeconds: null,
          cpuPct: null,
          memoriaPct: null,
          discoPct: null,
          temperaturaC: null,
          modelo: null,
          versaoFirmware: null,
          raw: { erro: String(error) },
        });
        return;
      }

      const valores: Record<string, any> = {};
      varbinds.forEach((vb) => {
        if (!snmp.isVarbindError(vb)) {
          valores[vb.oid] = vb.value?.toString?.() ?? vb.value;
        }
      });

      resolve({
        hostname: valores[OIDS_PADRAO.sysName] || null,
        descricao: valores[OIDS_PADRAO.sysDescr] || null,
        uptimeSeconds: valores[OIDS_PADRAO.sysUpTime] ? Math.round(Number(valores[OIDS_PADRAO.sysUpTime]) / 100) : null,
        cpuPct: extraOids.cpu ? Number(valores[extraOids.cpu]) || null : null,
        memoriaPct: extraOids.memoria ? Number(valores[extraOids.memoria]) || null : null,
        discoPct: null,
        temperaturaC: extraOids.temperatura ? Number(valores[extraOids.temperatura]) || null : null,
        modelo: null,
        versaoFirmware: null,
        raw: valores,
      });
    });
  });
}

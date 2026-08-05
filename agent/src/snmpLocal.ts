import * as snmp from "net-snmp";

export interface ResultadoSnmp {
  hostname: string | null;
  descricao: string | null;
  uptimeSeconds: number | null;
  cpuPct: number | null;
  memoriaPct: number | null;
}

const OIDS = {
  sysDescr: "1.3.6.1.2.1.1.1.0",
  sysUpTime: "1.3.6.1.2.1.1.3.0",
  sysName: "1.3.6.1.2.1.1.5.0",
};

export async function consultarSnmpLocal(host: string, versao: string, community: string, timeoutMs: number): Promise<ResultadoSnmp | null> {
  const versionMap: Record<string, any> = { v1: snmp.Version1, v2c: snmp.Version2c };
  const version = versionMap[versao] ?? snmp.Version2c;
  const session = snmp.createSession(host, community || "public", { version, timeout: timeoutMs, retries: 1 });

  return new Promise((resolve) => {
    session.get([OIDS.sysDescr, OIDS.sysUpTime, OIDS.sysName], (error: any, varbinds: any[]) => {
      session.close();
      if (error) {
        resolve(null);
        return;
      }
      const valores: Record<string, any> = {};
      varbinds.forEach((vb) => {
        if (!snmp.isVarbindError(vb)) valores[vb.oid] = vb.value?.toString?.() ?? vb.value;
      });
      resolve({
        hostname: valores[OIDS.sysName] || null,
        descricao: valores[OIDS.sysDescr] || null,
        uptimeSeconds: valores[OIDS.sysUpTime] ? Math.round(Number(valores[OIDS.sysUpTime]) / 100) : null,
        cpuPct: null,
        memoriaPct: null,
      });
    });
  });
}

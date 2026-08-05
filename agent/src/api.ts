import { AgentConfig } from "./config";

export interface EquipamentoAlvo {
  id: string;
  nome: string;
  ip: string;
  snmp_version: string | null;
  snmp_community: string | null;
  timeout_ms: number;
  tentativas: number;
  intervalo_monitoramento: number;
}

export function criarClienteApi(config: AgentConfig) {
  async function chamar(caminho: string, opcoes: RequestInit = {}) {
    const resp = await fetch(`${config.backendUrl}/api/agent${caminho}`, {
      ...opcoes,
      headers: {
        "Content-Type": "application/json",
        "x-agent-token": config.agentToken,
        ...(opcoes.headers || {}),
      },
    });
    if (!resp.ok) {
      const texto = await resp.text().catch(() => "");
      throw new Error(`HTTP ${resp.status} em ${caminho}: ${texto}`);
    }
    if (resp.status === 204) return null;
    return resp.json();
  }

  return {
    buscarEquipamentos: (): Promise<EquipamentoAlvo[]> => chamar("/equipamentos"),
    enviarResultados: (resultados: any[]) => chamar("/resultados", { method: "POST", body: JSON.stringify({ resultados }) }),
    enviarTrafego: (flows: any[]) => chamar("/trafego", { method: "POST", body: JSON.stringify({ flows }) }),
    enviarSyslog: (mensagens: any[]) => chamar("/trafego/syslog", { method: "POST", body: JSON.stringify({ mensagens }) }),
  };
}

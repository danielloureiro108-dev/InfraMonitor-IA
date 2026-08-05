import { carregarConfig } from "./config";
import { criarClienteApi, EquipamentoAlvo } from "./api";
import { executarPing } from "./pingLocal";
import { consultarSnmpLocal } from "./snmpLocal";
import { iniciarRelayNetflow } from "./netflowRelay";
import { iniciarRelaySyslog } from "./syslogRelay";

const VERSAO = "1.0.0";
const proximaExecucaoPorEquipamento = new Map<string, number>();

async function cicloDeMonitoramento(api: ReturnType<typeof criarClienteApi>, intervaloPadraoSegundos: number) {
  let equipamentos: EquipamentoAlvo[] = [];
  try {
    equipamentos = await api.buscarEquipamentos();
  } catch (e: any) {
    console.error(`[agente] falha ao buscar lista de equipamentos: ${e.message}`);
    return;
  }

  const agora = Date.now();
  const resultados: any[] = [];

  for (const equipamento of equipamentos) {
    const proxima = proximaExecucaoPorEquipamento.get(equipamento.id) || 0;
    if (agora < proxima) continue;
    const intervaloMs = (equipamento.intervalo_monitoramento || intervaloPadraoSegundos) * 1000;
    proximaExecucaoPorEquipamento.set(equipamento.id, agora + intervaloMs);

    const ping = await executarPing(equipamento.ip, equipamento.timeout_ms, equipamento.tentativas);

    let snmp = undefined;
    if (ping.online && equipamento.snmp_version) {
      const r = await consultarSnmpLocal(equipamento.ip, equipamento.snmp_version, equipamento.snmp_community || "public", equipamento.timeout_ms);
      if (r) snmp = r;
    }

    resultados.push({ equipamento_id: equipamento.id, ping, ...(snmp ? { snmp } : {}) });
    console.log(`[agente] ${equipamento.nome} (${equipamento.ip}) → ${ping.online ? `online, ${ping.tempoMs}ms` : "offline"}`);
  }

  if (resultados.length > 0) {
    try {
      await api.enviarResultados(resultados);
    } catch (e: any) {
      console.error(`[agente] falha ao enviar resultados: ${e.message}`);
    }
  }
}

async function main() {
  console.log(`InfraMonitor AI — Agente proxy de monitoramento v${VERSAO}`);
  const config = carregarConfig();
  const api = criarClienteApi(config);

  console.log(`[agente] backend: ${config.backendUrl}`);

  if (config.netflow.ativo) {
    iniciarRelayNetflow(config.netflow.porta, 5000, (flows) => api.enviarTrafego(flows));
  }
  if (config.syslog.ativo) {
    iniciarRelaySyslog(config.syslog.porta, 5000, (mensagens) => api.enviarSyslog(mensagens));
  }

  // Laço principal: verifica a cada 10s quais equipamentos já venceram seu
  // próprio intervalo de monitoramento configurado no InfraMonitor.
  setInterval(() => {
    cicloDeMonitoramento(api, config.intervaloPadraoSegundos).catch((e) => console.error("[agente] erro no ciclo:", e));
  }, 10_000);

  // Primeira execução imediata, sem esperar os 10s iniciais.
  cicloDeMonitoramento(api, config.intervaloPadraoSegundos).catch((e) => console.error("[agente] erro no ciclo inicial:", e));
}

main().catch((e) => {
  console.error("[agente] falha fatal ao iniciar:", e);
  process.exit(1);
});

import { query } from "../db";
import { executarPing, calcularJitter } from "./pingService";
import { consultarSnmp, consultarInterfacesSnmp } from "./snmpService";
import { dispararAlerta, resolverAlerta } from "./alertEngine";
import { transmitir } from "./wsServer";
import { Equipamento } from "../types";

const ultimoTempoPorEquipamento = new Map<string, number | null>();
const proximaExecucaoPorEquipamento = new Map<string, number>();

/**
 * Laço principal de monitoramento. Roda a cada MONITOR_TICK_SECONDS e, a cada
 * execução, verifica quais equipamentos já venceram seu próprio
 * "intervalo_monitoramento" configurado no cadastro.
 */
export function iniciarMonitorWorker() {
  const tickSeconds = Number(process.env.MONITOR_TICK_SECONDS || 15);
  console.log(`[monitor] worker iniciado, verificando equipamentos a cada ${tickSeconds}s`);

  setInterval(() => {
    executarCiclo().catch((e) => console.error("[monitor] erro no ciclo de monitoramento:", e));
  }, tickSeconds * 1000);
}

async function executarCiclo() {
  const agora = Date.now();
  const { rows: equipamentos } = await query<Equipamento>(
    `SELECT * FROM equipamentos WHERE ativo = true`
  );

  await Promise.all(
    equipamentos.map(async (equipamento) => {
      const proxima = proximaExecucaoPorEquipamento.get(equipamento.id) || 0;
      if (agora < proxima) return;
      proximaExecucaoPorEquipamento.set(equipamento.id, agora + equipamento.intervalo_monitoramento * 1000);
      await monitorarEquipamento(equipamento);
    })
  );
}

async function monitorarEquipamento(equipamento: Equipamento) {
  // ---- Ping ICMP ----
  const resultadoPing = await executarPing(equipamento.ip, equipamento.timeout_ms, equipamento.tentativas);
  const tempoAnterior = ultimoTempoPorEquipamento.get(equipamento.id) ?? null;
  const jitter = calcularJitter(resultadoPing.tempoMs, tempoAnterior);
  ultimoTempoPorEquipamento.set(equipamento.id, resultadoPing.tempoMs);

  await query(
    `INSERT INTO historico_ping (equipamento_id, online, tempo_ms, ttl, packet_loss_pct, jitter_ms)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [equipamento.id, resultadoPing.online, resultadoPing.tempoMs, resultadoPing.ttl, resultadoPing.packetLossPct, jitter]
  );

  const novoStatus = await calcularStatus(equipamento.id, resultadoPing.online);
  if (novoStatus !== equipamento.status) {
    await query(`UPDATE equipamentos SET status = $1, atualizado_em = now() WHERE id = $2`, [novoStatus, equipamento.id]);
  }

  await query(
    `INSERT INTO monitoramentos (equipamento_id, tipo, status) VALUES ($1, 'ping', $2)`,
    [equipamento.id, novoStatus]
  );

  transmitir("status_equipamento", { equipamentoId: equipamento.id, status: novoStatus, tempoMs: resultadoPing.tempoMs });

  if (!resultadoPing.online) {
    await dispararAlerta({
      equipamentoId: equipamento.id,
      nomeEquipamento: equipamento.nome,
      tipo: "offline",
      severidade: "alta",
      mensagem: `${equipamento.nome} (${equipamento.ip}) não respondeu ao ping.`,
    });
  } else {
    await resolverAlerta(equipamento.id, "offline");
  }

  if (resultadoPing.online && resultadoPing.tempoMs !== null && resultadoPing.tempoMs > 300) {
    await dispararAlerta({
      equipamentoId: equipamento.id,
      nomeEquipamento: equipamento.nome,
      tipo: "ping_alto",
      severidade: "media",
      mensagem: `${equipamento.nome} com latência elevada: ${resultadoPing.tempoMs}ms.`,
    });
  }

  // ---- SNMP (apenas se o equipamento estiver online, o tipo de monitoramento for SNMP e houver SNMP configurado) ----
  if (resultadoPing.online && equipamento.tipo_monitoramento === "snmp" && equipamento.snmp_version) {
    try {
      const snmpResultado = await consultarSnmp({
        host: equipamento.ip,
        version: equipamento.snmp_version,
        communityEnc: equipamento.snmp_community_enc,
        username: equipamento.snmp_username,
        passwordEnc: equipamento.snmp_password_enc,
        authProtocol: equipamento.snmp_auth_protocol,
        privProtocol: equipamento.snmp_privacy_protocol,
        timeoutMs: equipamento.timeout_ms,
        fabricante: equipamento.fabricante,
      });

      await query(
        `INSERT INTO historico_snmp (equipamento_id, hostname, descricao, uptime_seconds, cpu_pct, memoria_pct, disco_pct, temperatura_c, modelo, versao_firmware, raw)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          equipamento.id,
          snmpResultado.hostname,
          snmpResultado.descricao,
          snmpResultado.uptimeSeconds,
          snmpResultado.cpuPct,
          snmpResultado.memoriaPct,
          snmpResultado.discoPct,
          snmpResultado.temperaturaC,
          snmpResultado.modelo,
          snmpResultado.versaoFirmware,
          JSON.stringify(snmpResultado.raw),
        ]
      );

      if (snmpResultado.cpuPct !== null && snmpResultado.cpuPct > 90) {
        await dispararAlerta({
          equipamentoId: equipamento.id,
          nomeEquipamento: equipamento.nome,
          tipo: "cpu_alta",
          severidade: "alta",
          mensagem: `${equipamento.nome} com CPU em ${snmpResultado.cpuPct}%.`,
        });
      }

      // ---- Tráfego das interfaces (IF-MIB), para o gráfico de Download/Upload ----
      const interfaces = await consultarInterfacesSnmp({
        host: equipamento.ip,
        version: equipamento.snmp_version,
        communityEnc: equipamento.snmp_community_enc,
        timeoutMs: equipamento.timeout_ms,
      });
      if (interfaces.length > 0) {
        await Promise.all(
          interfaces.map((iface) =>
            query(
              `INSERT INTO historico_interfaces_snmp (equipamento_id, if_index, if_descr, if_speed, in_octets, out_octets)
               VALUES ($1,$2,$3,$4,$5,$6)`,
              [equipamento.id, iface.ifIndex, iface.ifDescr, iface.ifSpeed, iface.inOctets, iface.outOctets]
            )
          )
        );
      }
    } catch (e) {
      await dispararAlerta({
        equipamentoId: equipamento.id,
        nomeEquipamento: equipamento.nome,
        tipo: "snmp_indisponivel",
        severidade: "baixa",
        mensagem: `${equipamento.nome}: falha ao consultar SNMP.`,
      });
    }
  }
}

/** Deriva o status (online/offline/instável) a partir do histórico recente de ping. */
async function calcularStatus(equipamentoId: string, ultimoOnline: boolean): Promise<"online" | "offline" | "instavel"> {
  if (!ultimoOnline) return "offline";

  const { rows } = await query<{ online: boolean }>(
    `SELECT online FROM historico_ping WHERE equipamento_id = $1 ORDER BY executado_em DESC LIMIT 5`,
    [equipamentoId]
  );
  const falhas = rows.filter((r) => !r.online).length;
  if (falhas > 0 && falhas < rows.length) return "instavel";
  return "online";
}

import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { query } from "../db";
import { decryptSecret } from "../utils/crypto";
import { dispararAlerta, resolverAlerta } from "../services/alertEngine";
import { transmitir } from "../services/wsServer";
import { mapearAplicacao } from "../utils/portas";
import { extrairFluxoDeSyslog } from "../services/syslogCollector";

export const agentRouter = Router();

/** Autenticação simples por token compartilhado (definido em AGENT_TOKEN no .env do servidor). */
function requireAgentToken(req: Request, res: Response, next: NextFunction) {
  const configurado = process.env.AGENT_TOKEN;
  if (!configurado) return res.status(503).json({ erro: "AGENT_TOKEN não está configurado no servidor" });
  const recebido = req.header("x-agent-token");
  if (recebido !== configurado) return res.status(401).json({ erro: "Token de agente inválido" });
  next();
}

// Lista os equipamentos ativos que o agente deve monitorar, já com a community SNMP
// descriptografada (o agente roda dentro da rede do cliente e precisa dela para
// falar SNMP diretamente com os dispositivos locais).
agentRouter.get("/equipamentos", requireAgentToken, async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, nome, ip, snmp_version, snmp_community_enc, timeout_ms, tentativas, intervalo_monitoramento
       FROM equipamentos WHERE ativo = true`
    );
    const equipamentos = rows.map((e: any) => ({
      id: e.id,
      nome: e.nome,
      ip: e.ip,
      snmp_version: e.snmp_version,
      snmp_community: decryptSecret(e.snmp_community_enc),
      timeout_ms: e.timeout_ms,
      tentativas: e.tentativas,
      intervalo_monitoramento: e.intervalo_monitoramento,
    }));
    res.json(equipamentos);
  } catch (e) {
    next(e);
  }
});

const resultadoSchema = z.object({
  resultados: z.array(
    z.object({
      equipamento_id: z.string().uuid(),
      ping: z.object({
        online: z.boolean(),
        tempoMs: z.number().nullable().optional(),
        ttl: z.number().nullable().optional(),
        packetLossPct: z.number().nullable().optional(),
      }),
      snmp: z
        .object({
          hostname: z.string().nullable().optional(),
          descricao: z.string().nullable().optional(),
          uptimeSeconds: z.number().nullable().optional(),
          cpuPct: z.number().nullable().optional(),
          memoriaPct: z.number().nullable().optional(),
        })
        .optional(),
    })
  ),
});

// Recebe os resultados de ping/SNMP coletados pelo agente e grava exatamente
// como o worker de monitoramento interno grava (mesmo histórico, mesmos alertas).
agentRouter.post("/resultados", requireAgentToken, async (req, res, next) => {
  try {
    const { resultados } = resultadoSchema.parse(req.body);

    for (const r of resultados) {
      const { rows } = await query(`SELECT nome, status FROM equipamentos WHERE id = $1`, [r.equipamento_id]);
      const equipamento = rows[0];
      if (!equipamento) continue;

      await query(
        `INSERT INTO historico_ping (equipamento_id, online, tempo_ms, ttl, packet_loss_pct) VALUES ($1,$2,$3,$4,$5)`,
        [r.equipamento_id, r.ping.online, r.ping.tempoMs ?? null, r.ping.ttl ?? null, r.ping.packetLossPct ?? null]
      );

      const novoStatus = r.ping.online ? "online" : "offline";
      if (novoStatus !== equipamento.status) {
        await query(`UPDATE equipamentos SET status = $1, atualizado_em = now() WHERE id = $2`, [novoStatus, r.equipamento_id]);
      }
      await query(`INSERT INTO monitoramentos (equipamento_id, tipo, status) VALUES ($1, 'agente', $2)`, [r.equipamento_id, novoStatus]);
      transmitir("status_equipamento", { equipamentoId: r.equipamento_id, status: novoStatus, tempoMs: r.ping.tempoMs ?? null });

      if (!r.ping.online) {
        await dispararAlerta({
          equipamentoId: r.equipamento_id,
          nomeEquipamento: equipamento.nome,
          tipo: "offline",
          severidade: "alta",
          mensagem: `${equipamento.nome} não respondeu ao ping (via agente).`,
        });
      } else {
        await resolverAlerta(r.equipamento_id, "offline");
      }

      if (r.snmp) {
        await query(
          `INSERT INTO historico_snmp (equipamento_id, hostname, descricao, uptime_seconds, cpu_pct, memoria_pct)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [r.equipamento_id, r.snmp.hostname ?? null, r.snmp.descricao ?? null, r.snmp.uptimeSeconds ?? null, r.snmp.cpuPct ?? null, r.snmp.memoriaPct ?? null]
        );
      }
    }

    res.json({ recebidos: resultados.length });
  } catch (e) {
    next(e);
  }
});

const trafegoSchema = z.object({
  flows: z.array(
    z.object({
      ipOrigem: z.string(),
      ipDestino: z.string(),
      portaOrigem: z.number().nullable().optional(),
      portaDestino: z.number().nullable().optional(),
      protocolo: z.string().nullable().optional(),
      bytes: z.number().default(0),
      pacotes: z.number().default(0),
    })
  ),
});

// Relay de tráfego (NetFlow/Syslog capturado localmente pelo agente e reenviado via HTTPS)
agentRouter.post("/trafego", requireAgentToken, async (req, res, next) => {
  try {
    const { flows } = trafegoSchema.parse(req.body);
    await Promise.all(
      flows.map((f) =>
        query(
          `INSERT INTO trafego_flows (origem_tipo, ip_origem, ip_destino, porta_origem, porta_destino, protocolo, aplicacao, bytes, pacotes)
           VALUES ('agente', $1,$2,$3,$4,$5,$6,$7,$8)`,
          [f.ipOrigem, f.ipDestino, f.portaOrigem ?? null, f.portaDestino ?? null, f.protocolo ?? null, mapearAplicacao(f.portaDestino), f.bytes, f.pacotes]
        )
      )
    );
    res.json({ recebidos: flows.length });
  } catch (e) {
    next(e);
  }
});

const syslogSchema = z.object({
  mensagens: z.array(z.object({ ipOrigem: z.string().optional(), mensagem: z.string() })),
});

agentRouter.post("/trafego/syslog", requireAgentToken, async (req, res, next) => {
  try {
    const { mensagens } = syslogSchema.parse(req.body);
    for (const m of mensagens) {
      await query(`INSERT INTO logs_syslog (ip_origem, mensagem) VALUES ($1, $2)`, [m.ipOrigem ?? null, m.mensagem]);
      const fluxo = extrairFluxoDeSyslog(m.mensagem);
      if (fluxo) {
        await query(
          `INSERT INTO trafego_flows (origem_tipo, ip_origem, ip_destino, porta_origem, porta_destino, protocolo, aplicacao, bytes, pacotes)
           VALUES ('agente', $1,$2,$3,$4,$5,$6,$7,1)`,
          [fluxo.ipOrigem, fluxo.ipDestino, fluxo.portaOrigem, fluxo.portaDestino, fluxo.protocolo, mapearAplicacao(fluxo.portaDestino), fluxo.bytes]
        );
      }
    }
    res.json({ recebidos: mensagens.length });
  } catch (e) {
    next(e);
  }
});

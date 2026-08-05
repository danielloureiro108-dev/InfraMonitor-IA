import { Router } from "express";
import { query } from "../db";
import { requireAuth } from "../middleware/auth";
import { sincronizarColetorNetflow, statusColetorNetflow } from "../services/netflowCollector";
import { sincronizarColetorSyslog, statusColetorSyslog } from "../services/syslogCollector";
import { gerarInsights, EstatisticasTrafego } from "../services/insightsService";

export const trafegoRouter = Router();

const PERIODOS: Record<string, { intervalo: string; bucketSegundos: number }> = {
  "1h": { intervalo: "1 hour", bucketSegundos: 5 * 60 },
  "6h": { intervalo: "6 hours", bucketSegundos: 15 * 60 },
  "24h": { intervalo: "24 hours", bucketSegundos: 60 * 60 },
  "7d": { intervalo: "7 days", bucketSegundos: 6 * 60 * 60 },
};

function resolverPeriodo(periodo?: string) {
  return PERIODOS[periodo || "24h"] || PERIODOS["24h"];
}

/**
 * Ajusta os coletores NetFlow/Syslog para escutar exatamente nas portas que os
 * equipamentos ativos têm configuradas (ativação e porta são por equipamento,
 * não mais um único coletor global). Chamado na subida do servidor e sempre
 * que um equipamento é criado/editado/excluído.
 */
export async function sincronizarColetoresTrafego() {
  const { rows } = await query<{ netflow_ativo: boolean; netflow_porta: number | null; syslog_ativo: boolean; syslog_porta: number | null }>(
    `SELECT netflow_ativo, netflow_porta, syslog_ativo, syslog_porta FROM equipamentos WHERE ativo = true`
  );
  const portasNetflow = [...new Set(rows.filter((r) => r.netflow_ativo && r.netflow_porta).map((r) => r.netflow_porta!))];
  const portasSyslog = [...new Set(rows.filter((r) => r.syslog_ativo && r.syslog_porta).map((r) => r.syslog_porta!))];
  sincronizarColetorNetflow(portasNetflow);
  sincronizarColetorSyslog(portasSyslog);
}

trafegoRouter.get("/coletores/status", requireAuth, (_req, res) => {
  res.json({ netflow: statusColetorNetflow(), syslog: statusColetorSyslog() });
});

async function coletarEstatisticas(periodo: string): Promise<EstatisticasTrafego> {
  const { intervalo } = resolverPeriodo(periodo);

  const { rows: totalRows } = await query(
    `SELECT COALESCE(SUM(bytes), 0)::bigint AS total FROM trafego_flows WHERE capturado_em > now() - interval '${intervalo}'`
  );
  const totalBytes = Number(totalRows[0].total);

  const { rows: ipRows } = await query(
    `SELECT ip_origem AS chave, SUM(bytes)::bigint AS bytes
     FROM trafego_flows WHERE capturado_em > now() - interval '${intervalo}' AND ip_origem IS NOT NULL
     GROUP BY ip_origem ORDER BY bytes DESC LIMIT 10`
  );

  const { rows: appRows } = await query(
    `SELECT COALESCE(aplicacao, 'Desconhecida') AS chave, SUM(bytes)::bigint AS bytes
     FROM trafego_flows WHERE capturado_em > now() - interval '${intervalo}'
     GROUP BY aplicacao ORDER BY bytes DESC LIMIT 10`
  );

  const comPct = (rows: any[]) =>
    rows.map((r) => ({ chave: r.chave, bytes: Number(r.bytes), pct: totalBytes > 0 ? (Number(r.bytes) / totalBytes) * 100 : 0 }));

  return { periodo, totalBytes, topIps: comPct(ipRows), topAplicacoes: comPct(appRows) };
}

trafegoRouter.get("/resumo", requireAuth, async (req, res, next) => {
  try {
    const { periodo } = req.query as Record<string, string>;
    const { intervalo, bucketSegundos } = resolverPeriodo(periodo);
    const stats = await coletarEstatisticas(periodo);

    const { rows: serieRows } = await query(
      `SELECT to_timestamp(floor(extract(epoch FROM capturado_em) / $1) * $1) AS intervalo_tempo,
              SUM(bytes)::bigint AS bytes
       FROM trafego_flows
       WHERE capturado_em > now() - interval '${intervalo}'
       GROUP BY intervalo_tempo ORDER BY intervalo_tempo ASC`,
      [bucketSegundos]
    );

    res.json({ ...stats, serieTempo: serieRows.map((r: any) => ({ quando: r.intervalo_tempo, bytes: Number(r.bytes) })) });
  } catch (e) {
    next(e);
  }
});

trafegoRouter.get("/insights", requireAuth, async (req, res, next) => {
  try {
    const { periodo } = req.query as Record<string, string>;
    const stats = await coletarEstatisticas(periodo || "24h");
    const resultado = await gerarInsights(stats);
    res.json(resultado);
  } catch (e) {
    next(e);
  }
});

trafegoRouter.get("/flows", requireAuth, async (req, res, next) => {
  try {
    const { periodo, limite, equipamento_id } = req.query as Record<string, string>;
    const { intervalo } = resolverPeriodo(periodo);
    const valores: any[] = [];
    let condicaoEquipamento = "";
    if (equipamento_id) {
      valores.push(equipamento_id);
      condicaoEquipamento = `AND equipamento_id = $${valores.length}`;
    }
    valores.push(Math.min(Number(limite) || 100, 500));
    const { rows } = await query(
      `SELECT * FROM trafego_flows WHERE capturado_em > now() - interval '${intervalo}' ${condicaoEquipamento}
       ORDER BY capturado_em DESC LIMIT $${valores.length}`,
      valores
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

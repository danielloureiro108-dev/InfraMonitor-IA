import { Router } from "express";
import { z } from "zod";
import { query } from "../db";
import { requireAuth, requireRole, AuthRequest } from "../middleware/auth";
import { iniciarColetorNetflow, pararColetorNetflow, statusColetorNetflow } from "../services/netflowCollector";
import { iniciarColetorSyslog, pararColetorSyslog, statusColetorSyslog } from "../services/syslogCollector";
import { gerarInsights, EstatisticasTrafego } from "../services/insightsService";
import { registrarLog } from "../bootstrap";

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

/** Inicializa os coletores conforme a configuração salva no banco — chamado uma vez na subida do servidor. */
export async function inicializarColetoresTrafego() {
  const { rows } = await query(`SELECT chave, valor FROM configuracoes WHERE chave IN ('netflow', 'syslog')`);
  const config = Object.fromEntries(rows.map((r: any) => [r.chave, r.valor]));
  if (config.netflow?.ativo) iniciarColetorNetflow(config.netflow.porta || 2055);
  if (config.syslog?.ativo) iniciarColetorSyslog(config.syslog.porta || 1514);
}

trafegoRouter.get("/config", requireAuth, async (_req, res, next) => {
  try {
    const { rows } = await query(`SELECT chave, valor FROM configuracoes WHERE chave IN ('netflow', 'syslog')`);
    const config: any = Object.fromEntries(rows.map((r: any) => [r.chave, r.valor]));
    res.json({
      netflow: { ...config.netflow, rodando: statusColetorNetflow().ativo },
      syslog: { ...config.syslog, rodando: statusColetorSyslog().ativo },
    });
  } catch (e) {
    next(e);
  }
});

const configSchema = z.object({
  netflow: z.object({ ativo: z.boolean(), porta: z.number().int().min(1).max(65535) }).optional(),
  syslog: z.object({ ativo: z.boolean(), porta: z.number().int().min(1).max(65535) }).optional(),
});

trafegoRouter.put("/config", requireAuth, requireRole("administrador", "operador"), async (req: AuthRequest, res, next) => {
  try {
    const dados = configSchema.parse(req.body);

    if (dados.netflow) {
      await query(
        `INSERT INTO configuracoes (chave, valor) VALUES ('netflow', $1) ON CONFLICT (chave) DO UPDATE SET valor = $1, atualizado_em = now()`,
        [JSON.stringify(dados.netflow)]
      );
      if (dados.netflow.ativo) iniciarColetorNetflow(dados.netflow.porta);
      else pararColetorNetflow();
    }

    if (dados.syslog) {
      await query(
        `INSERT INTO configuracoes (chave, valor) VALUES ('syslog', $1) ON CONFLICT (chave) DO UPDATE SET valor = $1, atualizado_em = now()`,
        [JSON.stringify(dados.syslog)]
      );
      if (dados.syslog.ativo) iniciarColetorSyslog(dados.syslog.porta);
      else pararColetorSyslog();
    }

    await registrarLog(req.user!.sub, "alteracao", "configuracoes", undefined, { modulo: "trafego", ...dados });
    res.json({
      netflow: statusColetorNetflow(),
      syslog: statusColetorSyslog(),
    });
  } catch (e) {
    next(e);
  }
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
    const { periodo, limite } = req.query as Record<string, string>;
    const { intervalo } = resolverPeriodo(periodo);
    const { rows } = await query(
      `SELECT * FROM trafego_flows WHERE capturado_em > now() - interval '${intervalo}'
       ORDER BY capturado_em DESC LIMIT $1`,
      [Math.min(Number(limite) || 100, 500)]
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

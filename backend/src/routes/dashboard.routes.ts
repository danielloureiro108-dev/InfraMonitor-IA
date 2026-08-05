import { Router } from "express";
import { query } from "../db";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { carregarEscopo, condicaoEscopo } from "../utils/escopo";

export const dashboardRouter = Router();

dashboardRouter.get("/resumo", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { empresa_id } = req.query as Record<string, string>;
    const escopo = await carregarEscopo(req.user!.sub, req.user!.perfil);

    const paramsEquip: any[] = [];
    const condicoesEquip: string[] = [];
    if (empresa_id) { paramsEquip.push(empresa_id); condicoesEquip.push(`empresa_id = $${paramsEquip.length}`); }
    const condEscopoEquip = condicaoEscopo(escopo, paramsEquip, "empresa_id", "unidade_id");
    if (condEscopoEquip) condicoesEquip.push(condEscopoEquip);
    const filtroEmpresa = condicoesEquip.length ? `AND ${condicoesEquip.join(" AND ")}` : "";

    const { rows: contagem } = await query(
      `SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'online')::int AS online,
        COUNT(*) FILTER (WHERE status = 'offline')::int AS offline,
        COUNT(*) FILTER (WHERE status = 'instavel')::int AS instaveis,
        COUNT(*) FILTER (WHERE status = 'desconhecido')::int AS desconhecidos
      FROM equipamentos WHERE ativo = true ${filtroEmpresa}`,
      paramsEquip
    );

    const paramsAlertas: any[] = [];
    const condicoesAlertas: string[] = [];
    if (empresa_id) { paramsAlertas.push(empresa_id); condicoesAlertas.push(`e.empresa_id = $${paramsAlertas.length}`); }
    const condEscopoAlertas = condicaoEscopo(escopo, paramsAlertas, "e.empresa_id", "e.unidade_id");
    if (condEscopoAlertas) condicoesAlertas.push(condEscopoAlertas);
    const filtroEmpresaAlertas = condicoesAlertas.length ? `AND ${condicoesAlertas.join(" AND ")}` : "";
    const { rows: alertasAbertos } = await query(
      `SELECT COUNT(*)::int AS total FROM alertas a JOIN equipamentos e ON e.id = a.equipamento_id
       WHERE a.status = 'aberto' ${filtroEmpresaAlertas}`,
      paramsAlertas
    );

    const paramsHist: any[] = [];
    const condicoesHist: string[] = [];
    if (empresa_id) { paramsHist.push(empresa_id); condicoesHist.push(`e.empresa_id = $${paramsHist.length}`); }
    const condEscopoHist = condicaoEscopo(escopo, paramsHist, "e.empresa_id", "e.unidade_id");
    if (condEscopoHist) condicoesHist.push(condEscopoHist);
    const filtroEmpresaHist = condicoesHist.length ? `AND ${condicoesHist.join(" AND ")}` : "";

    const { rows: latencia } = await query(
      `SELECT AVG(h.tempo_ms)::numeric(10,2) AS media
       FROM historico_ping h JOIN equipamentos e ON e.id = h.equipamento_id
       WHERE h.executado_em > now() - interval '1 hour' AND h.online = true ${filtroEmpresaHist}`,
      paramsHist
    );

    const { rows: disponibilidade24h } = await query(
      `SELECT (COUNT(*) FILTER (WHERE h.online = true))::numeric / GREATEST(COUNT(*), 1) * 100 AS pct
       FROM historico_ping h JOIN equipamentos e ON e.id = h.equipamento_id
       WHERE h.executado_em > now() - interval '24 hours' ${filtroEmpresaHist}`,
      paramsHist
    );

    const { rows: disponibilidade7d } = await query(
      `SELECT (COUNT(*) FILTER (WHERE h.online = true))::numeric / GREATEST(COUNT(*), 1) * 100 AS pct
       FROM historico_ping h JOIN equipamentos e ON e.id = h.equipamento_id
       WHERE h.executado_em > now() - interval '7 days' ${filtroEmpresaHist}`,
      paramsHist
    );

    const { rows: ultimaAtualizacao } = await query(
      `SELECT MAX(h.executado_em) AS quando
       FROM historico_ping h JOIN equipamentos e ON e.id = h.equipamento_id
       WHERE 1=1 ${filtroEmpresaHist}`,
      paramsHist
    );

    res.json({
      total: contagem[0].total,
      online: contagem[0].online,
      offline: contagem[0].offline,
      instaveis: contagem[0].instaveis,
      desconhecidos: contagem[0].desconhecidos,
      alertas_abertos: alertasAbertos[0].total,
      latencia_media_ms: Number(latencia[0]?.media || 0),
      disponibilidade_24h_pct: Number(disponibilidade24h[0]?.pct || 0),
      disponibilidade_7d_pct: Number(disponibilidade7d[0]?.pct || 0),
      ultima_atualizacao: ultimaAtualizacao[0]?.quando || null,
    });
  } catch (e) {
    next(e);
  }
});

dashboardRouter.get("/disponibilidade-serie", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { empresa_id, inicio, fim } = req.query as Record<string, string>;
    const periodoSql = req.query.periodo === "7d" ? "7 days" : "24 hours";

    const condicoes: string[] = [];
    const valores: any[] = [];

    if (empresa_id) { valores.push(empresa_id); condicoes.push(`e.empresa_id = $${valores.length}`); }
    const escopo = await carregarEscopo(req.user!.sub, req.user!.perfil);
    const condEscopo = condicaoEscopo(escopo, valores, "e.empresa_id", "e.unidade_id");
    if (condEscopo) condicoes.push(condEscopo);

    if (inicio && fim) {
      valores.push(inicio); condicoes.push(`h.executado_em >= $${valores.length}`);
      valores.push(fim); condicoes.push(`h.executado_em <= $${valores.length}`);
    } else {
      condicoes.push(`h.executado_em > now() - interval '${periodoSql}'`);
    }

    const where = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";

    const { rows } = await query(
      `SELECT date_trunc('hour', h.executado_em) + (extract(minute from h.executado_em)::int / 15) * interval '15 min' AS intervalo,
              AVG(CASE WHEN h.online THEN 100 ELSE 0 END)::numeric(5,1) AS disponibilidade,
              AVG(h.tempo_ms)::numeric(10,1) AS latencia_media
       FROM historico_ping h JOIN equipamentos e ON e.id = h.equipamento_id
       ${where}
       GROUP BY intervalo ORDER BY intervalo ASC`,
      valores
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

dashboardRouter.get("/offline-por-categoria", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { empresa_id } = req.query as Record<string, string>;
    const condicoes = ["e.status = 'offline'", "e.ativo = true"];
    const valores: any[] = [];
    if (empresa_id) { valores.push(empresa_id); condicoes.push(`e.empresa_id = $${valores.length}`); }
    const escopo = await carregarEscopo(req.user!.sub, req.user!.perfil);
    const condEscopo = condicaoEscopo(escopo, valores, "e.empresa_id", "e.unidade_id");
    if (condEscopo) condicoes.push(condEscopo);

    const { rows } = await query(
      `SELECT COALESCE(c.nome, 'Sem categoria') AS categoria, COUNT(*)::int AS total
       FROM equipamentos e
       LEFT JOIN categorias c ON c.id = e.categoria_id
       WHERE ${condicoes.join(" AND ")}
       GROUP BY c.nome ORDER BY total DESC`,
      valores
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

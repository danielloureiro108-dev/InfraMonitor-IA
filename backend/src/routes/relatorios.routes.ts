import { Router } from "express";
import { query } from "../db";
import { requireAuth } from "../middleware/auth";

export const relatoriosRouter = Router();

// Estatísticas de disponibilidade por equipamento, para montar o relatório de
// disponibilidade em PDF. Sem inicio/fim, considera os últimos 30 dias.
relatoriosRouter.get("/disponibilidade", requireAuth, async (req, res, next) => {
  try {
    const { empresa_id, inicio, fim } = req.query as Record<string, string>;
    if (!empresa_id) return res.status(400).json({ erro: "Informe empresa_id" });

    const condicoesHist: string[] = ["h.equipamento_id = e.id"];
    const valores: any[] = [empresa_id];
    if (inicio) { valores.push(inicio); condicoesHist.push(`h.executado_em >= $${valores.length}`); }
    if (fim) { valores.push(fim); condicoesHist.push(`h.executado_em <= $${valores.length}`); }
    if (!inicio && !fim) condicoesHist.push(`h.executado_em > now() - interval '30 days'`);

    const { rows } = await query(
      `SELECT
         e.id, e.nome, e.ip, e.status,
         cat.nome AS categoria_nome,
         COUNT(h.id)::int AS total_amostras,
         COUNT(h.id) FILTER (WHERE h.online)::int AS amostras_online,
         ROUND(
           (COUNT(h.id) FILTER (WHERE h.online))::numeric / GREATEST(COUNT(h.id), 1) * 100, 2
         ) AS disponibilidade_pct,
         ROUND(AVG(h.tempo_ms) FILTER (WHERE h.online)::numeric, 1) AS latencia_media_ms
       FROM equipamentos e
       LEFT JOIN categorias cat ON cat.id = e.categoria_id
       LEFT JOIN historico_ping h ON ${condicoesHist.join(" AND ")}
       WHERE e.empresa_id = $1 AND e.ativo = true
       GROUP BY e.id, e.nome, e.ip, e.status, cat.nome
       ORDER BY e.nome ASC`,
      valores
    );

    res.json(rows);
  } catch (e) {
    next(e);
  }
});

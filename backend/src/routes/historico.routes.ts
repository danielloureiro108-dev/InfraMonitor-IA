import { Router } from "express";
import { query } from "../db";
import { requireAuth } from "../middleware/auth";

export const historicoRouter = Router();

historicoRouter.get("/ping", requireAuth, async (req, res, next) => {
  try {
    const { equipamento_id, empresa_id, inicio, fim, status, limite } = req.query as Record<string, string>;
    const condicoes: string[] = [];
    const valores: any[] = [];

    if (equipamento_id) { valores.push(equipamento_id); condicoes.push(`h.equipamento_id = $${valores.length}`); }
    if (empresa_id) { valores.push(empresa_id); condicoes.push(`e.empresa_id = $${valores.length}`); }
    if (inicio) { valores.push(inicio); condicoes.push(`h.executado_em >= $${valores.length}`); }
    if (fim) { valores.push(fim); condicoes.push(`h.executado_em <= $${valores.length}`); }
    if (status === "online") condicoes.push(`h.online = true`);
    if (status === "offline") condicoes.push(`h.online = false`);

    const where = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";
    valores.push(Math.min(Number(limite) || 200, 1000));

    const { rows } = await query(
      `SELECT h.* FROM historico_ping h JOIN equipamentos e ON e.id = h.equipamento_id
       ${where} ORDER BY h.executado_em DESC LIMIT $${valores.length}`,
      valores
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

historicoRouter.get("/snmp", requireAuth, async (req, res, next) => {
  try {
    const { equipamento_id, limite } = req.query as Record<string, string>;
    const condicoes: string[] = [];
    const valores: any[] = [];
    if (equipamento_id) { valores.push(equipamento_id); condicoes.push(`equipamento_id = $${valores.length}`); }
    const where = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";
    valores.push(Math.min(Number(limite) || 200, 1000));
    const { rows } = await query(
      `SELECT * FROM historico_snmp ${where} ORDER BY executado_em DESC LIMIT $${valores.length}`,
      valores
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// Lista as interfaces com dados coletados para um equipamento (para popular o seletor do gráfico)
historicoRouter.get("/interfaces/lista", requireAuth, async (req, res, next) => {
  try {
    const { equipamento_id } = req.query as Record<string, string>;
    if (!equipamento_id) return res.status(400).json({ erro: "Informe equipamento_id" });
    const { rows } = await query(
      `SELECT DISTINCT ON (if_index) if_index, if_descr, if_speed
       FROM historico_interfaces_snmp
       WHERE equipamento_id = $1 AND executado_em > now() - interval '7 days'
       ORDER BY if_index, executado_em DESC`,
      [equipamento_id]
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

const PERIODOS_TRAFEGO: Record<string, string> = {
  "1h": "1 hour",
  "6h": "6 hours",
  "24h": "24 hours",
  "7d": "7 days",
};

// Série de Download/Upload (Mbps) de uma interface, calculada a partir dos contadores brutos.
historicoRouter.get("/interfaces/trafego", requireAuth, async (req, res, next) => {
  try {
    const { equipamento_id, if_index, periodo } = req.query as Record<string, string>;
    if (!equipamento_id || !if_index) return res.status(400).json({ erro: "Informe equipamento_id e if_index" });
    const intervalo = PERIODOS_TRAFEGO[periodo] || PERIODOS_TRAFEGO["24h"];

    const { rows } = await query(
      `WITH amostras AS (
         SELECT executado_em, in_octets, out_octets,
                LAG(in_octets) OVER (ORDER BY executado_em) AS in_octets_prev,
                LAG(out_octets) OVER (ORDER BY executado_em) AS out_octets_prev,
                LAG(executado_em) OVER (ORDER BY executado_em) AS executado_em_prev
         FROM historico_interfaces_snmp
         WHERE equipamento_id = $1 AND if_index = $2 AND executado_em > now() - interval '${intervalo}'
       )
       SELECT
         executado_em,
         CASE WHEN in_octets_prev IS NOT NULL AND in_octets >= in_octets_prev AND executado_em > executado_em_prev
              THEN ROUND(((in_octets - in_octets_prev) * 8.0) / (EXTRACT(EPOCH FROM (executado_em - executado_em_prev)) * 1000000), 3)
              ELSE NULL END AS download_mbps,
         CASE WHEN out_octets_prev IS NOT NULL AND out_octets >= out_octets_prev AND executado_em > executado_em_prev
              THEN ROUND(((out_octets - out_octets_prev) * 8.0) / (EXTRACT(EPOCH FROM (executado_em - executado_em_prev)) * 1000000), 3)
              ELSE NULL END AS upload_mbps
       FROM amostras
       WHERE in_octets_prev IS NOT NULL
       ORDER BY executado_em ASC`,
      [equipamento_id, if_index]
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

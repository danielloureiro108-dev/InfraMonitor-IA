import { Router } from "express";
import { query } from "../db";
import { requireAuth, requirePermissao, AuthRequest } from "../middleware/auth";
import { registrarLog } from "../bootstrap";

export const alertasRouter = Router();

alertasRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    const { status, empresa_id, inicio, fim } = req.query as Record<string, string>;
    const condicoes: string[] = [];
    const valores: any[] = [];
    if (status) { valores.push(status); condicoes.push(`a.status = $${valores.length}`); }
    if (empresa_id) { valores.push(empresa_id); condicoes.push(`e.empresa_id = $${valores.length}`); }
    if (inicio) { valores.push(inicio); condicoes.push(`a.criado_em >= $${valores.length}`); }
    if (fim) { valores.push(fim); condicoes.push(`a.criado_em <= $${valores.length}`); }
    const where = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";

    const { rows } = await query(
      `SELECT a.*, e.nome AS equipamento_nome, e.ip AS equipamento_ip
       FROM alertas a JOIN equipamentos e ON e.id = a.equipamento_id
       ${where} ORDER BY a.criado_em DESC LIMIT 500`,
      valores
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

alertasRouter.post("/:id/confirmar", requireAuth, requirePermissao("alertas", "escrever"), async (req: AuthRequest, res, next) => {
  try {
    const { rows } = await query(
      `UPDATE alertas SET status = 'confirmado', confirmado_em = now(), confirmado_por = $1 WHERE id = $2 RETURNING id`,
      [req.user!.sub, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ erro: "Alerta não encontrado" });
    await registrarLog(req.user!.sub, "confirmacao_alerta", "alertas", req.params.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

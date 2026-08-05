import { Router } from "express";
import { query } from "../db";
import { requireAuth, requireRole, AuthRequest } from "../middleware/auth";
import { registrarLog } from "../bootstrap";

export const configRouter = Router();

configRouter.get("/", requireAuth, async (_req, res, next) => {
  try {
    const { rows } = await query(`SELECT chave, valor, atualizado_em FROM configuracoes`);
    const objeto = Object.fromEntries(rows.map((r: any) => [r.chave, r.valor]));
    res.json(objeto);
  } catch (e) { next(e); }
});

configRouter.put("/:chave", requireAuth, requireRole("administrador"), async (req: AuthRequest, res, next) => {
  try {
    const { rows } = await query(
      `INSERT INTO configuracoes (chave, valor) VALUES ($1, $2)
       ON CONFLICT (chave) DO UPDATE SET valor = $2, atualizado_em = now()
       RETURNING chave, valor`,
      [req.params.chave, JSON.stringify(req.body)]
    );
    await registrarLog(req.user!.sub, "alteracao", "configuracoes", undefined, { chave: req.params.chave });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

export const logsRouter = Router();

// Logs de auditoria (somente leitura, administrador)
logsRouter.get("/", requireAuth, requireRole("administrador"), async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT l.*, u.nome AS usuario_nome FROM logs l LEFT JOIN usuarios u ON u.id = l.usuario_id ORDER BY criado_em DESC LIMIT 500`
    );
    res.json(rows);
  } catch (e) { next(e); }
});

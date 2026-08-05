import { Router } from "express";
import { z } from "zod";
import { query } from "../db";
import { requireAuth, requireRole, invalidarCachePermissoes, AuthRequest } from "../middleware/auth";
import { registrarLog } from "../bootstrap";

export const permissoesRouter = Router();

// Matriz completa (papel x recurso). Só administradores gerenciam permissões.
permissoesRouter.get("/", requireAuth, requireRole("administrador"), async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT perfil, recurso, pode_ler, pode_escrever, pode_excluir FROM permissoes_papel ORDER BY recurso ASC, perfil ASC`
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

const atualizarSchema = z.object({
  pode_ler: z.boolean(),
  pode_escrever: z.boolean(),
  pode_excluir: z.boolean(),
});

permissoesRouter.put("/:perfil/:recurso", requireAuth, requireRole("administrador"), async (req: AuthRequest, res, next) => {
  try {
    const { perfil, recurso } = req.params as { perfil: "administrador" | "operador" | "visualizador"; recurso: string };
    if (!["administrador", "operador", "visualizador"].includes(perfil)) {
      return res.status(400).json({ erro: "Papel inválido" });
    }
    const dados = atualizarSchema.parse(req.body);

    const { rows } = await query(
      `INSERT INTO permissoes_papel (perfil, recurso, pode_ler, pode_escrever, pode_excluir)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (perfil, recurso) DO UPDATE SET pode_ler = $3, pode_escrever = $4, pode_excluir = $5
       RETURNING perfil, recurso, pode_ler, pode_escrever, pode_excluir`,
      [perfil, recurso, dados.pode_ler, dados.pode_escrever, dados.pode_excluir]
    );
    invalidarCachePermissoes();
    await registrarLog(req.user!.sub, "alteracao", "permissoes_papel", undefined, { perfil, recurso, ...dados });
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

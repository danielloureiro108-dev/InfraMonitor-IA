import { Router } from "express";
import { z } from "zod";
import { query } from "../db";
import { requireAuth, requirePermissao } from "../middleware/auth";

export const orgsRouter = Router();

// Fábrica de CRUD simples para as tabelas de apoio (empresas, unidades, departamentos, categorias).
// "recurso" identifica a linha correspondente na matriz de permissões (Configurações → Permissões).
function criarCrudSimples(tabela: string, campos: string[], recurso: string, parentField?: string) {
  const r = Router();

  r.get("/", requireAuth, async (req, res, next) => {
    try {
      if (parentField && req.query[parentField]) {
        const { rows } = await query(`SELECT * FROM ${tabela} WHERE ${parentField} = $1 ORDER BY nome ASC`, [req.query[parentField]]);
        return res.json(rows);
      }
      const { rows } = await query(`SELECT * FROM ${tabela} ORDER BY nome ASC`);
      res.json(rows);
    } catch (e) { next(e); }
  });

  r.post("/", requireAuth, requirePermissao(recurso, "escrever"), async (req, res, next) => {
    try {
      const colunas = campos.filter((c) => req.body[c] !== undefined);
      const valores = colunas.map((c) => req.body[c]);
      const placeholders = colunas.map((_, i) => `$${i + 1}`);
      const { rows } = await query(
        `INSERT INTO ${tabela} (${colunas.join(",")}) VALUES (${placeholders.join(",")}) RETURNING *`,
        valores
      );
      res.status(201).json(rows[0]);
    } catch (e) { next(e); }
  });

  r.put("/:id", requireAuth, requirePermissao(recurso, "escrever"), async (req, res, next) => {
    try {
      const colunas = campos.filter((c) => req.body[c] !== undefined);
      if (colunas.length === 0) return res.status(400).json({ erro: "Nenhum campo para atualizar" });
      const valores = colunas.map((c) => req.body[c]);
      const sets = colunas.map((c, i) => `${c} = $${i + 1}`);
      valores.push(req.params.id);
      const { rows } = await query(
        `UPDATE ${tabela} SET ${sets.join(", ")} WHERE id = $${valores.length} RETURNING *`,
        valores
      );
      if (!rows[0]) return res.status(404).json({ erro: "Registro não encontrado" });
      res.json(rows[0]);
    } catch (e) { next(e); }
  });

  r.delete("/:id", requireAuth, requirePermissao(recurso, "excluir"), async (req, res, next) => {
    try {
      await query(`DELETE FROM ${tabela} WHERE id = $1`, [req.params.id]);
      res.status(204).send();
    } catch (e) { next(e); }
  });

  return r;
}

orgsRouter.use("/empresas", criarCrudSimples("empresas", ["nome", "cnpj", "logo_url"], "clientes"));
orgsRouter.use("/unidades", criarCrudSimples("unidades", ["empresa_id", "nome", "endereco"], "unidades", "empresa_id"));
orgsRouter.use("/departamentos", criarCrudSimples("departamentos", ["unidade_id", "nome"], "departamentos", "unidade_id"));
orgsRouter.use("/categorias", criarCrudSimples("categorias", ["nome", "icone"], "categorias"));

void z; // reservado para validações futuras específicas por entidade

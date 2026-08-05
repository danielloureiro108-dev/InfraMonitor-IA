import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { query } from "../db";
import { signToken } from "../utils/jwt";
import { requireAuth, requireRole, AuthRequest } from "../middleware/auth";
import { registrarLog } from "../bootstrap";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(1),
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const { email, senha } = loginSchema.parse(req.body);
    const { rows } = await query(`SELECT * FROM usuarios WHERE email = $1 AND ativo = true`, [email]);
    const usuario = rows[0];
    if (!usuario) return res.status(401).json({ erro: "E-mail ou senha inválidos" });

    const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaValida) return res.status(401).json({ erro: "E-mail ou senha inválidos" });

    const token = signToken({ sub: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil });
    await registrarLog(usuario.id, "login", "usuarios", usuario.id);

    res.json({
      token,
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil },
    });
  } catch (e) {
    next(e);
  }
});

const cadastroSchema = z.object({
  nome: z.string().min(2),
  email: z.string().email(),
  senha: z.string().min(6),
  perfil: z.enum(["administrador", "operador", "visualizador"]).default("visualizador"),
});

// Apenas administradores podem cadastrar novos usuários
authRouter.post("/usuarios", requireAuth, requireRole("administrador"), async (req: AuthRequest, res, next) => {
  try {
    const dados = cadastroSchema.parse(req.body);
    const hash = await bcrypt.hash(dados.senha, 10);
    const { rows } = await query(
      `INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES ($1,$2,$3,$4) RETURNING id, nome, email, perfil, ativo, criado_em`,
      [dados.nome, dados.email, hash, dados.perfil]
    );
    await registrarLog(req.user!.sub, "cadastro", "usuarios", rows[0].id);
    res.status(201).json(rows[0]);
  } catch (e: any) {
    if (e.code === "23505") return res.status(409).json({ erro: "Já existe um usuário com esse e-mail" });
    next(e);
  }
});

authRouter.get("/usuarios", requireAuth, requireRole("administrador"), async (_req, res, next) => {
  try {
    const { rows } = await query(`SELECT id, nome, email, perfil, ativo, criado_em FROM usuarios ORDER BY criado_em DESC`);
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

const atualizarUsuarioSchema = z.object({
  ativo: z.boolean().optional(),
  perfil: z.enum(["administrador", "operador", "visualizador"]).optional(),
});

// Ativar/desativar um usuário ou trocar seu perfil (ex: promover operador a administrador)
authRouter.patch("/usuarios/:id", requireAuth, requireRole("administrador"), async (req: AuthRequest, res, next) => {
  try {
    const dados = atualizarUsuarioSchema.parse(req.body);
    if (req.params.id === req.user!.sub && dados.ativo === false) {
      return res.status(400).json({ erro: "Você não pode desativar sua própria conta" });
    }

    const campos: string[] = [];
    const valores: any[] = [];
    Object.entries(dados).forEach(([campo, valor]) => {
      valores.push(valor);
      campos.push(`${campo} = $${valores.length}`);
    });
    if (campos.length === 0) return res.status(400).json({ erro: "Nenhum campo para atualizar" });

    valores.push(req.params.id);
    const { rows } = await query(
      `UPDATE usuarios SET ${campos.join(", ")} WHERE id = $${valores.length} RETURNING id, nome, email, perfil, ativo, criado_em`,
      valores
    );
    if (!rows[0]) return res.status(404).json({ erro: "Usuário não encontrado" });
    await registrarLog(req.user!.sub, "alteracao", "usuarios", req.params.id, dados);
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

authRouter.get("/me", requireAuth, (req: AuthRequest, res) => {
  res.json(req.user);
});

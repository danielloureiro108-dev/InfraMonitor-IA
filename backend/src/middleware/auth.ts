import { Request, Response, NextFunction } from "express";
import { verifyToken, JwtPayload } from "../utils/jwt";
import { query } from "../db";

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ erro: "Token não informado" });
  }
  try {
    req.user = verifyToken(header.slice(7));
    next();
  } catch {
    return res.status(401).json({ erro: "Token inválido ou expirado" });
  }
}

/** Perfis: administrador > operador > visualizador. */
export function requireRole(...perfis: Array<"administrador" | "operador" | "visualizador">) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ erro: "Não autenticado" });
    if (!perfis.includes(req.user.perfil)) {
      return res.status(403).json({ erro: "Você não tem permissão para executar esta ação" });
    }
    next();
  };
}

export type AcaoPermissao = "ler" | "escrever" | "excluir";

interface LinhaPermissao {
  pode_ler: boolean;
  pode_escrever: boolean;
  pode_excluir: boolean;
}

const TTL_CACHE_MS = 30_000;
let cachePermissoes: Map<string, LinhaPermissao> | null = null;
let cacheCarregadaEm = 0;

/** Invalidada sempre que a matriz de permissões é alterada em /permissoes. */
export function invalidarCachePermissoes() {
  cachePermissoes = null;
}

async function carregarPermissoes(): Promise<Map<string, LinhaPermissao>> {
  if (cachePermissoes && Date.now() - cacheCarregadaEm < TTL_CACHE_MS) return cachePermissoes;
  const { rows } = await query<{ perfil: string; recurso: string; pode_ler: boolean; pode_escrever: boolean; pode_excluir: boolean }>(
    `SELECT perfil, recurso, pode_ler, pode_escrever, pode_excluir FROM permissoes_papel`
  );
  const mapa = new Map<string, LinhaPermissao>();
  rows.forEach((r) => mapa.set(`${r.perfil}:${r.recurso}`, { pode_ler: r.pode_ler, pode_escrever: r.pode_escrever, pode_excluir: r.pode_excluir }));
  cachePermissoes = mapa;
  cacheCarregadaEm = Date.now();
  return mapa;
}

/**
 * Verifica a matriz de permissões (papel x recurso) cadastrada em Configurações.
 * Administradores sempre têm acesso total, para nunca ficarem trancados fora
 * do próprio sistema por uma alteração incorreta na matriz.
 */
export function requirePermissao(recurso: string, acao: AcaoPermissao) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ erro: "Não autenticado" });
    if (req.user.perfil === "administrador") return next();

    try {
      const mapa = await carregarPermissoes();
      const linha = mapa.get(`${req.user.perfil}:${recurso}`);
      const campo = acao === "ler" ? "pode_ler" : acao === "escrever" ? "pode_escrever" : "pode_excluir";
      if (!linha || !linha[campo]) {
        return res.status(403).json({ erro: "Você não tem permissão para executar esta ação" });
      }
      next();
    } catch (e) {
      next(e);
    }
  };
}

import { Request, Response, NextFunction } from "express";
import { verifyToken, JwtPayload } from "../utils/jwt";

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

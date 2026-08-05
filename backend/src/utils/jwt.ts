import jwt from "jsonwebtoken";

export interface JwtPayload {
  sub: string;
  nome: string;
  email: string;
  perfil: "administrador" | "operador" | "visualizador";
}

const SECRET = process.env.JWT_SECRET || "change-me";
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, SECRET) as JwtPayload;
}

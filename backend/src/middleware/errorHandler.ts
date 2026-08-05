import { Request, Response, NextFunction } from "express";

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  // eslint-disable-next-line no-console
  console.error("[erro]", err);
  const status = err.status || 500;
  res.status(status).json({
    erro: err.message || "Erro interno do servidor",
  });
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ erro: "Rota não encontrada" });
}

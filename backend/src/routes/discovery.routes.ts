import { Router } from "express";
import { z } from "zod";
import { executarPing } from "../services/pingService";
import { requireAuth, requireRole } from "../middleware/auth";

export const discoveryRouter = Router();

const cidrSchema = z.object({
  rede: z.string().regex(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/, "Use o formato CIDR, ex: 192.168.0.0/24"),
});

function listarIpsDoCidr(cidr: string): string[] {
  const [base, prefixoStr] = cidr.split("/");
  const prefixo = Number(prefixoStr);
  if (prefixo < 22) {
    throw Object.assign(new Error("Redes maiores que /22 não são suportadas na descoberta automática (limite de segurança/performance)."), { status: 400 });
  }
  const partes = base.split(".").map(Number);
  const baseInt = (partes[0] << 24) + (partes[1] << 16) + (partes[2] << 8) + partes[3];
  const totalHosts = 2 ** (32 - prefixo);
  const ips: string[] = [];
  // Ignora endereço de rede (.0) e broadcast (último)
  for (let i = 1; i < totalHosts - 1; i++) {
    const ipInt = baseInt + i;
    const ip = [(ipInt >>> 24) & 255, (ipInt >>> 16) & 255, (ipInt >>> 8) & 255, ipInt & 255].join(".");
    ips.push(ip);
  }
  return ips;
}

// Executa varredura de ping em uma sub-rede informada e retorna os hosts que responderam.
// Limitada a redes /22 ou menores para evitar sobrecarga no worker de monitoramento.
discoveryRouter.post("/scan", requireAuth, requireRole("administrador", "operador"), async (req, res, next) => {
  try {
    const { rede } = cidrSchema.parse(req.body);
    const ips = listarIpsDoCidr(rede);

    const lote = 32; // paraleliza em lotes para não saturar a rede/CPU
    const encontrados: Array<{ ip: string; tempoMs: number | null; ttl: number | null }> = [];

    for (let i = 0; i < ips.length; i += lote) {
      const grupo = ips.slice(i, i + lote);
      // eslint-disable-next-line no-await-in-loop
      const resultados = await Promise.all(
        grupo.map(async (ip) => ({ ip, resultado: await executarPing(ip, 800, 1) }))
      );
      resultados.forEach(({ ip, resultado }) => {
        if (resultado.online) encontrados.push({ ip, tempoMs: resultado.tempoMs, ttl: resultado.ttl });
      });
    }

    res.json({ rede, total_ips_verificados: ips.length, dispositivos_encontrados: encontrados });
  } catch (e) {
    next(e);
  }
});

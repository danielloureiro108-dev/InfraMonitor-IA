import { Router } from "express";
import { z } from "zod";
import { query } from "../db";
import { requireAuth, requireRole, AuthRequest } from "../middleware/auth";
import { encryptSecret } from "../utils/crypto";
import { registrarLog } from "../bootstrap";
import { consultarSnmp } from "../services/snmpService";

export const equipamentosRouter = Router();

const categoriaEnum = z.enum([
  "Computador", "Notebook", "Servidor", "Firewall", "Switch",
  "Access Point", "Impressora", "Storage", "Nobreak", "Outro",
]);

const equipamentoSchema = z.object({
  nome: z.string().min(1),
  descricao: z.string().optional(),
  empresa_id: z.string().uuid().optional().nullable(),
  unidade_id: z.string().uuid().optional().nullable(),
  departamento_id: z.string().uuid().optional().nullable(),
  categoria_id: z.string().uuid().optional().nullable(),
  localizacao: z.string().optional(),
  responsavel: z.string().optional(),
  fabricante: z.string().optional(),
  modelo: z.string().optional(),
  tipo: z.string().optional(),
  sistema_operacional: z.string().optional(),
  hostname: z.string().optional(),
  ip: z.string().min(1),
  mascara: z.string().optional(),
  gateway: z.string().optional(),
  dns: z.string().optional(),
  mac_address: z.string().optional(),
  numero_serie: z.string().optional(),
  patrimonio: z.string().optional(),
  rustdesk_id: z.string().optional(),
  snmp_version: z.enum(["v1", "v2c", "v3"]).optional(),
  snmp_community: z.string().optional(), // texto puro na entrada, criptografado ao salvar
  snmp_username: z.string().optional(),
  snmp_password: z.string().optional(), // texto puro na entrada, criptografado ao salvar
  snmp_auth_protocol: z.string().optional(),
  snmp_privacy_protocol: z.string().optional(),
  intervalo_monitoramento: z.number().int().min(5).default(60),
  timeout_ms: z.number().int().min(100).default(2000),
  tentativas: z.number().int().min(1).max(10).default(3),
  observacoes: z.string().optional(),
  ativo: z.boolean().default(true),
});

// Lista com filtros (status, categoria, empresa, departamento, busca por nome/ip/hostname)
equipamentosRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    const { status, categoria_id, empresa_id, departamento_id, busca } = req.query as Record<string, string>;
    const condicoes: string[] = [];
    const valores: any[] = [];

    if (status) { valores.push(status); condicoes.push(`e.status = $${valores.length}`); }
    if (categoria_id) { valores.push(categoria_id); condicoes.push(`e.categoria_id = $${valores.length}`); }
    if (empresa_id) { valores.push(empresa_id); condicoes.push(`e.empresa_id = $${valores.length}`); }
    if (departamento_id) { valores.push(departamento_id); condicoes.push(`e.departamento_id = $${valores.length}`); }
    if (busca) { valores.push(`%${busca}%`); condicoes.push(`(e.nome ILIKE $${valores.length} OR e.ip ILIKE $${valores.length} OR e.hostname ILIKE $${valores.length})`); }

    const where = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";
    const { rows } = await query(
      `SELECT e.id, e.nome, e.descricao, e.empresa_id, e.unidade_id, e.departamento_id, e.categoria_id, e.localizacao, e.responsavel,
              e.fabricante, e.modelo, e.tipo, e.sistema_operacional, e.hostname, e.ip, e.mascara, e.gateway, e.dns, e.mac_address,
              e.numero_serie, e.patrimonio, e.rustdesk_id, e.snmp_version, e.intervalo_monitoramento, e.timeout_ms, e.tentativas,
              e.observacoes, e.status, e.ativo, e.criado_em, e.atualizado_em,
              emp.nome AS empresa_nome, cat.nome AS categoria_nome
       FROM equipamentos e
       LEFT JOIN empresas emp ON emp.id = e.empresa_id
       LEFT JOIN categorias cat ON cat.id = e.categoria_id
       ${where} ORDER BY e.nome ASC`,
      valores
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

equipamentosRouter.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT e.id, e.nome, e.descricao, e.empresa_id, e.unidade_id, e.departamento_id, e.categoria_id, e.localizacao, e.responsavel,
              e.fabricante, e.modelo, e.tipo, e.sistema_operacional, e.hostname, e.ip, e.mascara, e.gateway, e.dns, e.mac_address,
              e.numero_serie, e.patrimonio, e.rustdesk_id, e.snmp_version, e.snmp_username, e.snmp_auth_protocol,
              e.snmp_privacy_protocol, e.intervalo_monitoramento, e.timeout_ms, e.tentativas, e.observacoes, e.status, e.ativo,
              e.criado_em, e.atualizado_em, emp.nome AS empresa_nome, cat.nome AS categoria_nome
       FROM equipamentos e
       LEFT JOIN empresas emp ON emp.id = e.empresa_id
       LEFT JOIN categorias cat ON cat.id = e.categoria_id
       WHERE e.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ erro: "Equipamento não encontrado" });
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

// Teste avulso de consulta SNMP (não depende de um equipamento salvo) — usado em Configurações.
equipamentosRouter.post("/snmp/testar", requireAuth, requireRole("administrador", "operador"), async (req, res, next) => {
  try {
    const dados = z
      .object({
        ip: z.string().min(1),
        snmp_version: z.enum(["v1", "v2c", "v3"]).default("v2c"),
        community: z.string().optional(),
        timeout_ms: z.number().int().min(200).max(15000).default(3000),
      })
      .parse(req.body);

    const resultado = await consultarSnmp({
      host: dados.ip,
      version: dados.snmp_version,
      community: dados.community,
      timeoutMs: dados.timeout_ms,
    });
    res.json(resultado);
  } catch (e) {
    next(e);
  }
});

equipamentosRouter.post("/", requireAuth, requireRole("administrador", "operador"), async (req: AuthRequest, res, next) => {
  try {
    const d = equipamentoSchema.parse(req.body);
    const { rows } = await query(
      `INSERT INTO equipamentos (
        nome, descricao, empresa_id, unidade_id, departamento_id, categoria_id, localizacao, responsavel,
        fabricante, modelo, tipo, sistema_operacional, hostname, ip, mascara, gateway, dns, mac_address,
        numero_serie, patrimonio, rustdesk_id, snmp_version, snmp_community_enc, snmp_username, snmp_password_enc,
        snmp_auth_protocol, snmp_privacy_protocol, intervalo_monitoramento, timeout_ms, tentativas, observacoes, ativo
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32
      ) RETURNING id`,
      [
        d.nome, d.descricao, d.empresa_id, d.unidade_id, d.departamento_id, d.categoria_id, d.localizacao, d.responsavel,
        d.fabricante, d.modelo, d.tipo, d.sistema_operacional, d.hostname, d.ip, d.mascara, d.gateway, d.dns, d.mac_address,
        d.numero_serie, d.patrimonio, d.rustdesk_id, d.snmp_version, encryptSecret(d.snmp_community), d.snmp_username,
        encryptSecret(d.snmp_password), d.snmp_auth_protocol, d.snmp_privacy_protocol, d.intervalo_monitoramento,
        d.timeout_ms, d.tentativas, d.observacoes, d.ativo,
      ]
    );
    await registrarLog(req.user!.sub, "cadastro", "equipamentos", rows[0].id, { nome: d.nome });
    res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
});

equipamentosRouter.put("/:id", requireAuth, requireRole("administrador", "operador"), async (req: AuthRequest, res, next) => {
  try {
    const d = equipamentoSchema.partial().parse(req.body);
    const campos: string[] = [];
    const valores: any[] = [];

    const mapa: Record<string, any> = { ...d };
    if ("snmp_community" in mapa) { mapa.snmp_community_enc = encryptSecret(mapa.snmp_community); delete mapa.snmp_community; }
    if ("snmp_password" in mapa) { mapa.snmp_password_enc = encryptSecret(mapa.snmp_password); delete mapa.snmp_password; }

    Object.entries(mapa).forEach(([campo, valor]) => {
      valores.push(valor);
      campos.push(`${campo} = $${valores.length}`);
    });
    if (campos.length === 0) return res.status(400).json({ erro: "Nenhum campo para atualizar" });

    valores.push(req.params.id);
    const { rows } = await query(
      `UPDATE equipamentos SET ${campos.join(", ")}, atualizado_em = now() WHERE id = $${valores.length} RETURNING id`,
      valores
    );
    if (!rows[0]) return res.status(404).json({ erro: "Equipamento não encontrado" });
    await registrarLog(req.user!.sub, "alteracao", "equipamentos", req.params.id);
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

equipamentosRouter.delete("/:id", requireAuth, requireRole("administrador"), async (req: AuthRequest, res, next) => {
  try {
    await query(`DELETE FROM equipamentos WHERE id = $1`, [req.params.id]);
    await registrarLog(req.user!.sub, "exclusao", "equipamentos", req.params.id);
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

// Categorias fixas do cadastro (para popular selects no frontend)
equipamentosRouter.get("/meta/categorias-validas", requireAuth, (_req, res) => {
  res.json(categoriaEnum.options);
});

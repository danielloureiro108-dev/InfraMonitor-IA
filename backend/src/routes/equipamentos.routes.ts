import { Router } from "express";
import { z } from "zod";
import { query } from "../db";
import { requireAuth, requirePermissao, AuthRequest } from "../middleware/auth";
import { encryptSecret } from "../utils/crypto";
import { registrarLog } from "../bootstrap";
import { consultarSnmp, walkSnmp, consultarOids } from "../services/snmpService";
import { carregarEscopo, condicaoEscopo, linhaNoEscopo } from "../utils/escopo";
import { sincronizarColetoresTrafego } from "./trafego.routes";

export const equipamentosRouter = Router();

const categoriaEnum = z.enum([
  "Computador", "Notebook", "Servidor", "Firewall", "Switch",
  "Access Point", "Impressora", "Storage", "Nobreak", "Outro",
]);

const camposEquipamento = z.object({
  nome: z.string().min(1),
  descricao: z.string().optional(),
  empresa_id: z.string().uuid().optional().nullable(),
  unidade_id: z.string().uuid().optional().nullable(),
  departamento_id: z.string().uuid().optional().nullable(),
  categoria_id: z.string().uuid().optional().nullable(),
  tipo_monitoramento: z.enum(["icmp", "snmp"]).default("icmp"),
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
  netflow_ativo: z.boolean().default(false),
  netflow_porta: z.number().int().min(1).max(65535).optional().nullable(),
  syslog_ativo: z.boolean().default(false),
  syslog_porta: z.number().int().min(1).max(65535).optional().nullable(),
});

const equipamentoSchema = camposEquipamento
  .refine((d) => !d.netflow_ativo || d.netflow_porta, { message: "Informe a porta UDP do NetFlow", path: ["netflow_porta"] })
  .refine((d) => !d.syslog_ativo || d.syslog_porta, { message: "Informe a porta UDP do Syslog", path: ["syslog_porta"] });

// Lista com filtros (status, categoria, empresa, departamento, busca por nome/ip/hostname)
const COLUNAS_LISTA = `e.id, e.nome, e.descricao, e.empresa_id, e.unidade_id, e.departamento_id, e.categoria_id, e.tipo_monitoramento, e.localizacao, e.responsavel,
              e.fabricante, e.modelo, e.tipo, e.sistema_operacional, e.hostname, e.ip, e.mascara, e.gateway, e.dns, e.mac_address,
              e.numero_serie, e.patrimonio, e.rustdesk_id, e.snmp_version, e.intervalo_monitoramento, e.timeout_ms, e.tentativas,
              e.netflow_ativo, e.netflow_porta, e.syslog_ativo, e.syslog_porta,
              e.observacoes, e.status, e.ativo, e.criado_em, e.atualizado_em,
              emp.nome AS empresa_nome, un.nome AS unidade_nome, cat.nome AS categoria_nome`;

const COLUNAS_DETALHE = `e.id, e.nome, e.descricao, e.empresa_id, e.unidade_id, e.departamento_id, e.categoria_id, e.tipo_monitoramento, e.localizacao, e.responsavel,
              e.fabricante, e.modelo, e.tipo, e.sistema_operacional, e.hostname, e.ip, e.mascara, e.gateway, e.dns, e.mac_address,
              e.numero_serie, e.patrimonio, e.rustdesk_id, e.snmp_version, e.snmp_username, e.snmp_auth_protocol,
              e.snmp_privacy_protocol, e.intervalo_monitoramento, e.timeout_ms, e.tentativas,
              e.netflow_ativo, e.netflow_porta, e.syslog_ativo, e.syslog_porta,
              e.observacoes, e.status, e.ativo,
              e.criado_em, e.atualizado_em, emp.nome AS empresa_nome, un.nome AS unidade_nome, cat.nome AS categoria_nome`;

// Lista com filtros (status, categoria, empresa, departamento, busca por nome/ip/hostname)
equipamentosRouter.get("/", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { status, categoria_id, empresa_id, departamento_id, busca } = req.query as Record<string, string>;
    const condicoes: string[] = [];
    const valores: any[] = [];

    if (status) { valores.push(status); condicoes.push(`e.status = $${valores.length}`); }
    if (categoria_id) { valores.push(categoria_id); condicoes.push(`e.categoria_id = $${valores.length}`); }
    if (empresa_id) { valores.push(empresa_id); condicoes.push(`e.empresa_id = $${valores.length}`); }
    if (departamento_id) { valores.push(departamento_id); condicoes.push(`e.departamento_id = $${valores.length}`); }
    if (busca) { valores.push(`%${busca}%`); condicoes.push(`(e.nome ILIKE $${valores.length} OR e.ip ILIKE $${valores.length} OR e.hostname ILIKE $${valores.length})`); }

    const escopo = await carregarEscopo(req.user!.sub, req.user!.perfil);
    const condicaoEsc = condicaoEscopo(escopo, valores, "e.empresa_id", "e.unidade_id");
    if (condicaoEsc) condicoes.push(condicaoEsc);

    const where = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";
    const { rows } = await query(
      `SELECT ${COLUNAS_LISTA}
       FROM equipamentos e
       LEFT JOIN empresas emp ON emp.id = e.empresa_id
       LEFT JOIN unidades un ON un.id = e.unidade_id
       LEFT JOIN categorias cat ON cat.id = e.categoria_id
       ${where} ORDER BY e.nome ASC`,
      valores
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

equipamentosRouter.get("/:id", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { rows } = await query(
      `SELECT ${COLUNAS_DETALHE}
       FROM equipamentos e
       LEFT JOIN empresas emp ON emp.id = e.empresa_id
       LEFT JOIN unidades un ON un.id = e.unidade_id
       LEFT JOIN categorias cat ON cat.id = e.categoria_id
       WHERE e.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ erro: "Equipamento não encontrado" });

    const escopo = await carregarEscopo(req.user!.sub, req.user!.perfil);
    if (!linhaNoEscopo(escopo, rows[0].empresa_id, rows[0].unidade_id)) {
      return res.status(404).json({ erro: "Equipamento não encontrado" });
    }
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

// Teste avulso de consulta SNMP (não depende de um equipamento salvo) — usado em Configurações.
equipamentosRouter.post("/snmp/testar", requireAuth, requirePermissao("equipamentos", "escrever"), async (req, res, next) => {
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

equipamentosRouter.post("/", requireAuth, requirePermissao("equipamentos", "escrever"), async (req: AuthRequest, res, next) => {
  try {
    const d = equipamentoSchema.parse(req.body);
    const { rows } = await query(
      `INSERT INTO equipamentos (
        nome, descricao, empresa_id, unidade_id, departamento_id, categoria_id, tipo_monitoramento, localizacao, responsavel,
        fabricante, modelo, tipo, sistema_operacional, hostname, ip, mascara, gateway, dns, mac_address,
        numero_serie, patrimonio, rustdesk_id, snmp_version, snmp_community_enc, snmp_username, snmp_password_enc,
        snmp_auth_protocol, snmp_privacy_protocol, intervalo_monitoramento, timeout_ms, tentativas, observacoes, ativo,
        netflow_ativo, netflow_porta, syslog_ativo, syslog_porta
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37
      ) RETURNING id`,
      [
        d.nome, d.descricao, d.empresa_id, d.unidade_id, d.departamento_id, d.categoria_id, d.tipo_monitoramento, d.localizacao, d.responsavel,
        d.fabricante, d.modelo, d.tipo, d.sistema_operacional, d.hostname, d.ip, d.mascara, d.gateway, d.dns, d.mac_address,
        d.numero_serie, d.patrimonio, d.rustdesk_id, d.snmp_version, encryptSecret(d.snmp_community), d.snmp_username,
        encryptSecret(d.snmp_password), d.snmp_auth_protocol, d.snmp_privacy_protocol, d.intervalo_monitoramento,
        d.timeout_ms, d.tentativas, d.observacoes, d.ativo,
        d.netflow_ativo, d.netflow_porta, d.syslog_ativo, d.syslog_porta,
      ]
    );
    await registrarLog(req.user!.sub, "cadastro", "equipamentos", rows[0].id, { nome: d.nome });
    sincronizarColetoresTrafego().catch((e) => console.error("[trafego] falha ao sincronizar coletores:", e));
    res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
});

equipamentosRouter.put("/:id", requireAuth, requirePermissao("equipamentos", "escrever"), async (req: AuthRequest, res, next) => {
  try {
    const d = camposEquipamento.partial().parse(req.body);
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
    sincronizarColetoresTrafego().catch((e) => console.error("[trafego] falha ao sincronizar coletores:", e));
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

equipamentosRouter.delete("/:id", requireAuth, requirePermissao("equipamentos", "excluir"), async (req: AuthRequest, res, next) => {
  try {
    await query(`DELETE FROM equipamentos WHERE id = $1`, [req.params.id]);
    await registrarLog(req.user!.sub, "exclusao", "equipamentos", req.params.id);
    sincronizarColetoresTrafego().catch((e) => console.error("[trafego] falha ao sincronizar coletores:", e));
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

// Categorias fixas do cadastro (para popular selects no frontend)
equipamentosRouter.get("/meta/categorias-validas", requireAuth, (_req, res) => {
  res.json(categoriaEnum.options);
});

async function buscarEquipamentoComEscopo(id: string, req: AuthRequest) {
  const { rows } = await query(
    `SELECT id, ip, empresa_id, unidade_id, fabricante, timeout_ms, snmp_version, snmp_community_enc,
            snmp_username, snmp_password_enc, snmp_auth_protocol, snmp_privacy_protocol
     FROM equipamentos WHERE id = $1`,
    [id]
  );
  if (!rows[0]) return null;
  const escopo = await carregarEscopo(req.user!.sub, req.user!.perfil);
  if (!linhaNoEscopo(escopo, rows[0].empresa_id, rows[0].unidade_id)) return null;
  return rows[0];
}

const walkSchema = z.object({
  oid_base: z.string().regex(/^\d+(\.\d+)*$/, "Use um OID no formato numérico, ex: 1.3.6.1.2.1").optional(),
  timeout_ms: z.number().int().min(200).max(20000).optional(),
});

// SNMPwalk de um equipamento já cadastrado, usando as credenciais SNMP salvas dele.
equipamentosRouter.post("/:id/snmpwalk", requireAuth, requirePermissao("equipamentos", "escrever"), async (req: AuthRequest, res, next) => {
  try {
    const equipamento = await buscarEquipamentoComEscopo(req.params.id, req);
    if (!equipamento) return res.status(404).json({ erro: "Equipamento não encontrado" });
    if (!equipamento.snmp_version) {
      return res.status(400).json({ erro: "Configure o SNMP deste equipamento antes de usar o SNMPwalk" });
    }
    const dados = walkSchema.parse(req.body || {});

    const resultado = await walkSnmp(
      {
        host: equipamento.ip,
        version: equipamento.snmp_version,
        communityEnc: equipamento.snmp_community_enc,
        username: equipamento.snmp_username,
        passwordEnc: equipamento.snmp_password_enc,
        authProtocol: equipamento.snmp_auth_protocol,
        privProtocol: equipamento.snmp_privacy_protocol,
        timeoutMs: dados.timeout_ms || equipamento.timeout_ms,
        fabricante: equipamento.fabricante,
      },
      dados.oid_base
    );
    res.json(resultado);
  } catch (e) {
    next(e);
  }
});

// Lista os OIDs customizados monitorados de um equipamento, com o último valor coletado.
equipamentosRouter.get("/:id/oids", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const equipamento = await buscarEquipamentoComEscopo(req.params.id, req);
    if (!equipamento) return res.status(404).json({ erro: "Equipamento não encontrado" });

    const { rows } = await query(
      `SELECT o.id, o.oid, o.rotulo, o.criado_em, h.valor AS ultimo_valor, h.executado_em AS ultima_leitura_em
       FROM equipamento_oids_monitorados o
       LEFT JOIN LATERAL (
         SELECT valor, executado_em FROM historico_oids_snmp
         WHERE equipamento_id = o.equipamento_id AND oid = o.oid
         ORDER BY executado_em DESC LIMIT 1
       ) h ON true
       WHERE o.equipamento_id = $1
       ORDER BY o.criado_em ASC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

const oidSchema = z.object({
  oid: z.string().regex(/^\d+(\.\d+)*$/, "Use um OID no formato numérico, ex: 1.3.6.1.2.1.1.5.0"),
  rotulo: z.string().max(120).optional(),
});

equipamentosRouter.post("/:id/oids", requireAuth, requirePermissao("equipamentos", "escrever"), async (req: AuthRequest, res, next) => {
  try {
    const equipamento = await buscarEquipamentoComEscopo(req.params.id, req);
    if (!equipamento) return res.status(404).json({ erro: "Equipamento não encontrado" });
    const dados = oidSchema.parse(req.body);

    const { rows } = await query(
      `INSERT INTO equipamento_oids_monitorados (equipamento_id, oid, rotulo) VALUES ($1,$2,$3) RETURNING id, oid, rotulo, criado_em`,
      [req.params.id, dados.oid, dados.rotulo || null]
    );
    await registrarLog(req.user!.sub, "cadastro", "equipamento_oids_monitorados", rows[0].id, { equipamento_id: req.params.id, oid: dados.oid });
    res.status(201).json(rows[0]);
  } catch (e: any) {
    if (e.code === "23505") return res.status(409).json({ erro: "Esse OID já está sendo monitorado neste equipamento" });
    next(e);
  }
});

equipamentosRouter.delete("/:id/oids/:oidId", requireAuth, requirePermissao("equipamentos", "escrever"), async (req: AuthRequest, res, next) => {
  try {
    const equipamento = await buscarEquipamentoComEscopo(req.params.id, req);
    if (!equipamento) return res.status(404).json({ erro: "Equipamento não encontrado" });

    const { rows } = await query(
      `DELETE FROM equipamento_oids_monitorados WHERE id = $1 AND equipamento_id = $2 RETURNING id`,
      [req.params.oidId, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ erro: "OID monitorado não encontrado" });
    await registrarLog(req.user!.sub, "exclusao", "equipamento_oids_monitorados", req.params.oidId);
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

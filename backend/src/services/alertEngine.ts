import nodemailer from "nodemailer";
import { query } from "../db";

interface DispararAlertaParams {
  equipamentoId: string;
  nomeEquipamento: string;
  tipo: string; // ex: "offline", "cpu_alta", "memoria_alta", "disco_cheio", "temperatura", "snmp_indisponivel", "ping_alto", "packet_loss"
  severidade: "baixa" | "media" | "alta" | "critica";
  mensagem: string;
}

/** Cria um alerta (se não houver um já aberto do mesmo tipo para o equipamento) e dispara as notificações configuradas. */
export async function dispararAlerta(params: DispararAlertaParams) {
  const existente = await query(
    `SELECT id FROM alertas WHERE equipamento_id = $1 AND tipo = $2 AND status = 'aberto' LIMIT 1`,
    [params.equipamentoId, params.tipo]
  );
  if (existente.rows.length > 0) return; // evita duplicar alerta já aberto

  const { rows } = await query<{ id: string }>(
    `INSERT INTO alertas (equipamento_id, tipo, severidade, mensagem) VALUES ($1, $2, $3, $4) RETURNING id`,
    [params.equipamentoId, params.tipo, params.severidade, params.mensagem]
  );
  const alertaId = rows[0].id;

  await Promise.allSettled([
    enviarWebhook(alertaId, params),
    enviarTelegram(alertaId, params),
    enviarEmail(alertaId, params),
  ]);
}

/** Reabre/fecha automaticamente um alerta quando a condição deixa de existir (ex.: equipamento voltou a ficar online). */
export async function resolverAlerta(equipamentoId: string, tipo: string) {
  await query(
    `UPDATE alertas SET status = 'resolvido' WHERE equipamento_id = $1 AND tipo = $2 AND status != 'resolvido'`,
    [equipamentoId, tipo]
  );
}

async function registrarNotificacao(alertaId: string, canal: string, status: string, resposta?: string) {
  await query(
    `INSERT INTO notificacoes (alerta_id, canal, status, enviado_em, resposta) VALUES ($1, $2, $3, now(), $4)`,
    [alertaId, canal, status, resposta || null]
  );
}

async function enviarWebhook(alertaId: string, params: DispararAlertaParams) {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        equipamento: params.nomeEquipamento,
        tipo: params.tipo,
        severidade: params.severidade,
        mensagem: params.mensagem,
      }),
    });
    await registrarNotificacao(alertaId, "webhook", resp.ok ? "enviado" : "falhou", `HTTP ${resp.status}`);
  } catch (e: any) {
    await registrarNotificacao(alertaId, "webhook", "falhou", e.message);
  }
}

async function enviarTelegram(alertaId: string, params: DispararAlertaParams) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `⚠️ [${params.severidade.toUpperCase()}] ${params.nomeEquipamento}: ${params.mensagem}`,
      }),
    });
    await registrarNotificacao(alertaId, "telegram", resp.ok ? "enviado" : "falhou", `HTTP ${resp.status}`);
  } catch (e: any) {
    await registrarNotificacao(alertaId, "telegram", "falhou", e.message);
  }
}

async function enviarEmail(alertaId: string, params: DispararAlertaParams) {
  const host = process.env.SMTP_HOST;
  if (!host) return;
  try {
    const transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT || 587),
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
    await transporter.sendMail({
      from: process.env.SMTP_USER || "alertas@inframonitor.local",
      to: process.env.SMTP_USER,
      subject: `[InfraMonitor] Alerta em ${params.nomeEquipamento}`,
      text: params.mensagem,
    });
    await registrarNotificacao(alertaId, "email", "enviado");
  } catch (e: any) {
    await registrarNotificacao(alertaId, "email", "falhou", e.message);
  }
}

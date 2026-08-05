import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { query } from "../db";
import { signToken } from "../utils/jwt";
import { gerarEstadoOAuth, validarEstadoOAuth } from "../utils/crypto";
import { registrarLog } from "../bootstrap";

export const oauthRouter = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const API_URL = process.env.API_URL || "http://localhost:4000";

/** Informa ao frontend quais provedores de login social estão configurados (para exibir/ocultar os botões). */
oauthRouter.get("/oauth-providers", (_req, res) => {
  res.json({
    google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    microsoft: !!(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET),
  });
});

/** Busca um usuário pelo e-mail ou cria um novo (perfil "visualizador" por padrão) para login social. */
async function encontrarOuCriarUsuarioOAuth(email: string, nome: string) {
  const existente = await query(`SELECT * FROM usuarios WHERE email = $1`, [email]);
  if (existente.rows[0]) {
    if (!existente.rows[0].ativo) throw Object.assign(new Error("Sua conta está desativada. Fale com um administrador."), { status: 403 });
    return existente.rows[0];
  }
  // Senha aleatória e inutilizável — este usuário só entra via login social.
  const senhaAleatoria = crypto.randomBytes(32).toString("hex");
  const hash = await bcrypt.hash(senhaAleatoria, 10);
  const criado = await query(
    `INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES ($1,$2,$3,'visualizador') RETURNING *`,
    [nome, email, hash]
  );
  await registrarLog(null, "cadastro_via_login_social", "usuarios", criado.rows[0].id, { email });
  return criado.rows[0];
}

function redirecionarComToken(res: any, token: string) {
  // Usa fragmento (#) em vez de query string para o token não ficar em logs/histórico de proxies.
  res.redirect(`${FRONTEND_URL}/oauth-callback#token=${token}`);
}

function redirecionarComErro(res: any, mensagem: string) {
  res.redirect(`${FRONTEND_URL}/login?erro=${encodeURIComponent(mensagem)}`);
}

// ---------------------------------------------------------------------------
// Google
// ---------------------------------------------------------------------------
oauthRouter.get("/google", (_req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) return redirecionarComErro(res, "Login com Google não está configurado.");

  const state = gerarEstadoOAuth();
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${API_URL}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    prompt: "select_account",
    state,
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

oauthRouter.get("/google/callback", async (req, res) => {
  try {
    const { code, state } = req.query as Record<string, string>;
    if (!validarEstadoOAuth(state)) return redirecionarComErro(res, "Sessão de login expirada, tente novamente.");
    if (!code) return redirecionarComErro(res, "Login com Google cancelado.");

    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${API_URL}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenResp.ok) return redirecionarComErro(res, "Falha ao autenticar com o Google.");
    const tokenData: any = await tokenResp.json();

    const perfilResp = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!perfilResp.ok) return redirecionarComErro(res, "Não foi possível obter seu perfil do Google.");
    const perfil: any = await perfilResp.json();

    if (!perfil.email_verified) return redirecionarComErro(res, "Seu e-mail do Google ainda não foi verificado.");

    const usuario = await encontrarOuCriarUsuarioOAuth(perfil.email, perfil.name || perfil.email);
    const token = signToken({ sub: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil });
    await registrarLog(usuario.id, "login_google", "usuarios", usuario.id);
    redirecionarComToken(res, token);
  } catch (e: any) {
    redirecionarComErro(res, e.message || "Falha inesperada no login com Google.");
  }
});

// ---------------------------------------------------------------------------
// Microsoft Entra ID (Azure AD)
// ---------------------------------------------------------------------------
oauthRouter.get("/microsoft", (_req, res) => {
  if (!process.env.MICROSOFT_CLIENT_ID) return redirecionarComErro(res, "Login com Microsoft não está configurado.");

  const tenant = process.env.MICROSOFT_TENANT_ID || "common";
  const state = gerarEstadoOAuth();
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID,
    redirect_uri: `${API_URL}/api/auth/microsoft/callback`,
    response_type: "code",
    response_mode: "query",
    scope: "openid email profile User.Read",
    state,
  });
  res.redirect(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params.toString()}`);
});

oauthRouter.get("/microsoft/callback", async (req, res) => {
  try {
    const { code, state } = req.query as Record<string, string>;
    if (!validarEstadoOAuth(state)) return redirecionarComErro(res, "Sessão de login expirada, tente novamente.");
    if (!code) return redirecionarComErro(res, "Login com Microsoft cancelado.");

    const tenant = process.env.MICROSOFT_TENANT_ID || "common";
    const tokenResp = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        redirect_uri: `${API_URL}/api/auth/microsoft/callback`,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenResp.ok) return redirecionarComErro(res, "Falha ao autenticar com a Microsoft.");
    const tokenData: any = await tokenResp.json();

    const perfilResp = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!perfilResp.ok) return redirecionarComErro(res, "Não foi possível obter seu perfil da Microsoft.");
    const perfil: any = await perfilResp.json();

    const email = perfil.mail || perfil.userPrincipalName;
    if (!email) return redirecionarComErro(res, "Sua conta Microsoft não retornou um e-mail válido.");

    const usuario = await encontrarOuCriarUsuarioOAuth(email, perfil.displayName || email);
    const token = signToken({ sub: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil });
    await registrarLog(usuario.id, "login_microsoft", "usuarios", usuario.id);
    redirecionarComToken(res, token);
  } catch (e: any) {
    redirecionarComErro(res, e.message || "Falha inesperada no login com Microsoft.");
  }
});

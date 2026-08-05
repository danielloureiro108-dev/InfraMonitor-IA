import crypto from "crypto";

// Deriva uma chave de 32 bytes a partir da variável de ambiente SNMP_ENCRYPTION_KEY.
// Isso garante que, mesmo que a env var não tenha exatamente 32 caracteres,
// sempre teremos uma chave AES-256 válida.
function getKey(): Buffer {
  const secret = process.env.SNMP_ENCRYPTION_KEY || "default-dev-key-change-me!!";
  return crypto.createHash("sha256").update(secret).digest();
}

/** Criptografa uma string sensível (ex.: community SNMP, senha SNMPv3). */
export function encryptSecret(plain: string | null | undefined): string | null {
  if (!plain) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

/** Descriptografa um valor gerado por encryptSecret. */
export function decryptSecret(payload: string | null | undefined): string | null {
  if (!payload) return null;
  const [ivHex, tagHex, dataHex] = payload.split(":");
  if (!ivHex || !tagHex || !dataHex) return null;
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
  return decrypted.toString("utf8");
}

// ---------------------------------------------------------------------------
// Proteção CSRF sem estado para o fluxo OAuth (Google / Microsoft Entra ID).
// Gera um "state" assinado (timestamp + HMAC) que é validado no callback,
// sem precisar de sessão/cookie no servidor.
// ---------------------------------------------------------------------------
function getOAuthStateKey(): string {
  return process.env.JWT_SECRET || "change-me";
}

export function gerarEstadoOAuth(): string {
  const timestamp = Date.now().toString();
  const assinatura = crypto.createHmac("sha256", getOAuthStateKey()).update(timestamp).digest("hex");
  return Buffer.from(`${timestamp}.${assinatura}`).toString("base64url");
}

export function validarEstadoOAuth(state: string | undefined, validadeMs = 10 * 60 * 1000): boolean {
  if (!state) return false;
  try {
    const [timestamp, assinatura] = Buffer.from(state, "base64url").toString("utf8").split(".");
    const esperada = crypto.createHmac("sha256", getOAuthStateKey()).update(timestamp).digest("hex");
    if (assinatura !== esperada) return false;
    return Date.now() - Number(timestamp) < validadeMs;
  } catch {
    return false;
  }
}

import bcrypt from "bcryptjs";
import { pool, query } from "./db";

async function waitForDb(retries = 20, delayMs = 1500) {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query("SELECT 1");
      return;
    } catch {
      console.log(`[bootstrap] aguardando banco de dados... (${i + 1}/${retries})`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error("Não foi possível conectar ao banco de dados após várias tentativas");
}

export async function bootstrap() {
  await waitForDb();

  const { rows } = await query<{ count: string }>("SELECT COUNT(*)::text FROM usuarios");
  if (Number(rows[0].count) === 0) {
    const email = process.env.ADMIN_EMAIL || "admin@inframonitor.local";
    const senha = process.env.ADMIN_PASSWORD || "admin123";
    const hash = await bcrypt.hash(senha, 10);
    await query(
      `INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES ($1, $2, $3, 'administrador')`,
      ["Administrador", email, hash]
    );
    console.log("============================================================");
    console.log(" Usuário administrador criado automaticamente:");
    console.log(` E-mail: ${email}`);
    console.log(` Senha:  ${senha}`);
    console.log(" Troque essa senha assim que possível em Configurações.");
    console.log("============================================================");
  }
}

export async function registrarLog(usuarioId: string | null, acao: string, entidade?: string, entidadeId?: string, detalhes?: any) {
  await query(
    `INSERT INTO logs (usuario_id, acao, entidade, entidade_id, detalhes) VALUES ($1, $2, $3, $4, $5)`,
    [usuarioId, acao, entidade || null, entidadeId || null, detalhes ? JSON.stringify(detalhes) : null]
  );
}

import { Pool, QueryResultRow } from "pg";

const connectionString = process.env.DATABASE_URL;
// Conexões locais (container "db" do docker-compose.yml) não precisam de SSL.
// Conexões externas (ex.: Supabase Cloud) geralmente aceitam/exigem SSL.
const ehConexaoLocal = /@db:|@localhost|@127\.0\.0\.1/.test(connectionString || "");

export const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  ssl: ehConexaoLocal ? undefined : { rejectUnauthorized: false },
});

pool.on("error", (err) => {
  // eslint-disable-next-line no-console
  console.error("[db] erro inesperado no pool de conexões", err);
});

export async function query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<{ rows: T[] }> {
  return pool.query<T>(text, params);
}

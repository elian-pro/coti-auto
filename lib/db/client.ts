import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Postgres es OPCIONAL. Si DATABASE_URL no está seteado, el módulo NO
// crea la conexión y `getDb()` devuelve null. El resto del código verifica
// esto y simplemente salta la persistencia y la página /estus.

const DATABASE_URL = process.env.DATABASE_URL;

let cachedDb: ReturnType<typeof drizzle<typeof schema>> | null = null;
let cachedClient: ReturnType<typeof postgres> | null = null;
let bootstrapped = false;

export function isDbEnabled(): boolean {
  return Boolean(DATABASE_URL);
}

function makeConnection() {
  if (!DATABASE_URL) return null;
  const client = postgres(DATABASE_URL, {
    max: 5,
    idle_timeout: 20,
    // Aceptar SSL sin CA embebido (típico en managed Postgres). Si necesitas
    // strict CA, sube DATABASE_URL con sslmode=require y monta el CA en el
    // filesystem del contenedor.
    ssl: DATABASE_URL.includes("sslmode=require") ? "require" : undefined,
  });
  return { client, db: drizzle(client, { schema }) };
}

export function getDb() {
  if (cachedDb) return cachedDb;
  const conn = makeConnection();
  if (!conn) return null;
  cachedClient = conn.client;
  cachedDb = conn.db;
  return cachedDb;
}

// Auto-bootstrap del esquema. En vez de usar drizzle-kit (que requiere una
// step de generate y aplicar migrations con CLI), usamos CREATE TABLE IF NOT
// EXISTS al arrancar. Simple, idempotente, sin dependencias extra.
const BOOTSTRAP_SQL = `
CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  account TEXT NOT NULL,
  meeting_url TEXT NOT NULL,
  user_email TEXT,
  mode TEXT NOT NULL,
  transcript TEXT,
  proposal_json JSONB,
  evaluation_json JSONB,
  docs_url TEXT,
  sheets_url TEXT,
  pdf_url TEXT,
  evaluation_url TEXT,
  evaluation_score INTEGER,
  evaluation_verdict TEXT,
  tokens_input INTEGER,
  tokens_output INTEGER,
  status TEXT NOT NULL DEFAULT 'ok',
  error_stage TEXT,
  error_message TEXT
);
CREATE INDEX IF NOT EXISTS quotes_created_at_idx ON quotes (created_at DESC);
CREATE INDEX IF NOT EXISTS quotes_account_idx ON quotes (account);
CREATE INDEX IF NOT EXISTS quotes_verdict_idx ON quotes (evaluation_verdict);

CREATE TABLE IF NOT EXISTS insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  window_from TIMESTAMPTZ NOT NULL,
  window_to TIMESTAMPTZ NOT NULL,
  n_transcripts INTEGER NOT NULL,
  content JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS insights_generated_at_idx ON insights (generated_at DESC);
`;

export async function ensureSchema(): Promise<void> {
  if (bootstrapped) return;
  const conn = makeConnection();
  if (!conn) return;
  cachedClient = conn.client;
  cachedDb = conn.db;
  try {
    // Ejecuta el bloque como statement único
    await conn.client.unsafe(BOOTSTRAP_SQL);
    bootstrapped = true;
  } catch (error) {
    console.error(
      "[db] ensureSchema falló. La app sigue viva pero sin persistencia:",
      error instanceof Error ? error.message : String(error),
    );
  }
}

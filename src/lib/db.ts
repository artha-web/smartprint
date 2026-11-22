import { createClient, Client } from "@libsql/client";

let client: Client | null = null;

export function getDb(): Client {
  if (!client) {
    const url = process.env.DATABASE_URL || "file:local.db";
    const authToken = process.env.DATABASE_AUTH_TOKEN;

    client = createClient({
      url,
      authToken,
    });
  }
  return client;
}

// Auto-run schema migrations to ensure tables exist
let schemaInitialized = false;

export async function ensureDbInitialized() {
  if (schemaInitialized) return;

  const db = getDb();

  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS shops (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      shop_code TEXT NOT NULL UNIQUE,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      customer_name TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      storage_key TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      file_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      deleted_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_documents_shop_created ON documents(shop_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_documents_customer ON documents(shop_id, customer_name);
    CREATE INDEX IF NOT EXISTS idx_documents_expires ON documents(file_deleted, expires_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_shops_code ON shops(shop_code);
  `);

  schemaInitialized = true;
}

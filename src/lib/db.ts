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

// Auto-run schema migrations and initial seed to ensure tables and admin exist
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

  // Auto-seed default admin and shop if the database has 0 users
  try {
    const userCountRes = await db.execute("SELECT COUNT(*) as count FROM users");
    const userCount = Number(userCountRes.rows[0]?.count || 0);

    if (userCount === 0) {
      const adminEmail = (process.env.ADMIN_EMAIL || "admin@smartprint.com").trim().toLowerCase();
      const adminPassword = process.env.ADMIN_PASSWORD || "password123";
      const adminName = process.env.ADMIN_NAME || "Shop Owner";
      const shopName = process.env.SHOP_NAME || "Royal Xerox & Stationery";
      const shopCode = (process.env.SHOP_CODE || "royal-xerox").trim().toLowerCase();

      // PBKDF2 hash using native Web Crypto
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const enc = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        "raw",
        enc.encode(adminPassword),
        { name: "PBKDF2" },
        false,
        ["deriveBits", "deriveKey"]
      );

      const hashBuffer = await crypto.subtle.deriveBits(
        {
          name: "PBKDF2",
          salt,
          iterations: 100000,
          hash: "SHA-256",
        },
        keyMaterial,
        256
      );

      const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, "0")).join("");
      const hashHex = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
      const passwordHash = `${saltHex}:${hashHex}`;

      const userId = crypto.randomUUID();
      const shopId = crypto.randomUUID();

      await db.execute({
        sql: "INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)",
        args: [userId, adminEmail, passwordHash, adminName],
      });

      await db.execute({
        sql: "INSERT INTO shops (id, owner_id, name, shop_code, active) VALUES (?, ?, ?, ?, 1)",
        args: [shopId, userId, shopName, shopCode],
      });
    }
  } catch (seedErr) {
    console.error("Auto-seed error in ensureDbInitialized:", seedErr);
  }

  schemaInitialized = true;
}

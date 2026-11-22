// scripts/seed.mjs
// Seeds the database with an initial shopkeeper and shop for development / testing.
import { createClient } from "@libsql/client";

const dbUrl = process.env.DATABASE_URL || "file:local.db";
const dbAuthToken = process.env.DATABASE_AUTH_TOKEN;

const client = createClient({
  url: dbUrl,
  authToken: dbAuthToken,
});

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
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

  return `${saltHex}:${hashHex}`;
}

async function seed() {
  console.log("🌱 Initializing SmartPrint database...");

  // Ensure tables exist
  await client.executeMultiple(`
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

  const email = (process.env.ADMIN_EMAIL || "admin@smartprint.com").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "password123";
  const name = process.env.ADMIN_NAME || "Shop Owner";
  const shopName = process.env.SHOP_NAME || "Royal Xerox & Stationery";
  const shopCode = (process.env.SHOP_CODE || "royal-xerox").trim().toLowerCase();

  // Check if user already exists
  const userCheck = await client.execute({
    sql: "SELECT id FROM users WHERE email = ?",
    args: [email],
  });

  let userId;
  if (userCheck.rows.length > 0) {
    userId = String(userCheck.rows[0].id);
    console.log(`ℹ️ User ${email} already exists.`);
  } else {
    userId = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    await client.execute({
      sql: "INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)",
      args: [userId, email, passwordHash, name],
    });
    console.log(`✅ Created shopkeeper account: ${email}`);
  }

  // Check if shop exists
  const shopCheck = await client.execute({
    sql: "SELECT id FROM shops WHERE shop_code = ?",
    args: [shopCode],
  });

  if (shopCheck.rows.length > 0) {
    console.log(`ℹ️ Shop "${shopCode}" already exists.`);
  } else {
    const shopId = crypto.randomUUID();
    await client.execute({
      sql: "INSERT INTO shops (id, owner_id, name, shop_code, active) VALUES (?, ?, ?, ?, 1)",
      args: [shopId, userId, shopName, shopCode],
    });
    console.log(`✅ Created shop: "${shopName}" (Code: ${shopCode})`);
  }

  console.log("\n==============================================");
  console.log("🎉 Seeding complete! You can sign in with:");
  console.log(`   Email:    ${email}`);
  console.log(`   Password: ${password}`);
  console.log(`   Shop URL: /print/${shopCode}`);
  console.log("==============================================\n");
}

seed().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});

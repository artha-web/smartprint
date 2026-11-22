import { cookies } from "next/headers";
import { getDb, ensureDbInitialized } from "./db";

const SESSION_COOKIE_NAME = "smartprint_session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

export interface Shop {
  id: string;
  owner_id: string;
  name: string;
  shop_code: string;
  phone?: string | null;
  address?: string | null;
  logo_url?: string | null;
  active: number;
  created_at: string;
}

// PBKDF2 Password Hashing using native Web Crypto API (supported in Node, Vercel, Workers)
export async function hashPassword(password: string): Promise<string> {
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

  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, "0")).join("");
  const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

  return `${saltHex}:${hashHex}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split(":");
  if (parts.length !== 2) return false;

  const [saltHex, expectedHashHex] = parts;
  const salt = new Uint8Array(saltHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

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

  const actualHashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
  return actualHashHex === expectedHashHex;
}

// Session Management
export async function createSession(userId: string): Promise<string> {
  await ensureDbInitialized();
  const db = getDb();

  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const sessionId = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, "0")).join("");
  const expiresAt = Date.now() + SESSION_DURATION_MS;

  await db.execute({
    sql: "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)",
    args: [sessionId, userId, expiresAt],
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_DURATION_MS / 1000),
  });

  return sessionId;
}

export async function destroySession(): Promise<void> {
  await ensureDbInitialized();
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionId) {
    const db = getDb();
    await db.execute({
      sql: "DELETE FROM sessions WHERE id = ?",
      args: [sessionId],
    });
    cookieStore.delete(SESSION_COOKIE_NAME);
  }
}

export async function getSession(): Promise<{ user: User; shop: Shop } | null> {
  await ensureDbInitialized();
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionId) return null;

  const db = getDb();
  const now = Date.now();

  const result = await db.execute({
    sql: `
      SELECT s.id as session_id, s.expires_at, 
             u.id as user_id, u.email, u.name as user_name, u.created_at as user_created_at,
             sh.id as shop_id, sh.name as shop_name, sh.shop_code, sh.phone as shop_phone, sh.address as shop_address, sh.logo_url as shop_logo, sh.active as shop_active, sh.created_at as shop_created_at
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      LEFT JOIN shops sh ON sh.owner_id = u.id
      WHERE s.id = ? AND s.expires_at > ?
    `,
    args: [sessionId, now],
  });

  if (result.rows.length === 0) {
    cookieStore.delete(SESSION_COOKIE_NAME);
    return null;
  }

  const row = result.rows[0];

  const user: User = {
    id: String(row.user_id),
    email: String(row.email),
    name: String(row.user_name),
    created_at: String(row.user_created_at),
  };

  const shop: Shop = {
    id: String(row.shop_id || ""),
    owner_id: user.id,
    name: String(row.shop_name || "My Shop"),
    shop_code: String(row.shop_code || ""),
    phone: row.shop_phone ? String(row.shop_phone) : null,
    address: row.shop_address ? String(row.shop_address) : null,
    logo_url: row.shop_logo ? String(row.shop_logo) : null,
    active: Number(row.shop_active ?? 1),
    created_at: String(row.shop_created_at || ""),
  };

  return { user, shop };
}

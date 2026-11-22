import { NextRequest, NextResponse } from "next/server";
import { getDb, ensureDbInitialized } from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "local";

    if (!checkRateLimit(`login:${ip}`, 10, 60000)) {
      return NextResponse.json(
        { error: "Too many login attempts. Please wait a minute and try again." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    await ensureDbInitialized();
    const db = getDb();

    const result = await db.execute({
      sql: "SELECT id, email, password_hash, name FROM users WHERE email = ?",
      args: [email],
    });

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const user = result.rows[0];
    const isValid = await verifyPassword(password, String(user.password_hash));

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    await createSession(String(user.id));

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error during authentication." },
      { status: 500 }
    );
  }
}

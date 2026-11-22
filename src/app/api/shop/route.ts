import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb, ensureDbInitialized } from "@/lib/db";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || !session.shop.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ shop: session.shop });
  } catch (error) {
    console.error("Get shop error:", error);
    return NextResponse.json({ error: "Failed to fetch shop." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.shop.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const name = String(body.name || session.shop.name).trim().slice(0, 100);
    const phone = body.phone !== undefined ? String(body.phone || "").trim().slice(0, 30) : session.shop.phone || null;
    const address = body.address !== undefined ? String(body.address || "").trim().slice(0, 255) : session.shop.address || null;
    const logoUrl = body.logo_url !== undefined ? String(body.logo_url || "").trim() : session.shop.logo_url || null;

    if (!name) {
      return NextResponse.json({ error: "Shop name cannot be empty." }, { status: 400 });
    }

    await ensureDbInitialized();
    const db = getDb();

    await db.execute({
      sql: `
        UPDATE shops 
        SET name = ?, phone = ?, address = ?, logo_url = ?
        WHERE id = ?
      `,
      args: [name, phone, address, logoUrl, session.shop.id],
    });

    return NextResponse.json({
      success: true,
      shop: {
        ...session.shop,
        name,
        phone,
        address,
        logo_url: logoUrl,
      },
    });
  } catch (error) {
    console.error("Update shop error:", error);
    return NextResponse.json({ error: "Failed to update shop profile." }, { status: 500 });
  }
}

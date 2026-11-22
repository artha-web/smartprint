import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { getDb, ensureDbInitialized } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shopCode: string }> }
) {
  try {
    const { shopCode } = await params;

    await ensureDbInitialized();
    const db = getDb();

    const result = await db.execute({
      sql: "SELECT id, name, shop_code FROM shops WHERE shop_code = ? AND active = 1",
      args: [shopCode],
    });

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }

    const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "localhost:3000";
    const proto = request.headers.get("x-forwarded-proto") || "http";
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `${proto}://${host}`;
    const uploadUrl = `${baseUrl}/print/${shopCode}`;

    // Generate local QR code as SVG
    const svg = await QRCode.toString(uploadUrl, {
      type: "svg",
      margin: 2,
      width: 320,
      color: {
        dark: "#172033",
        light: "#ffffff",
      },
    });

    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("QR generation error:", error);
    return NextResponse.json({ error: "Failed to generate QR code." }, { status: 500 });
  }
}

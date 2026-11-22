import { NextRequest, NextResponse } from "next/server";
import { cleanupExpiredDocuments } from "@/lib/cleanup";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // Check if called via Vercel Cron with CRON_SECRET or authenticated shopkeeper
    const isCronAuthorized = cronSecret && authHeader === `Bearer ${cronSecret}`;
    const session = await getSession();

    if (!isCronAuthorized && !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await cleanupExpiredDocuments();

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${result.deletedCount} expired documents.`,
      ...result,
    });
  } catch (error) {
    console.error("Cleanup cron error:", error);
    return NextResponse.json({ error: "Failed to run document cleanup." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}

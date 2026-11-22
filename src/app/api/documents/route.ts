import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb, ensureDbInitialized } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.shop.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensureDbInitialized();
    const db = getDb();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status") || "all"; // 'all' | 'active' | 'expired'
    const dateFilter = searchParams.get("date") || "all"; // 'all' | 'today' | 'yesterday' | 'week'
    const sort = searchParams.get("sort") === "oldest" ? "ASC" : "DESC"; // newest first by default
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 40));
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const offset = (page - 1) * limit;

    let whereClause = "WHERE d.shop_id = ?";
    const args: (string | number)[] = [session.shop.id];

    // Search by customer name or filename
    if (search) {
      whereClause += " AND (d.customer_name LIKE ? OR d.original_filename LIKE ?)";
      args.push(`%${search}%`, `%${search}%`);
    }

    // Filter by active vs expired status
    if (status === "active") {
      whereClause += " AND d.file_deleted = 0 AND datetime('now') < datetime(d.expires_at)";
    } else if (status === "expired") {
      whereClause += " AND (d.file_deleted = 1 OR datetime('now') >= datetime(d.expires_at))";
    }

    // Filter by date
    if (dateFilter === "today") {
      whereClause += " AND date(d.created_at) = date('now')";
    } else if (dateFilter === "yesterday") {
      whereClause += " AND date(d.created_at) = date('now', '-1 day')";
    } else if (dateFilter === "week") {
      whereClause += " AND datetime(d.created_at) >= datetime('now', '-7 days')";
    }

    const countQuery = `SELECT COUNT(*) as total FROM documents d ${whereClause}`;
    const countResult = await db.execute({ sql: countQuery, args });
    const totalCount = Number(countResult.rows[0]?.total || 0);

    const dataQuery = `
      SELECT 
        d.id, d.customer_name, d.original_filename, d.mime_type, d.file_size,
        d.file_deleted, d.created_at, d.expires_at, d.deleted_at,
        CASE 
          WHEN d.file_deleted = 1 OR datetime('now') >= datetime(d.expires_at) THEN 1 
          ELSE 0 
        END as is_expired
      FROM documents d
      ${whereClause}
      ORDER BY d.created_at ${sort}
      LIMIT ? OFFSET ?
    `;

    const dataResult = await db.execute({
      sql: dataQuery,
      args: [...args, limit, offset],
    });

    return NextResponse.json({
      documents: dataResult.rows,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("List documents error:", error);
    return NextResponse.json({ error: "Failed to load documents." }, { status: 500 });
  }
}

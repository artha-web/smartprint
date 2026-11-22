import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb, ensureDbInitialized } from "@/lib/db";
import { deleteFile } from "@/lib/storage";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || !session.shop.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    await ensureDbInitialized();
    const db = getDb();

    // Verify document belongs to this shop
    const docResult = await db.execute({
      sql: "SELECT id, storage_key, shop_id, file_deleted FROM documents WHERE id = ? AND shop_id = ?",
      args: [id, session.shop.id],
    });

    if (docResult.rows.length === 0) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    const doc = docResult.rows[0];

    // If file was not already deleted from R2, delete it
    if (Number(doc.file_deleted) === 0) {
      await deleteFile(String(doc.storage_key));
    }

    // Mark as deleted in DB or delete record
    await db.execute({
      sql: "UPDATE documents SET file_deleted = 1, deleted_at = datetime('now') WHERE id = ?",
      args: [id],
    });

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("Delete document error:", error);
    return NextResponse.json({ error: "Failed to delete document." }, { status: 500 });
  }
}

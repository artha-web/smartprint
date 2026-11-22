import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb, ensureDbInitialized } from "@/lib/db";
import { getFile, deleteFile } from "@/lib/storage";

export async function GET(
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
      sql: `
        SELECT id, shop_id, original_filename, storage_key, mime_type, file_size, 
               file_deleted, created_at, expires_at,
               CASE WHEN file_deleted = 1 OR datetime('now') >= datetime(expires_at) THEN 1 ELSE 0 END as is_expired
        FROM documents 
        WHERE id = ? AND shop_id = ?
      `,
      args: [id, session.shop.id],
    });

    if (docResult.rows.length === 0) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    const doc = docResult.rows[0];

    // If document is expired (> 24h), lazily ensure physical file is cleaned up from R2
    if (Number(doc.is_expired) === 1 || Number(doc.file_deleted) === 1) {
      if (Number(doc.file_deleted) === 0) {
        await deleteFile(String(doc.storage_key));
        await db.execute({
          sql: "UPDATE documents SET file_deleted = 1, deleted_at = datetime('now') WHERE id = ?",
          args: [id],
        });
      }

      return NextResponse.json(
        { error: "This document has expired and the file was automatically removed after 12 hours." },
        { status: 410 }
      );
    }

    // Retrieve file from storage
    const fileData = await getFile(String(doc.storage_key));
    if (!fileData) {
      return NextResponse.json({ error: "File not found in storage." }, { status: 404 });
    }

    const safeFilename = encodeURIComponent(String(doc.original_filename));

    // Stream document inline to browser for native preview/print without downloading
    const headers = new Headers();
    headers.set("Content-Type", String(doc.mime_type));
    headers.set("Content-Disposition", `inline; filename="${safeFilename}"; filename*=UTF-8''${safeFilename}`);
    headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
    headers.set("X-Content-Type-Options", "nosniff");

    if (fileData.stream instanceof Uint8Array) {
      return new Response(Buffer.from(fileData.stream), { status: 200, headers });
    }

    // Handle stream for S3 Body / Node stream
    return new Response(fileData.stream as unknown as ReadableStream, { status: 200, headers });
  } catch (error) {
    console.error("View file error:", error);
    return NextResponse.json({ error: "Failed to stream document." }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";
import { getSession } from "@/lib/auth";
import { getDb, ensureDbInitialized } from "@/lib/db";
import { getFile } from "@/lib/storage";

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

    const docResult = await db.execute({
      sql: `
        SELECT id, shop_id, original_filename, storage_key, mime_type, file_deleted, expires_at,
               CASE WHEN file_deleted = 1 OR datetime('now') >= datetime(expires_at) THEN 1 ELSE 0 END as is_expired
        FROM documents 
        WHERE id = ? AND shop_id = ?
      `,
      args: [id, session.shop.id],
    });

    if (docResult.rows.length === 0) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const doc = docResult.rows[0];

    if (Number(doc.is_expired) === 1 || Number(doc.file_deleted) === 1) {
      return NextResponse.json(
        { error: "Document has expired and was removed after 12 hours." },
        { status: 410 }
      );
    }

    const fileData = await getFile(String(doc.storage_key));
    if (!fileData) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    let buffer: Buffer;
    if (fileData.stream instanceof Uint8Array) {
      buffer = Buffer.from(fileData.stream);
    } else {
      // Collect stream into buffer
      const chunks: Buffer[] = [];
      for await (const chunk of fileData.stream as AsyncIterable<Uint8Array | Buffer>) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      buffer = Buffer.concat(chunks);
    }

    const mime = String(doc.mime_type);

    if (mime.includes("wordprocessingml") || String(doc.original_filename).endsWith(".docx")) {
      const conversion = await mammoth.convertToHtml({ buffer });
      return NextResponse.json({
        type: "docx",
        html: conversion.value,
        title: doc.original_filename,
      });
    } else if (mime === "text/plain" || String(doc.original_filename).endsWith(".txt")) {
      const text = buffer.toString("utf-8");
      return NextResponse.json({
        type: "text",
        text,
        title: doc.original_filename,
      });
    }

    return NextResponse.json({ error: "Not a convertible document." }, { status: 400 });
  } catch (error) {
    console.error("Render document error:", error);
    return NextResponse.json({ error: "Failed to render document." }, { status: 500 });
  }
}

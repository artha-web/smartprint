import { NextRequest, NextResponse } from "next/server";
import { getDb, ensureDbInitialized } from "@/lib/db";
import { checkRateLimit } from "@/lib/validation";

interface CompletedDocumentItem {
  id?: string;
  fileName: string;
  storageKey: string;
  mimeType: string;
  fileSize: number;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ shopCode: string }> }
) {
  try {
    const { shopCode } = await params;
    const ip = request.headers.get("x-forwarded-for") || "local";

    if (!checkRateLimit(`upload:${ip}`, 40, 60000)) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a minute and try again." },
        { status: 429 }
      );
    }

    await ensureDbInitialized();
    const db = getDb();

    // Verify shop exists and is active
    const shopResult = await db.execute({
      sql: "SELECT id, name, active FROM shops WHERE shop_code = ? AND active = 1",
      args: [shopCode],
    });

    if (shopResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Shop not found or currently inactive." },
        { status: 404 }
      );
    }

    const shop = shopResult.rows[0];
    const shopId = String(shop.id);

    const body = await request.json();
    const customerName = String(body.customerName || "").trim();
    const documents: CompletedDocumentItem[] = body.documents;

    if (!customerName || customerName.length < 2) {
      return NextResponse.json(
        { error: "Customer name is required." },
        { status: 400 }
      );
    }

    if (!Array.isArray(documents) || documents.length === 0) {
      return NextResponse.json(
        { error: "No documents to register." },
        { status: 400 }
      );
    }

    const registeredDocuments = [];

    for (const doc of documents) {
      if (!doc.fileName || !doc.storageKey) {
        continue;
      }

      // Security check: ensure storage key belongs to this shop or is UploadThing
      const isAllowedKey =
        doc.storageKey.startsWith(`shops/${shopId}/`) ||
        doc.storageKey.startsWith("uploadthing:");

      if (!isAllowedKey) {
        return NextResponse.json(
          { error: "Invalid storage key identifier." },
          { status: 400 }
        );
      }

      const docId = doc.id || crypto.randomUUID();
      const fileSize = typeof doc.fileSize === "number" ? doc.fileSize : 0;
      const mimeType = doc.mimeType || "application/octet-stream";

      await db.execute({
        sql: `
          INSERT INTO documents (
            id, shop_id, customer_name, original_filename, storage_key,
            mime_type, file_size, file_deleted, created_at, expires_at
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now', '+12 hours')
          )
        `,
        args: [
          docId,
          shopId,
          customerName,
          doc.fileName,
          doc.storageKey,
          mimeType,
          fileSize,
        ],
      });

      registeredDocuments.push({
        id: docId,
        customerName,
        fileName: doc.fileName,
        fileSize,
        mimeType,
      });
    }

    return NextResponse.json({
      success: true,
      count: registeredDocuments.length,
      documents: registeredDocuments,
    });
  } catch (error) {
    console.error("Complete upload error:", error);
    return NextResponse.json(
      { error: "Failed to record uploaded documents." },
      { status: 500 }
    );
  }
}

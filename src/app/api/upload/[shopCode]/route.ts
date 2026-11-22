import { NextRequest, NextResponse } from "next/server";
import { getDb, ensureDbInitialized } from "@/lib/db";
import { uploadFile } from "@/lib/storage";
import {
  MAX_FILE_SIZE_BYTES,
  validateFileContent,
  sanitizeFilename,
  checkRateLimit,
  verifyTurnstileToken,
} from "@/lib/validation";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ shopCode: string }> }
) {
  try {
    const { shopCode } = await params;
    const ip = request.headers.get("x-forwarded-for") || "local";

    if (!checkRateLimit(`upload:${ip}`, 40, 60000)) {
      return NextResponse.json(
        { error: "Too many upload attempts. Please wait a minute and try again." },
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

    const formData = await request.formData();
    const customerNameRaw = formData.get("customerName");
    const turnstileToken = String(formData.get("cf-turnstile-response") || formData.get("turnstileToken") || "");

    const isHuman = await verifyTurnstileToken(turnstileToken, ip);
    if (!isHuman) {
      return NextResponse.json(
        { error: "Security verification failed. Please try again." },
        { status: 403 }
      );
    }

    // Validate Customer Name (Required, 2 to 80 chars)
    const customerName = String(customerNameRaw || "").trim();
    if (!customerName || customerName.length < 2) {
      return NextResponse.json(
        { error: "Please enter your full name so the shopkeeper can identify your printout." },
        { status: 400 }
      );
    }
    if (customerName.length > 80) {
      return NextResponse.json(
        { error: "Customer name must be under 80 characters." },
        { status: 400 }
      );
    }

    // Support both multiple files ("files") and single file ("file")
    let rawFiles = formData.getAll("files");
    if (!rawFiles || rawFiles.length === 0) {
      rawFiles = formData.getAll("file");
    }

    const validFiles = rawFiles.filter((f): f is File => f instanceof File && f.size > 0);

    if (validFiles.length === 0) {
      return NextResponse.json(
        { error: "Please select at least one document to upload." },
        { status: 400 }
      );
    }

    if (validFiles.length > 10) {
      return NextResponse.json(
        { error: "You can upload up to 10 files at a time." },
        { status: 400 }
      );
    }

    const uploadedDocuments = [];

    for (const file of validFiles) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json(
          { error: `"${file.name}" exceeds the 20 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).` },
          { status: 400 }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const validation = validateFileContent(bytes, file.name);

      if (!validation.valid || !validation.mimeType) {
        return NextResponse.json(
          { error: `"${file.name}": ${validation.error || "Unsupported file format."}` },
          { status: 400 }
        );
      }

      const docId = crypto.randomUUID();
      const safeFilename = sanitizeFilename(file.name, validation.mimeType);
      const defaultStorageKey = `shops/${shopId}/uploads/${docId}/${safeFilename}`;

      // Upload to storage (UploadThing, Cloudflare R2, or local disk fallback)
      const uploadResult = await uploadFile(defaultStorageKey, bytes, validation.mimeType, safeFilename);
      const storageKey = uploadResult.storageKey;

      // Save document record in database with 12-hour expiration
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
          safeFilename,
          storageKey,
          validation.mimeType,
          file.size,
        ],
      });

      uploadedDocuments.push({
        id: docId,
        customerName,
        fileName: safeFilename,
        fileSize: file.size,
        mimeType: validation.mimeType,
      });
    }

    return NextResponse.json(
      {
        success: true,
        count: uploadedDocuments.length,
        documents: uploadedDocuments,
        // For backwards compatibility with single upload readers
        document: uploadedDocuments[0],
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "An unexpected server error occurred during upload. Please try again." },
      { status: 500 }
    );
  }
}

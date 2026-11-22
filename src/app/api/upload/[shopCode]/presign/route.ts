import { NextRequest, NextResponse } from "next/server";
import { getDb, ensureDbInitialized } from "@/lib/db";
import { getActiveStorageProvider, getPresignedUploadUrl } from "@/lib/storage";
import {
  MAX_FILE_SIZE_BYTES,
  sanitizeFilename,
  checkRateLimit,
  verifyTurnstileToken,
} from "@/lib/validation";

interface IncomingFileMeta {
  name: string;
  size: number;
  type: string;
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

    const body = await request.json();
    const customerName = String(body.customerName || "").trim();
    const turnstileToken = String(body.turnstileToken || "");
    const files: IncomingFileMeta[] = body.files;

    // Verify turnstile bot check
    const isHuman = await verifyTurnstileToken(turnstileToken, ip);
    if (!isHuman) {
      return NextResponse.json(
        { error: "Security verification failed. Please try again." },
        { status: 403 }
      );
    }

    // Validate Customer Name (Required, 2 to 80 chars)
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

    if (!Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { error: "Please select at least one document to upload." },
        { status: 400 }
      );
    }

    if (files.length > 10) {
      return NextResponse.json(
        { error: "You can upload up to 10 files at a time." },
        { status: 400 }
      );
    }

    for (const f of files) {
      if (typeof f.size !== "number" || f.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json(
          { error: `"${f.name || "File"}" exceeds the 20 MB limit.` },
          { status: 400 }
        );
      }
    }

    const provider = getActiveStorageProvider();

    // 1. Cloudflare R2 / S3: Generate direct presigned PUT URLs (Single Hop directly to CDN)
    if (provider === "r2") {
      const presignedList = [];
      for (const f of files) {
        const docId = crypto.randomUUID();
        const safeFilename = sanitizeFilename(f.name || "document", f.type || "application/octet-stream");
        const storageKey = `shops/${shopId}/uploads/${docId}/${safeFilename}`;
        const contentType = f.type || "application/octet-stream";
        const uploadUrl = await getPresignedUploadUrl(storageKey, contentType);

        if (!uploadUrl) {
          throw new Error("Could not generate presigned upload URL.");
        }

        presignedList.push({
          docId,
          fileName: safeFilename,
          storageKey,
          mimeType: contentType,
          fileSize: f.size,
          uploadUrl,
        });
      }

      return NextResponse.json({
        directMode: "r2",
        shopId,
        customerName,
        files: presignedList,
      });
    }

    // 2. UploadThing: Client uploads directly to UploadThing via SDK
    if (provider === "uploadthing") {
      return NextResponse.json({
        directMode: "uploadthing",
        shopId,
        customerName,
      });
    }

    // 3. Local filesystem fallback for dev
    return NextResponse.json({
      directMode: "local",
      shopId,
      customerName,
    });
  } catch (error) {
    console.error("Presign upload error:", error);
    return NextResponse.json(
      { error: "Failed to initialize upload link. Please try again." },
      { status: 500 }
    );
  }
}

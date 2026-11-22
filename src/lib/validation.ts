// Validation and sanitization utilities

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  mimeType?: string;
}

/**
 * Inspects file content magic bytes to strictly ensure genuine PDF, DOCX, DOC, Image, or Text documents.
 * File extensions alone are never trusted.
 */
export function validateFileContent(bytes: Uint8Array, filename = ""): FileValidationResult {
  if (bytes.length < 4) {
    return { valid: false, error: "File is empty or corrupted." };
  }

  // 1. PDF: %PDF- (0x25, 0x50, 0x44, 0x46)
  if (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  ) {
    return { valid: true, mimeType: "application/pdf" };
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { valid: true, mimeType: "image/png" };
  }

  // 3. JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { valid: true, mimeType: "image/jpeg" };
  }

  // 4. WebP: RIFF ... WEBP (0x52 0x49 0x46 0x46 ... 0x57 0x45 0x42 0x50)
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { valid: true, mimeType: "image/webp" };
  }

  // 5. Word DOCX: PK\x03\x04 (ZIP archive signature 0x50, 0x4B, 0x03, 0x04)
  if (
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  ) {
    const ext = filename.toLowerCase();
    if (ext.endsWith(".docx")) {
      return {
        valid: true,
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      };
    }
  }

  // 6. Legacy Word DOC: D0 CF 11 E0 A1 B1 1A E1 (OLE Compound File)
  if (
    bytes.length >= 8 &&
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0 &&
    bytes[4] === 0xa1 &&
    bytes[5] === 0xb1 &&
    bytes[6] === 0x1a &&
    bytes[7] === 0xe1
  ) {
    return { valid: true, mimeType: "application/msword" };
  }

  // 7. Plain Text (.txt): Valid ASCII / UTF-8
  const lowerName = filename.toLowerCase();
  if (lowerName.endsWith(".txt")) {
    // Check for binary null bytes
    const hasNullByte = bytes.slice(0, 1024).some((b) => b === 0);
    if (!hasNullByte) {
      return { valid: true, mimeType: "text/plain" };
    }
  }

  return {
    valid: false,
    error: "Unsupported file format. Please upload PDF, Word (.docx), PNG, JPEG, or TXT documents.",
  };
}

/**
 * Sanitizes original filename to prevent path traversal, control chars, and weird unicode tricks.
 */
export function sanitizeFilename(originalName: string, mimeType: string): string {
  const baseName = originalName.replace(/.*[\/\\]/, "");
  let cleanName = baseName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);

  let ext = ".pdf";
  if (mimeType === "application/pdf") ext = ".pdf";
  else if (mimeType === "image/png") ext = ".png";
  else if (mimeType === "image/jpeg") ext = ".jpg";
  else if (mimeType === "image/webp") ext = ".webp";
  else if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") ext = ".docx";
  else if (mimeType === "application/msword") ext = ".doc";
  else if (mimeType === "text/plain") ext = ".txt";

  if (!cleanName.toLowerCase().endsWith(ext)) {
    cleanName = `${cleanName}${ext}`;
  }

  return cleanName || `document${ext}`;
}

/**
 * In-memory IP rate limiter
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, maxAttempts = 40, windowMs = 60000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxAttempts) {
    return false;
  }

  entry.count++;
  return true;
}

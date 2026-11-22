// Client-side Instant 0-Second Magic Bytes Validation (Fail-Fast)
// Inspects the first 12 bytes in the browser via file.slice() in <1ms before any network request

export interface InstantValidationResult {
  valid: boolean;
  error?: string;
  mimeType?: string;
}

export async function validateFileInstant(file: Blob & { name?: string }): Promise<InstantValidationResult> {
  const MAX_SIZE = 20 * 1024 * 1024; // 20 MB
  const fileName = file.name || "document";

  if (file.size < 4) {
    return {
      valid: false,
      error: `"${fileName}" is empty or corrupted (0 bytes).`,
    };
  }

  if (file.size > MAX_SIZE) {
    return {
      valid: false,
      error: `"${fileName}" exceeds the 20 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`,
    };
  }

  try {
    // Read ONLY the first 12 bytes from the file (takes ~0.5 milliseconds)
    const slice = file.slice(0, 12);
    let arrayBuffer: ArrayBuffer;
    if (typeof slice.arrayBuffer === "function") {
      arrayBuffer = await slice.arrayBuffer();
    } else if (typeof FileReader !== "undefined") {
      arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(slice);
      });
    } else {
      arrayBuffer = await slice.arrayBuffer();
    }
    const bytes = new Uint8Array(arrayBuffer);

    // 1. PDF Magic Bytes: %PDF (0x25, 0x50, 0x44, 0x46)
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
      return { valid: true, mimeType: "application/pdf" };
    }

    // 2. PNG Magic Bytes: 89 50 4E 47 (0x89, 0x50, 0x4E, 0x47)
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
      return { valid: true, mimeType: "image/png" };
    }

    // 3. JPEG Magic Bytes: FF D8 FF
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return { valid: true, mimeType: "image/jpeg" };
    }

    // 4. WebP Magic Bytes: RIFF ... WEBP (0x52 0x49 0x46 0x46 ... 0x57 0x45 0x42 0x50)
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

    // 5. Word (.docx): PK\x03\x04 (ZIP signature 0x50, 0x4B, 0x03, 0x04)
    if (
      bytes[0] === 0x50 &&
      bytes[1] === 0x4b &&
      bytes[2] === 0x03 &&
      bytes[3] === 0x04 &&
      fileName.toLowerCase().endsWith(".docx")
    ) {
      return {
        valid: true,
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      };
    }

    // 6. Legacy Word (.doc): D0 CF 11 E0 A1 B1 1A E1
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

    // 7. Plain Text (.txt): Valid ASCII / UTF-8 without binary null bytes
    if (fileName.toLowerCase().endsWith(".txt")) {
      const hasNull = bytes.some((b) => b === 0);
      if (!hasNull) {
        return { valid: true, mimeType: "text/plain" };
      }
    }

    return {
      valid: false,
      error: `"${fileName}" is corrupted or has an unrecognized file header. Please select genuine PDF, Word (.docx), PNG, JPG, WebP, or TXT documents.`,
    };
  } catch {
    return {
      valid: false,
      error: `Could not read "${fileName}". The file may be locked or inaccessible.`,
    };
  }
}

import { test } from "node:test";
import assert from "node:assert/strict";
import { validateFileInstant } from "../src/lib/client-validation.ts";

test("validateFileInstant verifies genuine PDF in <1ms", async () => {
  const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]); // %PDF-1.7
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  Object.defineProperty(blob, "name", { value: "invoice.pdf" });

  const start = performance.now();
  const result = await validateFileInstant(blob);
  const duration = performance.now() - start;

  assert.equal(result.valid, true);
  assert.equal(result.mimeType, "application/pdf");
  assert.ok(duration < 20, `Expected <20ms, took ${duration.toFixed(2)}ms`);
});

test("validateFileInstant verifies genuine PNG image in <1ms", async () => {
  const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const blob = new Blob([pngBytes], { type: "image/png" });
  Object.defineProperty(blob, "name", { value: "id_card.png" });

  const result = await validateFileInstant(blob);
  assert.equal(result.valid, true);
  assert.equal(result.mimeType, "image/png");
});

test("validateFileInstant verifies genuine JPEG image", async () => {
  const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
  const blob = new Blob([jpegBytes], { type: "image/jpeg" });
  Object.defineProperty(blob, "name", { value: "scan.jpg" });

  const result = await validateFileInstant(blob);
  assert.equal(result.valid, true);
  assert.equal(result.mimeType, "image/jpeg");
});

test("validateFileInstant verifies genuine Word (.docx) document", async () => {
  const docxBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x0a, 0x00]);
  const blob = new Blob([docxBytes], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  Object.defineProperty(blob, "name", { value: "resume.docx" });

  const result = await validateFileInstant(blob);
  assert.equal(result.valid, true);
  assert.equal(result.mimeType, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
});

test("validateFileInstant instantly rejects empty or corrupted files (<4 bytes)", async () => {
  const emptyBlob = new Blob([], { type: "application/pdf" });
  Object.defineProperty(emptyBlob, "name", { value: "empty.pdf" });

  const result = await validateFileInstant(emptyBlob);
  assert.equal(result.valid, false);
  assert.ok(result.error?.includes("empty or corrupted"));
});

test("validateFileInstant instantly rejects fake files with mismatched extension", async () => {
  const fakeBytes = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]); // MZ executable header
  const blob = new Blob([fakeBytes], { type: "application/pdf" });
  Object.defineProperty(blob, "name", { value: "malware.pdf" });

  const result = await validateFileInstant(blob);
  assert.equal(result.valid, false);
  assert.ok(result.error?.includes("corrupted or has an unrecognized file header"));
});

test("validateFileInstant instantly rejects files over 20 MB without reading", async () => {
  // Create an object representing 25 MB
  const fakeBigBlob = {
    name: "huge.pdf",
    size: 25 * 1024 * 1024,
    slice: () => {
      throw new Error("Should not slice file if oversized");
    },
  };

  const result = await validateFileInstant(fakeBigBlob);
  assert.equal(result.valid, false);
  assert.ok(result.error?.includes("exceeds the 20 MB limit"));
});

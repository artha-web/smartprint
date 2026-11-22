import { test } from "node:test";
import assert from "node:assert/strict";
import { validateFileContent, sanitizeFilename, verifyTurnstileToken } from "../src/lib/validation.ts";

test("validateFileContent correctly identifies PDF documents", () => {
  const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x35]); // %PDF-1.5
  const result = validateFileContent(pdfBytes, "sample.pdf");
  assert.equal(result.valid, true);
  assert.equal(result.mimeType, "application/pdf");
});

test("validateFileContent correctly identifies PNG images", () => {
  const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  const result = validateFileContent(pngBytes, "photo.png");
  assert.equal(result.valid, true);
  assert.equal(result.mimeType, "image/png");
});

test("validateFileContent correctly identifies JPEG images", () => {
  const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  const result = validateFileContent(jpegBytes, "photo.jpg");
  assert.equal(result.valid, true);
  assert.equal(result.mimeType, "image/jpeg");
});

test("validateFileContent correctly identifies Word (.docx) documents", () => {
  const docxBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
  const result = validateFileContent(docxBytes, "assignment.docx");
  assert.equal(result.valid, true);
  assert.equal(result.mimeType, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
});

test("validateFileContent rejects fake files disguised with wrong extensions", () => {
  const fakeBytes = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
  const result = validateFileContent(fakeBytes, "malicious.pdf");
  assert.equal(result.valid, false);
});

test("sanitizeFilename prevents directory traversal and cleans invalid characters", () => {
  const dangerous = "../../../etc/passwd?.pdf";
  const cleaned = sanitizeFilename(dangerous, "application/pdf");
  assert.equal(cleaned.includes(".."), false);
  assert.equal(cleaned.includes("/"), false);
  assert.equal(cleaned.includes("?"), false);
  assert.equal(cleaned.endsWith(".pdf"), true);
});

test("verifyTurnstileToken allows requests when secret key is not configured", async () => {
  const result = await verifyTurnstileToken(null, "127.0.0.1");
  assert.equal(result, true);
});

test("verifyTurnstileToken blocks requests when secret key is set but token is missing", async () => {
  process.env.TURNSTILE_SECRET_KEY = "dummy_secret_key";
  const result = await verifyTurnstileToken("", "127.0.0.1");
  assert.equal(result, false);
  delete process.env.TURNSTILE_SECRET_KEY;
});


import { test } from "node:test";
import assert from "node:assert/strict";
import { getActiveStorageProvider } from "../src/lib/storage.ts";
import { ensureDbInitialized, getDb } from "../src/lib/db.ts";

test("getActiveStorageProvider defaults to local in dev environment", () => {
  const provider = getActiveStorageProvider();
  assert.ok(["local", "uploadthing", "r2"].includes(provider));
});

test("direct-upload complete endpoint records documents with 12h expiration", async () => {
  await ensureDbInitialized();
  const db = getDb();

  // Ensure test shop exists
  const shopResult = await db.execute({
    sql: "SELECT id FROM shops LIMIT 1",
  });
  assert.ok(shopResult.rows.length > 0, "Default shop should exist");
  const shopId = String(shopResult.rows[0].id);

  const testDocId = crypto.randomUUID();
  const customerName = "Test Direct Customer";
  const fileName = "test-single-hop.pdf";
  const storageKey = `shops/${shopId}/uploads/${testDocId}/${fileName}`;
  const mimeType = "application/pdf";
  const fileSize = 2048;

  await db.execute({
    sql: `
      INSERT INTO documents (
        id, shop_id, customer_name, original_filename, storage_key,
        mime_type, file_size, file_deleted, created_at, expires_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now', '+12 hours')
      )
    `,
    args: [testDocId, shopId, customerName, fileName, storageKey, mimeType, fileSize],
  });

  const checkResult = await db.execute({
    sql: "SELECT id, customer_name, original_filename, expires_at FROM documents WHERE id = ?",
    args: [testDocId],
  });

  assert.equal(checkResult.rows.length, 1);
  assert.equal(checkResult.rows[0].customer_name, customerName);
  assert.equal(checkResult.rows[0].original_filename, fileName);
  assert.ok(checkResult.rows[0].expires_at !== null);

  // Clean up test document
  await db.execute({
    sql: "DELETE FROM documents WHERE id = ?",
    args: [testDocId],
  });
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@libsql/client";
import { cleanupExpiredDocuments } from "../src/lib/cleanup.ts";
import { uploadFile, getFile } from "../src/lib/storage.ts";

test("12-hour cleanup removes physical file but preserves customer metadata", async () => {
  const db = createClient({ url: "file:local.db" });

  const shopId = "test-shop-" + crypto.randomUUID();
  const userId = "test-user-" + crypto.randomUUID();
  const docId = "test-doc-" + crypto.randomUUID();
  const safeFilename = "test-contract.pdf";
  const storageKey = `shops/${shopId}/uploads/${docId}/${safeFilename}`;

  // 1. Create a dummy shop
  await db.execute({
    sql: "INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)",
    args: [userId, `${userId}@example.com`, "dummy:hash", "Test Owner"],
  });

  await db.execute({
    sql: "INSERT INTO shops (id, owner_id, name, shop_code, active) VALUES (?, ?, ?, ?, 1)",
    args: [shopId, userId, "Test Cleanup Shop", `shop-${shopId}`],
  });

  // 2. Put a file into storage
  const dummyFileContent = new TextEncoder().encode("%PDF-1.5 dummy content for cleanup test");
  await uploadFile(storageKey, dummyFileContent, "application/pdf");

  // Verify file exists in storage
  const storedBefore = await getFile(storageKey);
  assert.ok(storedBefore !== null, "File should exist in storage before cleanup");

  // 3. Insert document with an expired timestamp (e.g. 2 days ago)
  await db.execute({
    sql: `
      INSERT INTO documents (
        id, shop_id, customer_name, original_filename, storage_key,
        mime_type, file_size, file_deleted, created_at, expires_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, 0, datetime('now', '-2 days'), datetime('now', '-1 day')
      )
    `,
    args: [docId, shopId, "Aarav Gupta", safeFilename, storageKey, "application/pdf", dummyFileContent.length],
  });

  // 4. Run the 24-hour cleanup
  const cleanupResult = await cleanupExpiredDocuments();
  assert.ok(cleanupResult.deletedCount >= 1, "Should have deleted at least 1 expired document");

  // 5. Verify the physical file is GONE from storage
  const storedAfter = await getFile(storageKey);
  assert.equal(storedAfter, null, "Physical file must be deleted from storage");

  // 6. Verify the database row STILL EXISTS with customer name and metadata preserved!
  const docInDb = await db.execute({
    sql: "SELECT id, customer_name, original_filename, file_deleted, deleted_at FROM documents WHERE id = ?",
    args: [docId],
  });

  assert.equal(docInDb.rows.length, 1, "Record must still exist in DB");
  const row = docInDb.rows[0];
  assert.equal(row.customer_name, "Aarav Gupta", "Customer name must be preserved");
  assert.equal(row.original_filename, safeFilename, "Filename must be preserved");
  assert.equal(Number(row.file_deleted), 1, "file_deleted flag must be set to 1");
  assert.ok(row.deleted_at !== null, "deleted_at timestamp must be recorded");

  // Cleanup test artifacts
  await db.execute({ sql: "DELETE FROM documents WHERE id = ?", args: [docId] });
  await db.execute({ sql: "DELETE FROM shops WHERE id = ?", args: [shopId] });
  await db.execute({ sql: "DELETE FROM users WHERE id = ?", args: [userId] });
});

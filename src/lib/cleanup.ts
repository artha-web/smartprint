import { getDb, ensureDbInitialized } from "./db";
import { deleteFile } from "./storage";

/**
 * Automatically cleans up documents older than 12 hours.
 * IMPORTANT: It permanently deletes the physical file from UploadThing / Cloudflare R2 / storage,
 * keeping the storage quota empty and free, but PRESERVES the customer metadata
 * in the database with file_deleted = 1 and deleted_at = now.
 */
export async function cleanupExpiredDocuments(): Promise<{
  deletedCount: number;
  errors: string[];
}> {
  await ensureDbInitialized();
  const db = getDb();
  const errors: string[] = [];

  // Find all documents past their expiration where the file hasn't been deleted yet
  const result = await db.execute(`
    SELECT id, storage_key, customer_name, original_filename 
    FROM documents 
    WHERE file_deleted = 0 AND datetime('now') >= datetime(expires_at)
  `);

  let deletedCount = 0;

  for (const row of result.rows) {
    const docId = String(row.id);
    const storageKey = String(row.storage_key);

    try {
      // 1. Delete physical file from R2 / local storage
      await deleteFile(storageKey);

      // 2. Mark database record as file_deleted = 1, keeping customer_name and metadata
      await db.execute({
        sql: `UPDATE documents SET file_deleted = 1, deleted_at = datetime('now') WHERE id = ?`,
        args: [docId],
      });

      deletedCount++;
    } catch (err) {
      const msg = `Failed to delete expired document ${docId}: ${err instanceof Error ? err.message : String(err)}`;
      console.error(msg);
      errors.push(msg);
    }
  }

  return { deletedCount, errors };
}

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDb, ensureDbInitialized } from "@/lib/db";
import BatchPrintClient from "./batch-client";

export const dynamic = "force-dynamic";

interface RawDoc {
  id: string | number;
  customer_name: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  file_deleted: number;
  expires_at: string;
  is_expired: number;
}

export default async function BatchPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string; customer?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { ids, customer } = await searchParams;

  await ensureDbInitialized();
  const db = getDb();

  let docsList: RawDoc[] = [];

  if (ids) {
    const idArray = ids.split(",").map((s) => s.trim()).filter(Boolean);
    if (idArray.length > 0) {
      const placeholders = idArray.map(() => "?").join(",");
      const res = await db.execute({
        sql: `
          SELECT id, customer_name, original_filename, mime_type, file_size, file_deleted, expires_at,
                 CASE WHEN file_deleted = 1 OR datetime('now') >= datetime(expires_at) THEN 1 ELSE 0 END as is_expired
          FROM documents
          WHERE id IN (${placeholders}) AND shop_id = ?
          ORDER BY created_at ASC
        `,
        args: [...idArray, session.shop.id],
      });
      docsList = res.rows as unknown as RawDoc[];
    }
  } else if (customer) {
    const res = await db.execute({
      sql: `
        SELECT id, customer_name, original_filename, mime_type, file_size, file_deleted, expires_at,
               CASE WHEN file_deleted = 1 OR datetime('now') >= datetime(expires_at) THEN 1 ELSE 0 END as is_expired
        FROM documents
        WHERE customer_name = ? AND shop_id = ? AND file_deleted = 0 AND datetime('now') < datetime(expires_at)
        ORDER BY created_at ASC
      `,
      args: [customer, session.shop.id],
    });
    docsList = res.rows as unknown as RawDoc[];
  }

  return (
    <BatchPrintClient
      customerName={customer || docsList[0]?.customer_name || "Customer"}
      documents={docsList.map((d) => ({
        id: String(d.id),
        customer_name: String(d.customer_name),
        original_filename: String(d.original_filename),
        mime_type: String(d.mime_type),
        file_size: Number(d.file_size),
        is_expired: Number(d.is_expired) === 1,
      }))}
    />
  );
}

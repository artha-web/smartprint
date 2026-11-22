import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDb, ensureDbInitialized } from "@/lib/db";
import PrintClientView from "./print-client";

export const dynamic = "force-dynamic";

export default async function PrintViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ autoprint?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const { autoprint } = await searchParams;

  await ensureDbInitialized();
  const db = getDb();

  const docResult = await db.execute({
    sql: `
      SELECT id, customer_name, original_filename, mime_type, file_size, 
             file_deleted, created_at, expires_at,
             CASE WHEN file_deleted = 1 OR datetime('now') >= datetime(expires_at) THEN 1 ELSE 0 END as is_expired
      FROM documents 
      WHERE id = ? AND shop_id = ?
    `,
    args: [id, session.shop.id],
  });

  if (docResult.rows.length === 0) {
    notFound();
  }

  const doc = docResult.rows[0];

  return (
    <PrintClientView
      doc={{
        id: String(doc.id),
        customer_name: String(doc.customer_name),
        original_filename: String(doc.original_filename),
        mime_type: String(doc.mime_type),
        file_size: Number(doc.file_size),
        is_expired: Number(doc.is_expired) === 1,
      }}
      autoPrint={autoprint === "1"}
    />
  );
}

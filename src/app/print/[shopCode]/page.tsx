import { getDb, ensureDbInitialized } from "@/lib/db";
import CustomerUpload from "./upload";

export const dynamic = "force-dynamic";

export default async function PrintPage({
  params,
}: {
  params: Promise<{ shopCode: string }>;
}) {
  const { shopCode } = await params;

  await ensureDbInitialized();
  const db = getDb();

  const result = await db.execute({
    sql: "SELECT id, name, shop_code FROM shops WHERE shop_code = ? AND active = 1",
    args: [shopCode],
  });

  if (result.rows.length === 0) {
    return (
      <main className="shell page">
        <div className="card" style={{ maxWidth: 520, margin: "40px auto", textAlign: "center" }}>
          <h1>Shop not found</h1>
          <p className="muted">
            This printing link is either invalid or this shop is currently not accepting uploads.
          </p>
        </div>
      </main>
    );
  }

  const shop = result.rows[0];

  return (
    <>
      <header className="topbar">
        <div className="shell topbar-inner">
          <div className="brand">
            Smart<span>Print</span>
          </div>
          <span className="pill">Quick Document Upload</span>
        </div>
      </header>

      <main className="shell page">
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div className="eyebrow">Document Printing</div>
          <h1 style={{ marginTop: 4, marginBottom: 8 }}>{String(shop.name)}</h1>
          <p className="muted" style={{ marginBottom: 24, fontSize: 15 }}>
            Upload your document below. Enter your full name so the shopkeeper can find and print your file at the counter.
          </p>

          <CustomerUpload shopCode={String(shop.shop_code)} shopName={String(shop.name)} />
        </div>
      </main>

      <footer className="footer">
        Your uploaded documents are private and are automatically deleted after 12 hours.
      </footer>
    </>
  );
}

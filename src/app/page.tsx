import Link from "next/link";
import { Printer, Shield, CheckCircle2 } from "lucide-react";

export default function HomePage() {
  return (
    <>
      <header className="topbar">
        <div className="shell topbar-inner">
          <div className="brand">
            Smart<span>Print</span>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Link className="btn btn-secondary" style={{ minHeight: 38 }} href="/login">
              Shopkeeper Sign In
            </Link>
          </div>
        </div>
      </header>

      <main className="shell page">
        <div className="grid2" style={{ alignItems: "center", gap: 40, marginTop: 20 }}>
          <section>
            <div className="eyebrow">Zero WhatsApp Hassle</div>
            <h1 style={{ fontSize: "clamp(32px, 5vw, 48px)", letterSpacing: -1.5, lineHeight: 1.1 }}>
              QR Document Sharing &amp; Instant Browser Printing
            </h1>
            <p className="muted" style={{ fontSize: 17, maxWidth: 520, lineHeight: 1.6, marginTop: 14 }}>
              Say goodbye to WhatsApp clutter in your Xerox shop, cyber café, or stationery store. Customers scan your QR, enter their name, and upload documents. You search their name and print with one click.
            </p>

            <div style={{ display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap" }}>
              <Link className="btn" href="/login" style={{ fontSize: 16, padding: "0 22px" }}>
                <Printer size={18} />
                Open Shop Dashboard
              </Link>
              <a className="btn btn-secondary" href="#features" style={{ fontSize: 16, padding: "0 20px" }}>
                How It Works
              </a>
            </div>

            <div className="stat-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)", marginTop: 36 }}>
              <div className="stat">
                <Shield size={22} color="#16a34a" />
                <strong style={{ fontSize: 18, marginTop: 8 }}>Privacy First</strong>
                <span className="muted" style={{ fontSize: 13 }}>Files auto-purged after 12 hours</span>
              </div>
              <div className="stat">
                <Printer size={22} color="#2563eb" />
                <strong style={{ fontSize: 18, marginTop: 8 }}>No Downloads</strong>
                <span className="muted" style={{ fontSize: 13 }}>Prints directly via browser</span>
              </div>
            </div>
          </section>

          <section className="card" id="features" style={{ padding: 32 }}>
            <div className="eyebrow">Seamless Flow</div>
            <h2 style={{ marginTop: 6, marginBottom: 20, fontSize: 24 }}>Simple 3-Step Process</h2>

            <div style={{ display: "grid", gap: 20 }}>
              <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                <span className="pill" style={{ fontSize: 14, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  1
                </span>
                <div>
                  <strong style={{ fontSize: 16, display: "block", color: "#0f172a" }}>Customer Scans QR</strong>
                  <span className="muted" style={{ fontSize: 14 }}>
                    Opens your shop&apos;s upload page. They enter their name and select PDF, Word (.docx), or Image files.
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                <span className="pill" style={{ fontSize: 14, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  2
                </span>
                <div>
                  <strong style={{ fontSize: 16, display: "block", color: "#0f172a" }}>Customer Mentions Name</strong>
                  <span className="muted" style={{ fontSize: 14 }}>
                    Customer tells you the name they entered. You search for it instantly on your dashboard.
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                <span className="pill" style={{ fontSize: 14, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  3
                </span>
                <div>
                  <strong style={{ fontSize: 16, display: "block", color: "#0f172a" }}>One-Click Browser Print</strong>
                  <span className="muted" style={{ fontSize: 14 }}>
                    Click &quot;Print&quot; and your browser native print dialog opens. Zero saving or manual downloading required.
                  </span>
                </div>
              </div>
            </div>

            <div className="notice" style={{ marginTop: 24, background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0" }}>
              <CheckCircle2 size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />
              <strong>Privacy Guaranteed:</strong> Customer files are automatically deleted after 12 hours while keeping your business customer log.
            </div>
          </section>
        </div>
      </main>

      <footer className="footer">
        SmartPrint · QR Document Sharing &amp; Browser Printing for Stationery &amp; Xerox Shops
      </footer>
    </>
  );
}

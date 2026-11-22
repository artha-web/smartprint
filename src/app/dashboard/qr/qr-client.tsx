"use client";

import { useEffect, useState, useRef } from "react";
import QRCode from "qrcode";
import { Copy, Download, Printer, Check, ExternalLink } from "lucide-react";

export default function QRClient({
  shopName,
  shopCode,
  shopPhone,
  shopAddress,
  shopLogo,
  uploadUrl,
}: {
  shopName: string;
  shopCode: string;
  shopPhone?: string;
  shopAddress?: string;
  shopLogo?: string;
  uploadUrl: string;
}) {
  const [dataUrl, setDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const posterRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Generate high resolution QR code locally
    QRCode.toDataURL(uploadUrl, {
      width: 480,
      margin: 2,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
      errorCorrectionLevel: "H",
    }).then((url) => {
      setDataUrl(url);
    });
  }, [uploadUrl]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(uploadUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  }

  function handlePrintPoster() {
    window.print();
  }

  function handleDownload() {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${shopCode}-upload-qr.png`;
    a.click();
  }

  return (
    <>
      {/* Screen View */}
      <div className="no-print">
        <div className="eyebrow">Customer QR Access</div>
        <h1>Shop QR Poster & Link</h1>
        <p className="muted" style={{ maxWidth: 600, marginBottom: 24 }}>
          Display this QR code in your shop or Xerox centre. Customers scan it with their phone camera to open your upload page directly.
        </p>

        <div className="grid2" style={{ alignItems: "start" }}>
          {/* QR Display Card */}
          <div className="card" style={{ textAlign: "center", padding: "32px 24px" }}>
            <div style={{ background: "white", padding: 16, borderRadius: 16, display: "inline-block", border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
              {dataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={dataUrl}
                  alt={`Upload QR Code for ${shopName}`}
                  width={240}
                  height={240}
                  style={{ display: "block" }}
                />
              ) : (
                <div style={{ width: 240, height: 240, display: "flex", alignItems: "center", justifyContent: "center" }} className="muted">
                  Generating QR...
                </div>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 16 }}>
              {shopLogo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={shopLogo}
                  alt="Shop Logo"
                  style={{ height: 28, width: "auto", objectFit: "contain" }}
                />
              )}
              <h3 style={{ margin: 0 }}>{shopName}</h3>
            </div>

            {(shopAddress || shopPhone) && (
              <p className="muted" style={{ fontSize: 13, margin: "6px 0 0" }}>
                {shopAddress} {shopPhone && `• ${shopPhone}`}
              </p>
            )}

            <p className="muted" style={{ fontSize: 13, margin: "10px 0 20px" }}>
              Permanent URL: {uploadUrl}
            </p>

            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <button type="button" className="btn btn-secondary" onClick={handleCopy}>
                {copied ? <Check size={16} color="#16a34a" /> : <Copy size={16} />}
                {copied ? "Copied!" : "Copy Link"}
              </button>
              <button type="button" className="btn btn-secondary" onClick={handleDownload} disabled={!dataUrl}>
                <Download size={16} />
                Download PNG
              </button>
              <button type="button" className="btn" onClick={handlePrintPoster} style={{ background: "#2563eb" }}>
                <Printer size={16} />
                Print Shop Poster
              </button>
            </div>
          </div>

          {/* Quick instructions */}
          <div className="card">
            <h3>How to use your QR code</h3>
            <ol className="muted" style={{ lineHeight: 1.8, paddingLeft: 20, margin: "14px 0" }}>
              <li>
                Click <strong>&quot;Print Shop Poster&quot;</strong> to print an A4 counter poster.
              </li>
              <li>
                Place the poster near your billing counter or Xerox machine.
              </li>
              <li>
                When a customer arrives to print, ask them to scan the QR code and enter their name.
              </li>
              <li>
                Their documents appear on your dashboard with an instant audio chime!
              </li>
            </ol>

            <div className="notice" style={{ marginTop: 20 }}>
              <strong>Zero WhatsApp clutter:</strong> No phone numbers needed, and customer files auto-expire after 12 hours.
            </div>

            <div style={{ marginTop: 24 }}>
              <a href={uploadUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-full">
                <ExternalLink size={16} />
                Test Customer Upload Page
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Printable Poster Section (Visible ONLY during window.print()) */}
      <div className="print-poster-container" ref={posterRef}>
        <div className="poster-border">
          <div className="poster-header">
            {shopLogo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={shopLogo}
                alt="Shop Logo"
                style={{ maxHeight: 60, width: "auto", objectFit: "contain", marginBottom: 10 }}
              />
            )}
            <h1 className="poster-title">SCAN TO UPLOAD YOUR DOCUMENT</h1>
            <p className="poster-subtitle">Send your files directly to our printer — No WhatsApp needed!</p>
          </div>

          <div className="poster-qr-wrap">
            {dataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={dataUrl} alt="Scan to Upload" className="poster-qr-image" />
            )}
          </div>

          <div className="poster-shop-name">{shopName}</div>
          {(shopAddress || shopPhone) && (
            <div style={{ fontSize: 15, color: "#334155", fontWeight: 600, margin: "4px 0 8px" }}>
              {shopAddress} {shopPhone && `• ${shopPhone}`}
            </div>
          )}
          <div className="poster-url">{uploadUrl}</div>

          <div className="poster-steps">
            <div className="poster-step">
              <span className="step-num">1</span>
              <span>Scan QR with camera</span>
            </div>
            <div className="poster-step">
              <span className="step-num">2</span>
              <span>Enter name &amp; upload</span>
            </div>
            <div className="poster-step">
              <span className="step-num">3</span>
              <span>Collect print at counter!</span>
            </div>
          </div>

          <div className="poster-footer">
            PDF · Word · Images · TXT Supported | Files securely auto-deleted after 12 hours
          </div>
        </div>
      </div>

      <style jsx>{`
        .print-poster-container {
          display: none;
        }

        @media print {
          .no-print {
            display: none !important;
          }
          .print-poster-container {
            display: block !important;
            width: 100%;
            height: 100vh;
            padding: 24px;
            box-sizing: border-box;
            background: white;
            font-family: Arial, sans-serif;
          }
          .poster-border {
            border: 8px solid #0f172a;
            border-radius: 20px;
            height: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
            padding: 36px 24px;
            text-align: center;
            box-sizing: border-box;
          }
          .poster-title {
            font-size: 38px;
            font-weight: 900;
            color: #0f172a;
            letter-spacing: -1px;
            margin: 0 0 8px;
            text-transform: uppercase;
          }
          .poster-subtitle {
            font-size: 18px;
            color: #475467;
            margin: 0;
            font-weight: 600;
          }
          .poster-qr-wrap {
            padding: 16px;
            background: white;
            border: 4px solid #0f172a;
            border-radius: 16px;
            margin: 16px 0;
          }
          .poster-qr-image {
            width: 320px;
            height: 320px;
            display: block;
          }
          .poster-shop-name {
            font-size: 32px;
            font-weight: 800;
            color: #2563eb;
            letter-spacing: -0.5px;
            margin-top: 8px;
          }
          .poster-url {
            font-size: 14px;
            color: #64748b;
            font-family: monospace;
            margin-bottom: 12px;
          }
          .poster-steps {
            display: flex;
            justify-content: center;
            gap: 24px;
            width: 100%;
            max-width: 600px;
            margin: 12px 0;
          }
          .poster-step {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
            font-size: 14px;
            font-weight: 700;
            color: #1e293b;
          }
          .step-num {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: #0f172a;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            font-weight: 800;
          }
          .poster-footer {
            font-size: 12px;
            color: #94a3b8;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
        }
      `}</style>
    </>
  );
}

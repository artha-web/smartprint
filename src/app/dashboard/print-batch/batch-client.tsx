"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Printer, ArrowLeft, AlertCircle, FileCode, CheckCircle2 } from "lucide-react";

interface BatchDoc {
  id: string;
  customer_name: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  is_expired: boolean;
}

export default function BatchPrintClient({
  customerName,
  documents,
}: {
  customerName: string;
  documents: BatchDoc[];
}) {
  const [renderedDocs, setRenderedDocs] = useState<Record<string, { html?: string; text?: string }>>({});
  const [loadingHtml, setLoadingHtml] = useState(false);

  // Fetch rendered HTML for Word/text docs
  useEffect(() => {
    const wordOrTextDocs = documents.filter(
      (d) =>
        d.mime_type.includes("wordprocessingml") ||
        d.mime_type === "text/plain" ||
        d.original_filename.endsWith(".docx") ||
        d.original_filename.endsWith(".txt")
    );

    if (wordOrTextDocs.length > 0) {
      setLoadingHtml(true);
      Promise.all(
        wordOrTextDocs.map((d) =>
          fetch(`/api/documents/${d.id}/render-docx`)
            .then((r) => r.json())
            .then((data) => ({ id: d.id, data }))
            .catch(() => ({ id: d.id, data: null }))
        )
      )
        .then((results) => {
          const map: Record<string, { html?: string; text?: string }> = {};
          results.forEach((r) => {
            if (r.data) map[r.id] = r.data;
          });
          setRenderedDocs(map);
        })
        .finally(() => setLoadingHtml(false));
    }
  }, [documents]);

  const triggerPrintAll = useCallback(() => {
    window.print();
  }, []);

  // Auto-trigger print after short delay
  useEffect(() => {
    const timer = setTimeout(() => {
      triggerPrintAll();
    }, 1500);
    return () => clearTimeout(timer);
  }, [triggerPrintAll]);

  if (documents.length === 0) {
    return (
      <div style={{ maxWidth: 500, margin: "60px auto", textAlign: "center" }} className="card">
        <AlertCircle size={48} color="#dc2626" style={{ margin: "0 auto 16px" }} />
        <h2>No Active Documents</h2>
        <p className="muted" style={{ margin: "10px 0 20px" }}>
          No printable documents found for this batch.
        </p>
        <Link href="/dashboard" className="btn btn-secondary">
          <ArrowLeft size={16} />
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="batch-container">
      {/* Action Bar (hidden during print) */}
      <div className="no-print batch-header">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link href="/dashboard" className="btn btn-secondary" style={{ minHeight: 38, padding: "0 12px" }}>
            <ArrowLeft size={16} />
            Back
          </Link>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, color: "#0f172a" }}>
              Batch Print for {customerName}
            </div>
            <div className="muted" style={{ fontSize: 13 }}>
              {documents.length} document{documents.length > 1 ? "s" : ""} queued for printing
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            className="btn"
            style={{ background: "#16a34a", minHeight: 40, padding: "0 18px" }}
            onClick={triggerPrintAll}
            disabled={loadingHtml}
          >
            <Printer size={16} />
            Print All ({documents.length} Documents)
          </button>
        </div>
      </div>

      {/* Screen summary banner */}
      <div className="no-print" style={{ padding: "16px 24px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ maxWidth: 840, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 14, color: "#475467" }}>
            <CheckCircle2 size={16} color="#16a34a" style={{ verticalAlign: "middle", marginRight: 6 }} />
            Each document will automatically print on its own page with clean page breaks.
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
            Total: {documents.length} files
          </span>
        </div>
      </div>

      {/* Printable Stage containing all documents */}
      <div className="batch-stage">
        {documents.map((doc, idx) => {
          const isPdf = doc.mime_type === "application/pdf";
          const isImage = doc.mime_type.startsWith("image/");
          const isWord = doc.mime_type.includes("wordprocessingml") || doc.original_filename.endsWith(".docx");
          const isText = doc.mime_type === "text/plain" || doc.original_filename.endsWith(".txt");
          const streamUrl = `/api/documents/${doc.id}/view`;

          return (
            <div key={doc.id} className="batch-page">
              {/* Document separator badge */}
              <div className="doc-meta-banner">
                <span className="doc-num">Document {idx + 1} of {documents.length}</span>
                <span className="doc-name">{doc.original_filename}</span>
                <span className="doc-cust">{customerName}</span>
              </div>

              {/* Render Image */}
              {isImage && (
                <div className="media-box">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={streamUrl} alt={doc.original_filename} className="batch-image" />
                </div>
              )}

              {/* Render PDF */}
              {isPdf && (
                <div className="media-box pdf-box">
                  <iframe
                    src={`${streamUrl}#toolbar=0`}
                    className="batch-pdf"
                    title={doc.original_filename}
                  />
                </div>
              )}

              {/* Render Word DOCX */}
              {isWord && (
                <div className="batch-docx">
                  {renderedDocs[doc.id]?.html ? (
                    <div
                      className="docx-content"
                      dangerouslySetInnerHTML={{ __html: renderedDocs[doc.id].html || "" }}
                    />
                  ) : (
                    <div style={{ padding: 40, textAlign: "center" }} className="muted">
                      <FileCode size={32} style={{ margin: "0 auto 8px" }} />
                      Loading Word Document...
                    </div>
                  )}
                </div>
              )}

              {/* Render Plain Text */}
              {isText && (
                <div className="batch-docx">
                  <pre style={{ fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
                    {renderedDocs[doc.id]?.text || "Loading text..."}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .batch-container {
          min-height: 100vh;
          background: #475569;
        }
        .batch-header {
          background: white;
          padding: 12px 24px;
          border-bottom: 1px solid #cbd5e1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: sticky;
          top: 0;
          z-index: 50;
        }
        .batch-stage {
          max-width: 860px;
          margin: 24px auto;
          display: flex;
          flex-direction: column;
          gap: 24px;
          padding: 0 16px 48px;
        }
        .batch-page {
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.25);
        }
        .doc-meta-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 12px;
          margin-bottom: 16px;
          border-bottom: 1px dashed #cbd5e1;
          font-size: 13px;
        }
        .doc-num {
          background: #eff6ff;
          color: #1d4ed8;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 4px;
        }
        .doc-name {
          font-weight: 600;
          color: #1e293b;
        }
        .doc-cust {
          color: #64748b;
        }
        .media-box {
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .batch-image {
          max-width: 100%;
          max-height: 80vh;
          object-fit: contain;
          border-radius: 4px;
        }
        .pdf-box {
          width: 100%;
          height: 85vh;
        }
        .batch-pdf {
          width: 100%;
          height: 100%;
          border: 0;
          border-radius: 6px;
        }
        .batch-docx {
          padding: 16px;
          font-family: Calibri, 'Segoe UI', Arial, sans-serif;
          line-height: 1.6;
        }
        .docx-content :global(h1),
        .docx-content :global(h2),
        .docx-content :global(h3) {
          color: #0f172a;
          margin-top: 1em;
          margin-bottom: 0.4em;
        }
        .docx-content :global(table) {
          border-collapse: collapse;
          width: 100%;
          margin: 1em 0;
        }
        .docx-content :global(td),
        .docx-content :global(th) {
          border: 1px solid #cbd5e1;
          padding: 6px 10px;
        }

        @media print {
          .no-print {
            display: none !important;
          }
          .batch-container {
            background: white !important;
          }
          .batch-stage {
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            gap: 0 !important;
          }
          .batch-page {
            box-shadow: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            page-break-after: always !important;
            break-after: page !important;
            min-height: 100vh;
          }
          .doc-meta-banner {
            display: none !important;
          }
          .batch-image {
            max-height: 100vh !important;
            page-break-inside: avoid;
          }
          .pdf-box {
            height: 100vh !important;
          }
        }
      `}</style>
    </div>
  );
}

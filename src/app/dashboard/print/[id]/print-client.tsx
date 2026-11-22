"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { Printer, ArrowLeft, AlertCircle, RefreshCw } from "lucide-react";

interface PrintDoc {
  id: string;
  customer_name: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  is_expired: boolean;
}

export default function PrintClientView({
  doc,
  autoPrint,
}: {
  doc: PrintDoc;
  autoPrint: boolean;
}) {
  const isPdf = doc.mime_type === "application/pdf";
  const isDocx =
    doc.mime_type.includes("wordprocessingml") ||
    doc.mime_type === "application/msword" ||
    doc.original_filename.toLowerCase().endsWith(".docx");
  const isImage = doc.mime_type.startsWith("image/");
  const isText = doc.mime_type === "text/plain" || doc.original_filename.toLowerCase().endsWith(".txt");

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [docxData, setDocxData] = useState<{ html?: string; text?: string } | null>(null);
  const [docxLoading, setDocxLoading] = useState(isDocx || isText);

  const streamUrl = `/api/documents/${doc.id}/view`;

  // Fetch rendered content for DOCX and text documents
  useEffect(() => {
    if ((isDocx || isText) && !doc.is_expired) {
      setDocxLoading(true);
      fetch(`/api/documents/${doc.id}/render-docx`)
        .then((res) => res.json())
        .then((data) => {
          if (data.html || data.text) {
            setDocxData(data);
          }
        })
        .catch((err) => console.error("Failed to render document", err))
        .finally(() => setDocxLoading(false));
    }
  }, [doc.id, isDocx, isText, doc.is_expired]);

  const triggerPrint = useCallback(() => {
    if (isPdf && iframeRef.current?.contentWindow) {
      try {
        iframeRef.current.contentWindow.focus();
        iframeRef.current.contentWindow.print();
        return;
      } catch {
        window.print();
      }
    } else {
      window.print();
    }
  }, [isPdf]);

  // Handle auto-print parameter
  useEffect(() => {
    if (!autoPrint || doc.is_expired) return;

    if (isPdf) {
      const timer = setTimeout(() => {
        triggerPrint();
      }, 1200);
      return () => clearTimeout(timer);
    } else if (isImage && imageLoaded) {
      const timer = setTimeout(() => {
        triggerPrint();
      }, 500);
      return () => clearTimeout(timer);
    } else if ((isDocx || isText) && !docxLoading && docxData) {
      const timer = setTimeout(() => {
        triggerPrint();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [autoPrint, isPdf, isImage, imageLoaded, isDocx, isText, docxLoading, docxData, doc.is_expired, triggerPrint]);

  if (doc.is_expired) {
    return (
      <div style={{ maxWidth: 600, margin: "60px auto", textAlign: "center" }} className="card">
        <AlertCircle size={48} color="#dc2626" style={{ margin: "0 auto 16px" }} />
        <h2>Document File Expired</h2>
        <p className="muted" style={{ margin: "12px 0 24px" }}>
          For privacy and storage hygiene, uploaded files are automatically deleted after 12 hours. The customer metadata ({doc.customer_name}) is preserved, but the file content cannot be printed.
        </p>
        <Link href="/dashboard" className="btn btn-secondary">
          <ArrowLeft size={16} />
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="print-container">
      {/* Top action toolbar - hidden when printing */}
      <div className="no-print print-toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link href="/dashboard" className="btn btn-secondary" style={{ minHeight: 38, padding: "0 12px" }}>
            <ArrowLeft size={16} />
            Back
          </Link>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a" }}>
              {doc.customer_name}
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              {doc.original_filename}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            className="btn"
            style={{ background: "#16a34a", minHeight: 38 }}
            onClick={triggerPrint}
          >
            <Printer size={16} />
            Print Document (Ctrl+P)
          </button>
        </div>
      </div>

      {/* Document presentation stage */}
      <div className="document-stage">
        {isPdf && (
          <iframe
            ref={iframeRef}
            src={`${streamUrl}#toolbar=1&navpanes=0`}
            className="pdf-frame"
            title={`Print Document - ${doc.original_filename}`}
          />
        )}

        {isImage && (
          <div className="image-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={streamUrl}
              alt={doc.original_filename}
              className="printable-image"
              onLoad={() => setImageLoaded(true)}
            />
          </div>
        )}

        {(isDocx || isText) && (
          <div className="docx-paper">
            {docxLoading ? (
              <div style={{ padding: 48, textAlign: "center" }} className="muted">
                <RefreshCw size={24} className="spin" style={{ margin: "0 auto 12px" }} />
                Converting document for printing...
              </div>
            ) : docxData?.html ? (
              <div
                className="docx-content"
                dangerouslySetInnerHTML={{ __html: docxData.html }}
              />
            ) : docxData?.text ? (
              <pre className="text-content">{docxData.text}</pre>
            ) : (
              <div style={{ padding: 40, textAlign: "center" }} className="muted">
                Unable to convert document preview.
              </div>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        .print-container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: #334155;
        }
        .print-toolbar {
          background: white;
          border-bottom: 1px solid #cbd5e1;
          padding: 12px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          position: sticky;
          top: 0;
          z-index: 50;
        }
        .document-stage {
          flex: 1;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          padding: 24px;
          overflow-y: auto;
        }
        .pdf-frame {
          width: 100%;
          height: calc(100vh - 90px);
          border: 0;
          background: white;
          border-radius: 8px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        }
        .image-wrap {
          display: flex;
          justify-content: center;
          align-items: center;
          max-width: 100%;
        }
        .printable-image {
          max-width: 100%;
          max-height: calc(100vh - 120px);
          object-fit: contain;
          background: white;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
          border-radius: 4px;
        }
        .docx-paper {
          width: 100%;
          max-width: 820px;
          background: white;
          padding: 48px;
          border-radius: 8px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
          min-height: 900px;
          color: #1e293b;
        }
        .docx-content {
          font-family: Calibri, 'Segoe UI', Arial, sans-serif;
          font-size: 15px;
          line-height: 1.6;
        }
        .docx-content :global(h1),
        .docx-content :global(h2),
        .docx-content :global(h3) {
          color: #0f172a;
          margin-top: 1.2em;
          margin-bottom: 0.5em;
        }
        .docx-content :global(p) {
          margin-bottom: 0.8em;
        }
        .docx-content :global(table) {
          border-collapse: collapse;
          width: 100%;
          margin: 1em 0;
        }
        .docx-content :global(td),
        .docx-content :global(th) {
          border: 1px solid #cbd5e1;
          padding: 8px 12px;
          text-align: left;
        }
        .text-content {
          font-family: monospace;
          white-space: pre-wrap;
          font-size: 14px;
          line-height: 1.5;
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media print {
          .no-print {
            display: none !important;
          }
          .print-container {
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            min-height: auto !important;
          }
          .document-stage {
            padding: 0 !important;
            margin: 0 !important;
          }
          .pdf-frame {
            height: 100vh !important;
            width: 100vw !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
          .printable-image {
            max-width: 100% !important;
            max-height: 100vh !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            page-break-inside: avoid;
          }
          .docx-paper {
            max-width: 100% !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            min-height: auto !important;
          }
        }
      `}</style>
    </div>
  );
}

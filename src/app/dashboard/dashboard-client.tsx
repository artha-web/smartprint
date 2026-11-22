"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Search,
  Printer,
  Eye,
  Trash2,
  RefreshCw,
  Calendar,
  ArrowUpDown,
  FileText,
  Image as ImageIcon,
  FileCode,
  QrCode,
  Volume2,
  VolumeX,
  FileStack,
} from "lucide-react";

interface DocItem {
  id: string;
  customer_name: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  file_deleted: number;
  created_at: string;
  expires_at: string;
  is_expired: number;
}

export default function DashboardClient({
  shopName,
  shopCode,
}: {
  shopName: string;
  shopCode: string;
}) {
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "expired">("all");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "yesterday" | "week">("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const prevDocCountRef = useRef<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Synthesized Web Audio chime (no external audio files needed)
  const playChime = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      // Pleasing upward two-tone chime (D5 -> A5)
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.85);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.85);
    } catch {
      // Audio playback permitted only after user gesture
    }
  }, [soundEnabled]);

  const fetchDocuments = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (dateFilter !== "all") params.set("date", dateFilter);
      params.set("sort", sortOrder);
      params.set("limit", "100");

      const res = await fetch(`/api/documents?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const incomingDocs = (data.documents || []) as DocItem[];

        // Trigger sound alert when new documents arrive
        if (prevDocCountRef.current !== null && incomingDocs.length > prevDocCountRef.current) {
          playChime();
        }
        prevDocCountRef.current = incomingDocs.length;
        setDocs(incomingDocs);
      }
    } catch (e) {
      console.error("Failed to load documents", e);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, dateFilter, sortOrder, playChime]);

  useEffect(() => {
    fetchDocuments();
    const interval = setInterval(fetchDocuments, 8000);
    return () => clearInterval(interval);
  }, [fetchDocuments]);

  // Keyboard Shortcuts (/ to search, Enter to print top doc, Esc to clear)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "/" && document.activeElement !== searchInputRef.current && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }

      if (e.key === "Escape" && document.activeElement === searchInputRef.current) {
        setSearch("");
        searchInputRef.current?.blur();
      }

      if (e.key === "Enter" && document.activeElement === searchInputRef.current) {
        const firstActive = docs.find((d) => !d.is_expired && !d.file_deleted);
        if (firstActive) {
          handleDirectPrint(firstActive.id);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [docs]);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Are you sure you want to delete the file for "${name}"?`)) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchDocuments();
      }
    } catch (e) {
      console.error("Delete failed", e);
    } finally {
      setDeletingId(null);
    }
  }

  function handleDirectPrint(docId: string) {
    const printWindow = window.open(`/dashboard/print/${docId}?autoprint=1`, "_blank");
    if (printWindow) printWindow.focus();
  }

  function handlePrintAllForCustomer(customerName: string, customerDocIds: string[]) {
    const printWindow = window.open(
      `/dashboard/print-batch?ids=${customerDocIds.join(",")}&customer=${encodeURIComponent(customerName)}`,
      "_blank"
    );
    if (printWindow) printWindow.focus();
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatTime(isoStr: string) {
    const d = new Date(isoStr);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function formatDate(isoStr: string) {
    const d = new Date(isoStr);
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  function getDocBadge(mime: string, filename: string) {
    const ext = filename.toLowerCase();
    if (mime === "application/pdf" || ext.endsWith(".pdf")) {
      return { label: "PDF", bg: "#fef2f2", color: "#dc2626", icon: <FileText size={16} /> };
    }
    if (mime.includes("wordprocessingml") || mime === "application/msword" || ext.endsWith(".docx") || ext.endsWith(".doc")) {
      return { label: "Word", bg: "#eff6ff", color: "#2563eb", icon: <FileCode size={16} /> };
    }
    if (mime.startsWith("image/") || [".png", ".jpg", ".jpeg", ".webp"].some((e) => ext.endsWith(e))) {
      return { label: "Image", bg: "#f0fdf4", color: "#16a34a", icon: <ImageIcon size={16} /> };
    }
    return { label: "Text", bg: "#f8fafc", color: "#475467", icon: <FileText size={16} /> };
  }

  // Group active files by customer to power "Print All" button
  const customerActiveFilesMap: Record<string, string[]> = {};
  docs.forEach((doc) => {
    if (!doc.is_expired && !doc.file_deleted) {
      if (!customerActiveFilesMap[doc.customer_name]) {
        customerActiveFilesMap[doc.customer_name] = [];
      }
      customerActiveFilesMap[doc.customer_name].push(doc.id);
    }
  });

  const activeCount = docs.filter((d) => !d.is_expired && !d.file_deleted).length;
  const expiredCount = docs.filter((d) => d.is_expired || d.file_deleted).length;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div className="eyebrow">Smart Document Dashboard</div>
          <h1 style={{ marginTop: 4, marginBottom: 4 }}>{shopName}</h1>
          <p className="muted" style={{ margin: 0 }}>
            Live incoming print documents. Search customer name to quickly find, preview, and print.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {/* Sound Alert Toggle */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setSoundEnabled(!soundEnabled)}
            style={{ minHeight: 42, padding: "0 14px", display: "inline-flex", alignItems: "center", gap: 6 }}
            title={soundEnabled ? "Sound Alert is ON (chimes when a customer uploads)" : "Sound Alert is MUTED"}
          >
            {soundEnabled ? <Volume2 size={16} color="#16a34a" /> : <VolumeX size={16} color="#94a3b8" />}
            <span style={{ fontSize: 13 }}>{soundEnabled ? "Sound ON" : "Muted"}</span>
          </button>

          <Link href="/dashboard/qr" className="btn btn-secondary" style={{ minHeight: 42 }}>
            <QrCode size={16} />
            Shop QR Poster
          </Link>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setLoading(true);
              fetchDocuments();
            }}
            style={{ minHeight: 42 }}
            title="Refresh queue"
          >
            <RefreshCw size={16} className={loading ? "spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="stat-grid" style={{ marginTop: 20, marginBottom: 24 }}>
        <div className="stat">
          <span className="muted" style={{ fontSize: 13 }}>Ready to Print (Active)</span>
          <strong style={{ fontSize: 28, color: "#2563eb", marginTop: 4 }}>{activeCount}</strong>
          <span className="muted" style={{ fontSize: 12 }}>Auto-cleans in 12 hours</span>
        </div>
        <div className="stat">
          <span className="muted" style={{ fontSize: 13 }}>Expired / File Removed</span>
          <strong style={{ fontSize: 28, color: "#64748b", marginTop: 4 }}>{expiredCount}</strong>
          <span className="muted" style={{ fontSize: 12 }}>Customer record preserved</span>
        </div>
        <div className="stat">
          <span className="muted" style={{ fontSize: 13 }}>Shop Upload URL</span>
          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 8, overflowWrap: "anywhere", color: "#1e293b" }}>
            /print/{shopCode}
          </div>
          <Link href={`/print/${shopCode}`} target="_blank" style={{ fontSize: 12, color: "#2563eb", textDecoration: "underline" }}>
            Open public upload page
          </Link>
        </div>
      </div>

      {/* Smart Filter Bar with Keyboard Shortcuts Hint */}
      <div className="card" style={{ padding: 18, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
          {/* Customer Search with Keyboard Shortcut Indicator */}
          <div style={{ position: "relative", flex: "1 1 280px" }}>
            <Search size={18} color="#94a3b8" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search customer name or document... (Press / to search)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 42, paddingRight: 64, width: "100%", minHeight: 42 }}
            />
            <span
              style={{
                position: "absolute",
                right: 12,
                top: "50%",
                transform: "translateY(-50%)",
                background: "#f1f5f9",
                border: "1px solid #cbd5e1",
                borderRadius: 4,
                padding: "2px 6px",
                fontSize: 11,
                color: "#64748b",
                fontFamily: "monospace",
              }}
            >
              /
            </span>
          </div>

          {/* Date Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Calendar size={16} color="#64748b" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as "all" | "today" | "yesterday" | "week")}
              style={{ minHeight: 42, padding: "0 12px", borderRadius: 10, border: "1px solid #cbd5e1" }}
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="week">Past 7 Days</option>
            </select>
          </div>

          {/* Sort Order */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <ArrowUpDown size={16} color="#64748b" />
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as "newest" | "oldest")}
              style={{ minHeight: 42, padding: "0 12px", borderRadius: 10, border: "1px solid #cbd5e1" }}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>

          {/* Status Tabs */}
          <div style={{ display: "flex", gap: 4, background: "#f1f5f9", padding: 4, borderRadius: 10, marginLeft: "auto" }}>
            <button
              type="button"
              className={`filter-tab ${statusFilter === "all" ? "active" : ""}`}
              onClick={() => setStatusFilter("all")}
            >
              All ({docs.length})
            </button>
            <button
              type="button"
              className={`filter-tab ${statusFilter === "active" ? "active" : ""}`}
              onClick={() => setStatusFilter("active")}
            >
              Ready to Print
            </button>
            <button
              type="button"
              className={`filter-tab ${statusFilter === "expired" ? "active" : ""}`}
              onClick={() => setStatusFilter("expired")}
            >
              Expired
            </button>
          </div>
        </div>
      </div>

      {/* Document table */}
      <div className="table-wrap">
        {loading && docs.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center" }} className="muted">
            <RefreshCw size={24} className="spin" style={{ margin: "0 auto 12px" }} />
            Loading documents...
          </div>
        ) : docs.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <FileText size={36} color="#94a3b8" style={{ margin: "0 auto 12px" }} />
            <h3>No documents found</h3>
            <p className="muted" style={{ maxWidth: 420, margin: "6px auto 16px" }}>
              {search
                ? `No documents matched "${search}".`
                : dateFilter !== "all"
                ? `No documents found for selected date filter.`
                : "No customer uploads yet. Have customers scan your shop QR code to upload files."}
            </p>
            {search || dateFilter !== "all" ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setSearch("");
                  setDateFilter("all");
                }}
              >
                Clear Filters
              </button>
            ) : (
              <Link href="/dashboard/qr" className="btn btn-secondary">
                View & Print Shop QR Poster
              </Link>
            )}
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: "24%" }}>Customer</th>
                <th style={{ width: "26%" }}>Document</th>
                <th style={{ width: "12%" }}>Type / Size</th>
                <th style={{ width: "13%" }}>Uploaded</th>
                <th style={{ width: "9%" }}>Status</th>
                <th style={{ width: "16%", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((doc) => {
                const isExpired = Boolean(doc.is_expired || doc.file_deleted);
                const badge = getDocBadge(doc.mime_type, doc.original_filename);
                const customerActiveFiles = customerActiveFilesMap[doc.customer_name] || [];
                const hasMultipleFiles = customerActiveFiles.length > 1;

                return (
                  <tr key={doc.id} style={{ opacity: isExpired ? 0.72 : 1 }}>
                    {/* Customer Name + Multi-File "Print All" trigger */}
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <strong style={{ fontSize: 15, color: "#0f172a" }}>
                          {doc.customer_name}
                        </strong>

                        {/* Batch Print All indicator badge */}
                        {!isExpired && hasMultipleFiles && (
                          <button
                            type="button"
                            onClick={() => handlePrintAllForCustomer(doc.customer_name, customerActiveFiles)}
                            className="badge-print-all"
                            title={`Click to Print All ${customerActiveFiles.length} files for ${doc.customer_name} in one print run`}
                          >
                            <FileStack size={12} />
                            Print All ({customerActiveFiles.length})
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Document Title */}
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ color: badge.color }}>{badge.icon}</span>
                        <span style={{ fontWeight: 600, overflowWrap: "anywhere" }}>
                          {doc.original_filename}
                        </span>
                      </div>
                    </td>

                    {/* Format Badge & Size */}
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span
                          style={{
                            background: badge.bg,
                            color: badge.color,
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: 4,
                          }}
                        >
                          {badge.label}
                        </span>
                        <span className="muted" style={{ fontSize: 13 }}>
                          {formatSize(doc.file_size)}
                        </span>
                      </div>
                    </td>

                    {/* Upload Date & Time */}
                    <td>
                      <div>
                        <span style={{ fontWeight: 600 }}>{formatTime(doc.created_at)}</span>
                        <span className="muted" style={{ display: "block", fontSize: 11 }}>
                          {formatDate(doc.created_at)}
                        </span>
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td>
                      {isExpired ? (
                        <span className="status expired" title="File was purged after 12 hours. Customer metadata is retained.">
                          Expired
                        </span>
                      ) : (
                        <span className="status active">Ready</span>
                      )}
                    </td>

                    {/* Actions: 1-Click Browser Print, View, Delete */}
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: 6, justifyContent: "flex-end" }}>
                        {!isExpired ? (
                          <>
                            {/* ONE-CLICK BROWSER PRINTING */}
                            <button
                              type="button"
                              className="btn btn-action btn-print"
                              onClick={() => handleDirectPrint(doc.id)}
                              title="1-Click Print: Launches native browser print dialog without downloading"
                            >
                              <Printer size={15} />
                              Print
                            </button>

                            {/* View Document */}
                            <Link
                              href={`/dashboard/print/${doc.id}`}
                              target="_blank"
                              className="btn btn-action btn-secondary"
                              title="Preview document"
                            >
                              <Eye size={15} />
                            </Link>
                          </>
                        ) : (
                          <span className="muted" style={{ fontSize: 12, marginRight: 8 }}>
                            File purged
                          </span>
                        )}

                        {/* Delete Record */}
                        <button
                          type="button"
                          className="btn btn-action btn-delete"
                          onClick={() => handleDelete(doc.id, doc.customer_name)}
                          disabled={deletingId === doc.id}
                          title="Delete record"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <style jsx>{`
        .filter-tab {
          border: 0;
          background: transparent;
          padding: 8px 14px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          color: #64748b;
          cursor: pointer;
        }
        .filter-tab.active {
          background: white;
          color: #0f172a;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
        }
        .badge-print-all {
          border: 1px solid #bbf7d0;
          background: #f0fdf4;
          color: #15803d;
          font-size: 11px;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 6px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
          transition: background 0.15s;
        }
        .badge-print-all:hover {
          background: #dcfce7;
        }
        .btn-action {
          min-height: 34px;
          padding: 0 10px;
          font-size: 13px;
          border-radius: 8px;
        }
        .btn-print {
          background: #16a34a;
          color: white;
        }
        .btn-print:hover {
          background: #15803d;
        }
        .btn-delete {
          background: white;
          color: #dc2626;
          border: 1px solid #fee2e2;
        }
        .btn-delete:hover {
          background: #fef2f2;
        }
        .status.active {
          background: #ecfdf3;
          color: #027a48;
        }
        .status.expired {
          background: #f1f5f9;
          color: #64748b;
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}

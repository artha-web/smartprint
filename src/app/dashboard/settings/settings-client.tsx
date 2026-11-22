"use client";

import { useState } from "react";
import { ShieldCheck, Clock, Trash2 } from "lucide-react";
import type { Shop, User } from "@/lib/auth";

export default function SettingsClient({
  shop,
  user,
}: {
  shop: Shop;
  user: User;
}) {
  const [cleaning, setCleaning] = useState(false);
  const [cleanResult, setCleanResult] = useState<string | null>(null);

  async function handleManualCleanup() {
    setCleaning(true);
    setCleanResult(null);

    try {
      const res = await fetch("/api/cron/cleanup", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setCleanResult(data.message || `Cleaned up ${data.deletedCount} expired documents.`);
      } else {
        setCleanResult(`Cleanup error: ${data.error || "Failed"}`);
      }
    } catch {
      setCleanResult("Failed to trigger cleanup service.");
    } finally {
      setCleaning(false);
    }
  }

  return (
    <div style={{ maxWidth: 740 }}>
      <div className="eyebrow">Shop Configuration</div>
      <h1>Shop Settings & Privacy</h1>
      <p className="muted" style={{ marginBottom: 28 }}>
        Review your shop details and automatic 12-hour document lifecycle policies.
      </p>

      {/* Shop Info Card */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3>Shop Profile</h3>
        <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
            <span className="muted">Shop Name</span>
            <strong>{shop.name}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
            <span className="muted">Shop Code</span>
            <code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: 4 }}>{shop.shop_code}</code>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
            <span className="muted">Owner Email</span>
            <strong>{user.email}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0" }}>
            <span className="muted">Upload URL</span>
            <span style={{ color: "#2563eb", fontWeight: 600 }}>/print/{shop.shop_code}</span>
          </div>
        </div>
      </div>

      {/* 12-Hour Expiration Card */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <Clock size={20} color="#2563eb" />
          <h3 style={{ margin: 0 }}>Automatic 12-Hour File Purging</h3>
        </div>
        <p className="muted" style={{ fontSize: 14, lineHeight: 1.6 }}>
          All customer documents uploaded to your shop are stored in private storage (UploadThing / R2) and automatically deleted 12 hours after submission to keep your storage empty and free.
        </p>

        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <ShieldCheck size={20} color="#16a34a" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong style={{ fontSize: 14, color: "#1e293b", display: "block" }}>
                Metadata Retention Policy
              </strong>
              <span className="muted" style={{ fontSize: 13, lineHeight: 1.5, display: "block", marginTop: 4 }}>
                When a document reaches 12 hours, the physical file is removed from storage to protect customer privacy and keep your storage quota free. The customer name, file name, and upload timestamp remain in your database record so you maintain your business log.
              </span>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleManualCleanup}
            disabled={cleaning}
          >
            <Trash2 size={16} />
            {cleaning ? "Purging Expired Files..." : "Purge Expired Files Now"}
          </button>
          {cleanResult && (
            <span style={{ fontSize: 13, color: cleanResult.includes("error") ? "#dc2626" : "#16a34a", fontWeight: 600 }}>
              {cleanResult}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

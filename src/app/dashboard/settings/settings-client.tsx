"use client";

import { useState } from "react";
import { ShieldCheck, Clock, Trash2, Store, Phone, MapPin, Image as ImageIcon, Save, Check } from "lucide-react";
import type { Shop, User } from "@/lib/auth";

export default function SettingsClient({
  shop: initialShop,
  user,
}: {
  shop: Shop;
  user: User;
}) {
  const [shop, setShop] = useState<Shop>(initialShop);
  const [name, setName] = useState(initialShop.name || "");
  const [phone, setPhone] = useState(initialShop.phone || "");
  const [address, setAddress] = useState(initialShop.address || "");
  const [logoUrl, setLogoUrl] = useState(initialShop.logo_url || "");
  const [savingShop, setSavingShop] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [cleaning, setCleaning] = useState(false);
  const [cleanResult, setCleanResult] = useState<string | null>(null);

  async function handleSaveShop(e: React.FormEvent) {
    e.preventDefault();
    setSavingShop(true);
    setSaveSuccess(false);
    setSaveError("");

    try {
      const res = await fetch("/api/shop", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || null,
          address: address.trim() || null,
          logo_url: logoUrl.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update shop");

      setShop(data.shop);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Error updating shop profile.");
    } finally {
      setSavingShop(false);
    }
  }

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
      <h1>Shop Settings & Branding</h1>
      <p className="muted" style={{ marginBottom: 28 }}>
        Configure your shop branding, contact details, and automatic 12-hour document lifecycle policies.
      </p>

      {/* Shop Profile & Branding Card */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <Store size={22} color="#2563eb" />
          <h3 style={{ margin: 0 }}>Shop Branding & Contact Details</h3>
        </div>
        <p className="muted" style={{ fontSize: 13, marginBottom: 20 }}>
          Your shop name, logo, phone, and address appear on your public customer upload page and on your printed A4 counter poster.
        </p>

        <form onSubmit={handleSaveShop}>
          <div className="field">
            <label htmlFor="shopName">Shop Name <span style={{ color: "#e11d48" }}>*</span></label>
            <input
              id="shopName"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Royal Xerox & Stationery"
            />
          </div>

          <div className="grid2" style={{ gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="field" style={{ margin: "8px 0" }}>
              <label htmlFor="shopPhone">
                <Phone size={14} style={{ verticalAlign: "middle", marginRight: 4 }} />
                Counter Phone Number
              </label>
              <input
                id="shopPhone"
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
              />
            </div>

            <div className="field" style={{ margin: "8px 0" }}>
              <label htmlFor="shopLogo">
                <ImageIcon size={14} style={{ verticalAlign: "middle", marginRight: 4 }} />
                Shop Logo URL (Optional)
              </label>
              <input
                id="shopLogo"
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.png"
              />
            </div>
          </div>

          <div className="field" style={{ marginTop: 8 }}>
            <label htmlFor="shopAddress">
              <MapPin size={14} style={{ verticalAlign: "middle", marginRight: 4 }} />
              Shop Counter Address (Optional)
            </label>
            <input
              id="shopAddress"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Shop No. 4, Station Road, Opposite City College"
            />
          </div>

          {/* Logo preview if provided */}
          {logoUrl && (
            <div style={{ margin: "14px 0", display: "flex", alignItems: "center", gap: 12 }}>
              <span className="muted" style={{ fontSize: 12 }}>Logo Preview:</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt="Shop Logo"
                style={{ height: 40, width: "auto", objectFit: "contain", borderRadius: 4, border: "1px solid #cbd5e1", padding: 2 }}
                onError={(e) => { (e.target as HTMLElement).style.display = "none"; }}
              />
            </div>
          )}

          {saveError && (
            <div className="notice error" style={{ margin: "12px 0" }}>
              {saveError}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
            <span className="muted">Owner Account Email</span>
            <strong>{user.email}</strong>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 18 }}>
            <button type="submit" className="btn" disabled={savingShop}>
              {saveSuccess ? <Check size={16} /> : <Save size={16} />}
              {savingShop ? "Saving..." : saveSuccess ? "Saved Successfully!" : "Save Shop Details"}
            </button>
            <span className="muted" style={{ fontSize: 13 }}>
              Permanent shop code: <code>{shop.shop_code}</code>
            </span>
          </div>
        </form>
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

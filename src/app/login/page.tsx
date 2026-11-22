"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Unable to sign in.");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="topbar">
        <div className="shell topbar-inner">
          <Link href="/" className="brand">
            Smart<span>Print</span>
          </Link>
          <span className="pill">Shopkeeper Portal</span>
        </div>
      </header>

      <main className="shell page" style={{ maxWidth: 440, margin: "40px auto 0" }}>
        <div className="card" style={{ padding: "32px 28px" }}>
          <div className="eyebrow">Shop Access</div>
          <h1 style={{ fontSize: 26, margin: "6px 0 8px" }}>Sign in to your shop</h1>
          <p className="muted" style={{ fontSize: 14, marginBottom: 24 }}>
            Access incoming customer documents and print directly from your browser.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="email">Email Address</label>
              <div style={{ position: "relative" }}>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="shopkeeper@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={busy}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <div style={{ position: "relative" }}>
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                />
              </div>
            </div>

            {error && (
              <div className="notice error" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-full"
              disabled={busy || !email || !password}
              style={{ marginTop: 22 }}
            >
              <span>{busy ? "Signing in..." : "Sign in to Dashboard"}</span>
              <ArrowRight size={16} />
            </button>
          </form>

          <div style={{ marginTop: 24, paddingTop: 18, borderTop: "1px solid #f1f5f9", fontSize: 12, color: "#64748b", textAlign: "center" }}>
            Admin provisioned access only. Contact your system administrator to set up a new shop.
          </div>
        </div>
      </main>
    </>
  );
}

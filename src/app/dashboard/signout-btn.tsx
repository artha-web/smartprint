"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export default function DashboardSignOut() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className="btn btn-secondary"
      style={{ minHeight: 38, padding: "0 12px", fontSize: 13 }}
      onClick={handleLogout}
      disabled={busy}
    >
      <LogOut size={15} />
      <span>{busy ? "Signing out..." : "Sign out"}</span>
    </button>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import DashboardSignOut from "./signout-btn";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const { shop, user } = session;

  return (
    <>
      <header className="topbar">
        <div className="shell topbar-inner">
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Link href="/dashboard" className="brand">
              Smart<span>Print</span>
            </Link>
            <span className="pill" style={{ background: "#f1f5f9", color: "#334155" }}>
              {shop.name}
            </span>
          </div>

          <nav className="navlinks">
            <Link href="/dashboard">Overview</Link>
            <Link href="/dashboard/documents">All Documents</Link>
            <Link href="/dashboard/qr">Shop QR</Link>
            <Link href="/dashboard/settings">Settings</Link>
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 13, color: "#64748b" }} className="desktop-only">
              {user.email}
            </span>
            <DashboardSignOut />
          </div>
        </div>
      </header>

      <main className="shell page">{children}</main>
    </>
  );
}

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import QRClient from "./qr-client";

export const dynamic = "force-dynamic";

export default async function QRPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") || headersList.get("host") || "localhost:3000";
  const proto = headersList.get("x-forwarded-proto") || "http";
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `${proto}://${host}`;
  const uploadUrl = `${baseUrl}/print/${session.shop.shop_code}`;

  return (
    <QRClient
      shopName={session.shop.name}
      shopCode={session.shop.shop_code}
      uploadUrl={uploadUrl}
    />
  );
}

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import SettingsClient from "./settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <SettingsClient
      shop={session.shop}
      user={session.user}
    />
  );
}

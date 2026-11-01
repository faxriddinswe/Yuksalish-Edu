import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { backendUrl } from "@/lib/api/server";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { CabinetSession } from "@/components/layout/cabinet-session";
import type { User } from "@/types";
export const metadata = {
  title: "Shaxsiy kabinet",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookie = (await cookies()).toString();
  const response = await fetch(`${backendUrl}/api/v1/me/`, {
    headers: { Cookie: cookie, "X-Forwarded-Proto": "https" },
    cache: "no-store",
  });
  if (!response.ok) redirect("/kirish");
  const user = (await response.json()) as User;
  return (
    <CabinetSession key={JSON.stringify(user)} user={user}>
      <DashboardShell>{children}</DashboardShell>
    </CabinetSession>
  );
}

import { DashboardPage } from "@/features/dashboard";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ section?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ section }, query] = await Promise.all([params, searchParams]);
  const initialFilters = Object.fromEntries(
    Object.entries(query).map(([key, value]) => [
      key,
      (Array.isArray(value) ? value[0] : value) || "",
    ]),
  );
  return (
    <DashboardPage
      key={JSON.stringify([section, initialFilters])}
      section={section?.[0] || ""}
      initialFilters={initialFilters}
    />
  );
}

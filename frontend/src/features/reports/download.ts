import { ApiError } from "@/lib/api/client";

export async function downloadFinancialReport(params: URLSearchParams) {
  const response = await fetch(
    `/api/v1/reports/financial/download/?${params}`,
    {
      credentials: "same-origin",
      cache: "no-store",
    },
  );
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiError(
      response.status,
      data?.error?.message || "Excel faylini yuklab bo‘lmadi.",
      data?.error?.details,
    );
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `yuksalish-hisobot-${params.get("month") || "joriy-oy"}.xlsx`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

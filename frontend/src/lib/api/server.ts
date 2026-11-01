import "server-only";
import type { Page } from "@/types";

export const backendUrl =
  process.env.API_INTERNAL_URL || "http://127.0.0.1:8000";

async function publicResponse(path: string): Promise<Response> {
  return fetch(`${backendUrl}/api/v1/public/${path}`, {
    next: { revalidate: 60 },
    headers: { "X-Forwarded-Proto": "https" },
    signal: AbortSignal.timeout(10000),
  });
}

async function readPublicResponse<T>(response: Response): Promise<T> {
  if (!response.ok)
    throw new Error(
      "Markaz ma’lumotlarini yuklab bo‘lmadi. Birozdan keyin qayta urinib ko‘ring.",
    );
  return response.json();
}

export async function publicApi<T>(path: string): Promise<T> {
  return readPublicResponse<T>(await publicResponse(path));
}

export async function publicPage<T>(path: string, params: URLSearchParams) {
  const query = new URLSearchParams(params);
  const requested = query.get("page") || "1";
  const number = Number(requested);
  let page =
    /^\d+$/.test(requested) && Number.isSafeInteger(number) && number > 0
      ? String(number)
      : "1";
  query.set("page", page);
  let response = await publicResponse(`${path}?${query}`);
  // A saved page can disappear after results are unpublished or filtered.
  if (response.status === 404 && page !== "1") {
    page = "1";
    query.set("page", page);
    response = await publicResponse(`${path}?${query}`);
  }
  return { data: await readPublicResponse<Page<T>>(response), page };
}

export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
export function pageMetadata(title: string, description: string, path: string) {
  return {
    title,
    description,
    alternates: { canonical: `${siteUrl}${path}` },
    openGraph: {
      title: `${title} | Yuksalish Edu`,
      description,
      url: `${siteUrl}${path}`,
      locale: "uz_UZ",
      siteName: "Yuksalish Edu",
      type: "website" as const,
    },
  };
}

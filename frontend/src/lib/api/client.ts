export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details: unknown = null,
  ) {
    super(message);
  }
}
let csrf = "";
export function csrfCookie() {
  return typeof document === "undefined"
    ? ""
    : decodeURIComponent(
        document.cookie
          .split("; ")
          .find((s) => s.startsWith("csrftoken="))
          ?.split("=")[1] || "",
      );
}
export async function api<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method) && !csrfCookie()) {
    const response = await fetch("/api/v1/auth/session/", {
      credentials: "same-origin",
      cache: "no-store",
    });
    const body = await response.json();
    csrf = body.csrfToken || "";
  }
  const response = await fetch(`/api/v1/${path}`, {
    ...options,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      "X-CSRFToken": csrfCookie() || csrf,
      ...options.headers,
    },
  });
  const data =
    response.status === 204
      ? null
      : await response.json().catch(() => ({
          error: { message: "Server bilan bog‘lanib bo‘lmadi." },
        }));
  if (!response.ok) {
    throw new ApiError(
      response.status,
      data?.error?.message || "Amal bajarilmadi.",
      data?.error?.details,
    );
  }
  if (data?.csrfToken) csrf = data.csrfToken;
  return data as T;
}
export function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 403)
      return "Bu bo‘lim yoki amal uchun vakolatingiz yo‘q. Administratorga murojaat qiling.";
    const detail = error.details;
    if (detail) {
      return `${error.message} ${typeof detail === "string" ? detail : JSON.stringify(detail)}`;
    }
    return error.message;
  }
  return error instanceof Error
    ? error.message === "Failed to fetch"
      ? "Internet aloqasi yo‘q. Ma’lumotlar saqlanmadi."
      : error.message
    : "Kutilmagan xato.";
}

import { getCsrfToken, login } from "@/lib/auth";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export function csrfHeaders(): Record<string, string> {
  const token = getCsrfToken();
  return token ? { "X-XSRF-TOKEN": token } : {};
}

function sessionExpired(): never {
  login();
  throw new Error("Session expired");
}

/** JSON 요청/응답 — Content-Type: application/json + CSRF 자동 포함 */
export async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...csrfHeaders(),
        ...options?.headers,
      },
      ...options,
    });
  } catch {
    sessionExpired();
  }
  if (response.redirected || response.status === 401) sessionExpired();
  if (!response.ok) throw new Error(`API Error: ${response.status}`);
  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

/** Raw 요청 — Content-Type 미설정 (multipart/blob 등), CSRF 자동 포함 */
export async function fetchRaw(endpoint: string, options?: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      credentials: "include",
      headers: { ...csrfHeaders(), ...options?.headers },
      ...options,
    });
  } catch {
    sessionExpired();
  }
  if (response.redirected || response.status === 401) sessionExpired();
  if (!response.ok) throw new Error(`API Error: ${response.status}`);
  return response;
}

/** Content-Disposition 헤더에서 파일명을 추출해 다운로드 */
export async function downloadBlob(
  endpoint: string,
  fallbackFilename: string,
  options?: RequestInit,
): Promise<void> {
  const response = await fetchRaw(endpoint, options);
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename\*=UTF-8''(.+)/);
  const filename = match ? decodeURIComponent(match[1]) : fallbackFilename;
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

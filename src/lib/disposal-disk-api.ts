import { getCsrfToken, login } from "@/lib/auth";
import { DisposalDisk, DisposalDiskRequest } from "@/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

function csrfHeaders(): Record<string, string> {
  const token = getCsrfToken();
  return token ? { "X-XSRF-TOKEN": token } : {};
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      credentials: "include",
      headers: { "Content-Type": "application/json", ...csrfHeaders(), ...options?.headers },
      ...options,
    });
  } catch {
    login();
    throw new Error("Session expired");
  }
  if (response.redirected || response.status === 401) {
    login();
    throw new Error("Session expired");
  }
  if (!response.ok) throw new Error(`API Error: ${response.status}`);
  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

async function downloadBlob(endpoint: string, fallbackFilename: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, { credentials: "include" });
  if (response.redirected || response.status === 401) {
    login();
    throw new Error("Session expired");
  }
  if (!response.ok) throw new Error(`Download Error: ${response.status}`);
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

export const disposalDiskApi = {
  getAll: () => fetchApi<DisposalDisk[]>("/api/v1/disposal-disks"),

  register: (data: DisposalDiskRequest) =>
    fetchApi<DisposalDisk>("/api/v1/disposal-disks", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: number, data: DisposalDiskRequest) =>
    fetchApi<DisposalDisk>(`/api/v1/disposal-disks/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    fetchApi<void>(`/api/v1/disposal-disks/${id}`, { method: "DELETE" }),

  exportExcel: () =>
    downloadBlob(
      "/api/v1/disposal-disks/excel-export",
      `폐기디스크목록_${new Date().toISOString().slice(0, 10)}.xlsx`
    ),
};

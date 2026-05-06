import { getCsrfToken, login } from "@/lib/auth";
import { Audit, AuditItem, AuditRequest, AuditVerifyRequest } from "@/types";

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

export const auditApi = {
  create: (data: AuditRequest) =>
    fetchApi<Audit>("/api/v1/audits", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getAll: () => fetchApi<Audit[]>("/api/v1/audits"),

  get: (id: number) => fetchApi<Audit>(`/api/v1/audits/${id}`),

  delete: (id: number) =>
    fetchApi<void>(`/api/v1/audits/${id}`, { method: "DELETE" }),

  start: (id: number) =>
    fetchApi<Audit>(`/api/v1/audits/${id}/start`, { method: "PUT" }),

  complete: (id: number) =>
    fetchApi<Audit>(`/api/v1/audits/${id}/complete`, { method: "PUT" }),

  getItems: (id: number) =>
    fetchApi<AuditItem[]>(`/api/v1/audits/${id}/items`),

  getItemByRentalNo: (auditId: number, rentalNo: string) =>
    fetchApi<AuditItem>(`/api/v1/audits/${auditId}/items/by-rental-no/${rentalNo}`),

  verify: (auditId: number, rentalPcId: number, data: AuditVerifyRequest) =>
    fetchApi<AuditItem>(`/api/v1/audits/${auditId}/items/${rentalPcId}/verify`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  resetVerification: (auditId: number, rentalPcId: number) =>
    fetchApi<AuditItem>(`/api/v1/audits/${auditId}/items/${rentalPcId}/verify`, {
      method: "DELETE",
    }),
};

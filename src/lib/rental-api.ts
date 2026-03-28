import {
  CursorResponse,
  DashboardStats,
  RentalPc,
  RentalPcRequest,
  RentalPcUpdateRequest,
  ReturnRequest,
} from "@/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!response.ok) throw new Error(`API Error: ${response.status}`);
  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

async function downloadBlob(endpoint: string, fallbackFilename: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`);
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

export const rentalApi = {
  getDashboard: () =>
    fetchApi<DashboardStats>("/api/v1/rental-pcs/dashboard"),

  getRentalPcs: (lastId?: number | null, size = 20) => {
    const params = new URLSearchParams({ size: String(size) });
    if (lastId != null) params.set("lastId", String(lastId));
    return fetchApi<CursorResponse<RentalPc>>(`/api/v1/rental-pcs?${params}`);
  },

  register: (data: RentalPcRequest) =>
    fetchApi<void>("/api/v1/rental-pcs", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  registerBatch: (data: RentalPcRequest[]) =>
    fetchApi<void>("/api/v1/rental-pcs/batch", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: number, data: RentalPcUpdateRequest) =>
    fetchApi<void>(`/api/v1/rental-pcs/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  returnRentalPc: (id: number, data: ReturnRequest) =>
    fetchApi<void>(`/api/v1/rental-pcs/${id}/return`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  undoReturn: (id: number) =>
    fetchApi<void>(`/api/v1/rental-pcs/${id}/return`, {
      method: "DELETE",
    }),

  getReturnRecords: () =>
    fetchApi<RentalPc[]>("/api/v1/rental-pcs/returns"),

  uploadExcel: async (file: File): Promise<void> => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`${API_BASE_URL}/api/v1/rental-pcs/excel-upload`, {
      method: "POST",
      body: formData,
    });
    if (!response.ok) throw new Error(`Upload Error: ${response.status}`);
  },

  reportLost: (id: number) =>
    fetchApi<void>(`/api/v1/rental-pcs/${id}/lost`, { method: "POST" }),

  undoLost: (id: number) =>
    fetchApi<void>(`/api/v1/rental-pcs/${id}/lost`, { method: "DELETE" }),

  getExpiringPcs: () =>
    fetchApi<RentalPc[]>("/api/v1/rental-pcs/expiring"),

  exportExcel: () =>
    downloadBlob(
      "/api/v1/rental-pcs/excel-export",
      `렌탈PC목록_${new Date().toISOString().slice(0, 10)}.xlsx`
    ),

  downloadTemplate: () =>
    downloadBlob("/api/v1/rental-pcs/excel-template", "렌탈PC_등록양식.xlsx"),
};

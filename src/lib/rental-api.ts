import {
  Assignment,
  AssignmentRequest,
  CursorResponse,
  DashboardStats,
  LabelFormat,
  Replacement,
  ReplacementRequest,
  RentalPc,
  RentalPcRequest,
  RentalPcSearchParams,
  RentalPcUpdateRequest,
  ReturnRequest,
} from "@/types";

import { getCsrfToken, login } from "@/lib/auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

function csrfHeaders(): Record<string, string> {
  const token = getCsrfToken();
  return token ? { "X-XSRF-TOKEN": token } : {};
}

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
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
    // 세션 만료 시 BFF가 Keycloak으로 리다이렉트 → CORS 오류로 fetch 자체가 실패
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

async function downloadBlob(
  endpoint: string,
  fallbackFilename: string,
  options?: RequestInit,
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    credentials: "include",
    ...options,
  });
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

export const rentalApi = {
  getDashboard: () => fetchApi<DashboardStats>("/api/v1/rental-pcs/dashboard"),

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

  getAssignedPcs: () => fetchApi<RentalPc[]>("/api/v1/rental-pcs/assigned"),

  getReturnRecords: () => fetchApi<RentalPc[]>("/api/v1/rental-pcs/returns"),

  getLostRecords: () => fetchApi<RentalPc[]>("/api/v1/rental-pcs/lost"),

  uploadExcel: async (file: File): Promise<void> => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(
      `${API_BASE_URL}/api/v1/rental-pcs/excel-upload`,
      {
        method: "POST",
        credentials: "include",
        headers: { ...csrfHeaders() },
        body: formData,
      },
    );
    console.log(response);
    if (response.redirected || response.status === 401) {
      login();
      throw new Error("Session expired");
    }
    if (!response.ok) throw new Error(`Upload Error: ${response.status}`);
  },

  reportLost: (id: number) =>
    fetchApi<void>(`/api/v1/rental-pcs/${id}/lost`, { method: "POST" }),

  undoLost: (id: number) =>
    fetchApi<void>(`/api/v1/rental-pcs/${id}/lost`, { method: "DELETE" }),

  getExpiringPcs: () => fetchApi<RentalPc[]>("/api/v1/rental-pcs/expiring"),

  exportExcel: () =>
    downloadBlob(
      "/api/v1/rental-pcs/excel-export",
      `렌탈PC목록_${new Date().toISOString().slice(0, 10)}.xlsx`,
    ),

  exportExcelWithAssignment: () =>
    downloadBlob(
      "/api/v1/rental-pcs/excel-export-with-assignment",
      `렌탈PC_사용자매핑_${new Date().toISOString().slice(0, 10)}.xlsx`,
    ),

  downloadTemplate: () =>
    downloadBlob("/api/v1/rental-pcs/excel-template", "렌탈PC_등록양식.xlsx"),

  getAssignment: (id: number) =>
    fetchApi<Assignment | null>(`/api/v1/rental-pcs/${id}/assignment`),

  assign: (id: number, data: AssignmentRequest) =>
    fetchApi<Assignment>(`/api/v1/rental-pcs/${id}/assignment`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  removeAssignment: (id: number) =>
    fetchApi<void>(`/api/v1/rental-pcs/${id}/assignment`, { method: "DELETE" }),

  downloadAssignTemplate: () =>
    downloadBlob("/api/v1/rental-pcs/assign-template", "사용자배정_양식.xlsx"),

  batchAssign: (data: {
    items: {
      rentalNo: string;
      assignmentType: string;
      empNo: string | null;
      userName: string | null;
      department: string | null;
      companyCode: string | null;
      businessSiteCode: string | null;
      purpose?: string | null;
    }[];
    assignedBy: string;
  }) =>
    fetchApi<Assignment[]>("/api/v1/rental-pcs/assignment/batch", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  search: (params: RentalPcSearchParams) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) query.set(k, v);
    });
    return fetchApi<RentalPc[]>(`/api/v1/rental-pcs/search?${query}`);
  },

  replace: (id: number, data: ReplacementRequest) =>
    fetchApi<Replacement>(`/api/v1/rental-pcs/${id}/replace`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getReplacementHistory: (id: number) =>
    fetchApi<Replacement[]>(`/api/v1/rental-pcs/${id}/replacements`),

  getAllReplacements: () =>
    fetchApi<Replacement[]>("/api/v1/rental-pcs/replacements"),

  deleteRentalPc: (id: number) =>
    fetchApi<void>(`/api/v1/rental-pcs/${id}`, { method: "DELETE" }),

  deleteAllRentalPcs: () =>
    fetchApi<void>("/api/v1/rental-pcs", { method: "DELETE" }),

  downloadQrLabelPdf: async (
    ids: number[],
    format: LabelFormat,
  ): Promise<void> => {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/rental-pcs/qr-labels`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ ids, format }),
      },
    );
    if (response.redirected || response.status === 401) {
      login();
      throw new Error("Session expired");
    }
    if (!response.ok) throw new Error(`Download Error: ${response.status}`);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `QR라벨_${new Date().toISOString().slice(0, 10)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  },
};

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

import { fetchApi, fetchRaw, downloadBlob } from "@/lib/http-client";

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
    fetchApi<void>(`/api/v1/rental-pcs/${id}/return`, { method: "DELETE" }),

  getAssignedPcs: () => fetchApi<RentalPc[]>("/api/v1/rental-pcs/assigned"),

  getReturnRecords: () => fetchApi<RentalPc[]>("/api/v1/rental-pcs/returns"),

  getLostRecords: () => fetchApi<RentalPc[]>("/api/v1/rental-pcs/lost"),

  // FormData 업로드: Content-Type 미설정 (브라우저가 multipart boundary 자동 지정)
  uploadExcel: async (file: File): Promise<void> => {
    const formData = new FormData();
    formData.append("file", file);
    await fetchRaw("/api/v1/rental-pcs/excel-upload", {
      method: "POST",
      body: formData,
    });
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

  // POST → blob (JSON body + CSRF 포함, Content-Type은 options.headers로 전달)
  downloadQrLabelPdf: async (ids: number[], format: LabelFormat): Promise<void> => {
    await downloadBlob(
      "/api/v1/rental-pcs/qr-labels",
      `QR라벨_${new Date().toISOString().slice(0, 10)}.pdf`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, format }),
      },
    );
  },
};

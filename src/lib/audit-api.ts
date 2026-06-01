import { fetchApi } from "@/lib/http-client";
import { Audit, AuditItem, AuditRequest, AuditVerifyRequest } from "@/types";

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

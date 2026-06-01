import { fetchApi, downloadBlob } from "@/lib/http-client";
import { DisposalDisk, DisposalDiskRequest } from "@/types";

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
      `폐기디스크목록_${new Date().toISOString().slice(0, 10)}.xlsx`,
    ),
};

import { fetchApi } from "@/lib/http-client";
import { NetworkEquipment, NetworkEquipmentRequest } from "@/types";

export const networkEquipmentApi = {
  getAll: () => fetchApi<NetworkEquipment[]>("/api/v1/network-equipment"),

  getById: (id: number) => fetchApi<NetworkEquipment>(`/api/v1/network-equipment/${id}`),

  create: (request: NetworkEquipmentRequest) =>
    fetchApi<NetworkEquipment>("/api/v1/network-equipment", {
      method: "POST",
      body: JSON.stringify(request),
    }),

  update: (id: number, request: NetworkEquipmentRequest) =>
    fetchApi<NetworkEquipment>(`/api/v1/network-equipment/${id}`, {
      method: "PUT",
      body: JSON.stringify(request),
    }),

  delete: (id: number) =>
    fetchApi<void>(`/api/v1/network-equipment/${id}`, { method: "DELETE" }),
};

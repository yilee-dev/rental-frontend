import { fetchApi } from "@/lib/http-client";
import { Server, ServerRequest } from "@/types";

export const serverApi = {
  getAll: () => fetchApi<Server[]>("/api/v1/servers"),

  getById: (id: number) => fetchApi<Server>(`/api/v1/servers/${id}`),

  create: (request: ServerRequest) =>
    fetchApi<Server>("/api/v1/servers", {
      method: "POST",
      body: JSON.stringify(request),
    }),

  update: (id: number, request: ServerRequest) =>
    fetchApi<Server>(`/api/v1/servers/${id}`, {
      method: "PUT",
      body: JSON.stringify(request),
    }),

  delete: (id: number) =>
    fetchApi<void>(`/api/v1/servers/${id}`, { method: "DELETE" }),
};

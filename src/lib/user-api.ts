import { fetchApi } from "@/lib/http-client";
import { DepartmentNode, UserProfile } from "@/types";

export const userApi = {
  searchUsers: (search?: string, department?: string, max = 50): Promise<UserProfile[]> => {
    if (department) {
      return fetchApi<UserProfile[]>(`/api/v1/users/department?path=${encodeURIComponent(department)}`);
    }
    const params = new URLSearchParams({ max: String(max) });
    if (search) params.set("keyword", search);
    return fetchApi<UserProfile[]>(`/api/v1/users/search?${params}`);
  },

  getDepartments: (): Promise<DepartmentNode[]> =>
    fetchApi<DepartmentNode[]>("/api/v1/users/departments"),

  getRetiredUsers: (): Promise<UserProfile[]> =>
    fetchApi<UserProfile[]>("/api/v1/users/retired"),
};

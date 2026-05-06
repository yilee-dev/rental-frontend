import { login } from "@/lib/auth";
import { DepartmentNode, UserProfile } from "@/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://10.117.9.40:8080";

async function apiFetch<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${endpoint}`, { credentials: "include" });
  if (res.redirected || res.status === 401) {
    login();
    throw new Error("Session expired");
  }
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json() as Promise<T>;
}

export const userApi = {
  searchUsers: (search?: string, department?: string, max = 50): Promise<UserProfile[]> => {
    if (department) {
      return apiFetch<UserProfile[]>(`/api/v1/users/department?path=${encodeURIComponent(department)}`);
    }
    const params = new URLSearchParams({ max: String(max) });
    if (search) params.set("keyword", search);
    return apiFetch<UserProfile[]>(`/api/v1/users/search?${params}`);
  },

  getDepartments: (): Promise<DepartmentNode[]> =>
    apiFetch<DepartmentNode[]>("/api/v1/users/departments"),

  getRetiredUsers: (): Promise<UserProfile[]> =>
    apiFetch<UserProfile[]>("/api/v1/users/retired"),
};

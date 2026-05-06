import { getCsrfToken, login } from "@/lib/auth";
import { Software } from "@/types";

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

async function fetchRaw(endpoint: string, options?: RequestInit): Promise<Response> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    credentials: "include",
    headers: { ...csrfHeaders(), ...options?.headers },
    ...options,
  });
  if (response.redirected || response.status === 401) {
    login();
    throw new Error("Session expired");
  }
  if (!response.ok) throw new Error(`API Error: ${response.status}`);
  return response;
}

export const softwareApi = {
  getAll: () =>
    fetchApi<Software[]>("/api/v1/software"),

  upload: (formData: FormData) =>
    fetchRaw("/api/v1/software", {
      method: "POST",
      body: formData,
    }).then((res) => res.json() as Promise<Software>),

  download: (id: number, fileName: string) =>
    fetchRaw(`/api/v1/software/${id}/download`).then(async (res) => {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    }),

  delete: (id: number) =>
    fetchRaw(`/api/v1/software/${id}`, { method: "DELETE" }).then(() => {}),
};

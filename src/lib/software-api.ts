import { fetchApi, fetchRaw } from "@/lib/http-client";
import { Software } from "@/types";

export const softwareApi = {
  getAll: () =>
    fetchApi<Software[]>("/api/v1/software"),

  // FormData 업로드: Content-Type 미설정 (브라우저가 multipart boundary 자동 지정)
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

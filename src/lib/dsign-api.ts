import { DsignSignatureLog } from "@/types";
import { API_BASE_URL, csrfHeaders, fetchApi } from "@/lib/http-client";
import { login } from "@/lib/auth";

/** 특정 배정의 최신 서약서 발송/서명 상태 조회 — 204는 null 반환 */
export async function getDsignStatus(assignmentId: number): Promise<DsignSignatureLog | null> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/dsign/assignment/${assignmentId}`,
    { credentials: "include" },
  );
  if (res.redirected || res.status === 401) { login(); throw new Error("Session expired"); }
  if (res.status === 204) return null;
  if (!res.ok) throw new Error("서약서 상태 조회 실패");
  return res.json();
}

/** 서명 대기 중인 서약서 목록 조회 */
export async function getPendingDsignLogs(): Promise<DsignSignatureLog[]> {
  return fetchApi<DsignSignatureLog[]>("/api/v1/dsign/pending");
}

/** 발송 실패 목록 조회 */
export async function getFailedDsignLogs(): Promise<DsignSignatureLog[]> {
  return fetchApi<DsignSignatureLog[]>("/api/v1/dsign/failed");
}

/** 서약 완료 크롤링 수동 트리거 */
export async function triggerDsignPoll(): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1/dsign/poll`, {
    method: "POST",
    credentials: "include",
    headers: { ...csrfHeaders() },
  });
  if (res.redirected || res.status === 401) { login(); throw new Error("Session expired"); }
  if (!res.ok) throw new Error("서약 현황 업데이트 실패");
}

/** 서약서 수동 발송 */
export async function sendDsignPledge(rentalPcId: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1/dsign/send/${rentalPcId}`, {
    method: "POST",
    credentials: "include",
    headers: { ...csrfHeaders() },
  });
  if (res.redirected || res.status === 401) { login(); throw new Error("Session expired"); }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? "서약서 발송 요청 실패");
  }
}

import { DsignSignatureLog } from "@/types";
import { getCsrfToken } from "@/lib/auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

function csrfHeaders(): Record<string, string> {
  const token = getCsrfToken();
  return token ? { "X-XSRF-TOKEN": token } : {};
}

/** 특정 배정의 최신 서약서 발송/서명 상태 조회 */
export async function getDsignStatus(assignmentId: number): Promise<DsignSignatureLog | null> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/dsign/assignment/${assignmentId}`,
    { credentials: "include" }
  );
  if (res.status === 204) return null;
  if (!res.ok) throw new Error("서약서 상태 조회 실패");
  return res.json();
}

/** 서명 대기 중인 서약서 목록 조회 */
export async function getPendingDsignLogs(): Promise<DsignSignatureLog[]> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/dsign/pending`,
    { credentials: "include" }
  );
  if (!res.ok) throw new Error("서명 대기 목록 조회 실패");
  return res.json();
}

/** 발송 실패 목록 조회 */
export async function getFailedDsignLogs(): Promise<DsignSignatureLog[]> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/dsign/failed`,
    { credentials: "include" }
  );
  if (!res.ok) throw new Error("발송 실패 목록 조회 실패");
  return res.json();
}

/** 서약 완료 크롤링 수동 트리거 */
export async function triggerDsignPoll(): Promise<void> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/dsign/poll`,
    {
      method: "POST",
      credentials: "include",
      headers: { ...csrfHeaders() },
    }
  );
  if (!res.ok) throw new Error("서약 현황 업데이트 실패");
}

/** 서약서 수동 발송 */
export async function sendDsignPledge(rentalPcId: number): Promise<void> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/dsign/send/${rentalPcId}`,
    {
      method: "POST",
      credentials: "include",
      headers: { ...csrfHeaders() },
    }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? "서약서 발송 요청 실패");
  }
}

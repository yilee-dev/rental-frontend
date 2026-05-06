"use client";

import { DsignSendStatus, DsignSignStatus } from "@/types";

interface DsignStatusBadgeProps {
  sendStatus: DsignSendStatus;
  signStatus: DsignSignStatus;
  signedAt?: string | null;
  sendErrorMsg?: string | null;
}

export default function DsignStatusBadge({
  sendStatus,
  signStatus,
  signedAt,
  sendErrorMsg,
}: DsignStatusBadgeProps) {
  // 서명 완료 (sendStatus 무관 — 폴러가 SKIPPED/FAILED 상태에서도 SIGNED로 업데이트 가능)
  if (signStatus === "SIGNED") {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800"
        title={signedAt ? `서명일: ${new Date(signedAt).toLocaleDateString("ko-KR")}` : undefined}
      >
        서명완료
      </span>
    );
  }

  // 서명 대기 (발송 성공)
  if (sendStatus === "SENT" && signStatus === "WAITING") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
        서명대기
      </span>
    );
  }

  // 기한 초과
  if (sendStatus === "SENT" && signStatus === "EXPIRED") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
        기한초과
      </span>
    );
  }

  // 발송 실패
  if (sendStatus === "FAILED") {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 cursor-help"
        title={sendErrorMsg ?? "발송 실패"}
      >
        발송실패
      </span>
    );
  }

  // 발송 대기 중
  if (sendStatus === "PENDING") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
        발송중
      </span>
    );
  }

  // 미해당 (SKIPPED — 부서/사업장 배정)
  return null;
}

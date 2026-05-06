import { useAuthStore } from "@/store/authStore";

// 권한 상수
export const P = {
  // 렌탈 PC
  RENTAL_READ: "rental:read",
  RENTAL_WRITE: "rental:write",
  RENTAL_DELETE: "rental:delete",
  RENTAL_QR: "rental:qr",
  // 실사
  AUDIT_READ: "audit:read",
  AUDIT_MANAGE: "audit:manage",
  AUDIT_VERIFY: "audit:verify",
  // 폐기 디스크
  DISPOSAL_READ: "disposal:read",
  DISPOSAL_WRITE: "disposal:write",
  DISPOSAL_DELETE: "disposal:delete",
  // 소프트웨어
  SOFTWARE_READ: "software:read",
  SOFTWARE_WRITE: "software:write",
  SOFTWARE_DELETE: "software:delete",
} as const;

export function useHasPermission(permission: string): boolean {
  const user = useAuthStore((s) => s.user);
  return user?.permissions?.includes(permission) ?? false;
}

export function usePermissions(): string[] {
  const user = useAuthStore((s) => s.user);
  return user?.permissions ?? [];
}

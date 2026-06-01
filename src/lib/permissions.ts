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
  // 서버 자산
  SERVER_READ: "server:read",
  SERVER_WRITE: "server:write",
  SERVER_DELETE: "server:delete",
  // 네트워크 장비
  NETWORK_READ: "network:read",
  NETWORK_WRITE: "network:write",
  NETWORK_DELETE: "network:delete",
} as const;

export function useHasPermission(permission: string): boolean {
  const user = useAuthStore((s) => s.user);
  return user?.permissions?.includes(permission) ?? false;
}

export function usePermissions(): string[] {
  const user = useAuthStore((s) => s.user);
  return user?.permissions ?? [];
}

const DEFAULT_ROUTE_MAP: { permission: string; route: string }[] = [
  { permission: P.RENTAL_READ,   route: "/dashboard" },
  { permission: P.AUDIT_READ,    route: "/audit" },
  { permission: P.DISPOSAL_READ, route: "/disposal" },
  { permission: P.SOFTWARE_READ, route: "/software" },
  { permission: P.SERVER_READ,   route: "/servers" },
  { permission: P.NETWORK_READ,  route: "/network-equipment" },
];

export function getDefaultRoute(permissions: string[]): string {
  for (const { permission, route } of DEFAULT_ROUTE_MAP) {
    if (permissions.includes(permission)) return route;
  }
  return "/";
}

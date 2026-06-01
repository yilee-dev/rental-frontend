"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, ChevronLeft, ChevronRight, ClipboardCheck, HardDrive, LayoutDashboard, Monitor, Network, Package, RefreshCw, Server, Shield, Trash2, Undo2, UserX, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/lib/permissions";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
  improving?: boolean;
}

interface NavGroup {
  title?: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    items: [
      { href: "/dashboard", label: "대시보드", icon: LayoutDashboard, permission: "rental:read" },
    ],
  },
  {
    title: "PC 관리",
    items: [
      { href: "/rental", label: "렌탈 PC 목록", icon: Monitor, permission: "rental:read" },
      { href: "/returns", label: "반납/분실 관리", icon: Undo2, permission: "rental:read" },
      { href: "/replacements", label: "교체 이력 관리", icon: RefreshCw, permission: "rental:read" },
      { href: "/recovery", label: "퇴직자 회수 관리", icon: UserX, permission: "rental:read" },
    ],
  },
  {
    title: "자산 관리",
    items: [
      { href: "/audit", label: "자산 실사 관리", icon: ClipboardCheck, permission: "audit:read" },
      { href: "/disposal", label: "폐기 디스크 관리", icon: HardDrive, permission: "disposal:read" },
      { href: "/software", label: "필수 소프트웨어", icon: Package, permission: "software:read" },
    ],
  },
  {
    title: "인프라 관리",
    items: [
      { href: "/servers", label: "서버 자산 관리", icon: Server, permission: "server:read", improving: true },
      { href: "/network-equipment", label: "네트워크 장비 관리", icon: Network, permission: "network:read", improving: true },
      { href: "/network-traffic", label: "트래픽 분석", icon: Activity, permission: "server:read" },
    ],
  },
];

const adminItems: NavItem[] = [
  { href: "/admin/auth-rules", label: "API 권한 관리", icon: Shield, permission: "admin:manage" },
  { href: "/admin/reset", label: "데이터 초기화", icon: Trash2, permission: "admin:manage" },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({ open, onClose, collapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const permissions = usePermissions();

  function hasPermission(permission?: string) {
    if (!permission) return true;
    return permissions.includes(permission);
  }

  const visibleGroups = navGroups
    .map((g) => ({ ...g, items: g.items.filter((item) => hasPermission(item.permission)) }))
    .filter((g) => g.items.length > 0);
  const visibleAdmin = adminItems.filter((item) => hasPermission(item.permission));

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-30 lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-56 border-r border-gray-200/80 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm flex flex-col transition-all duration-300 ease-in-out",
          "lg:static lg:z-auto lg:translate-x-0",
          collapsed ? "lg:w-14" : "lg:w-56",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex items-center justify-between px-4 h-14 border-b border-gray-200/80 dark:border-gray-800 lg:hidden shrink-0">
          <span className="font-semibold text-sm">메뉴</span>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <nav className="p-3 flex-1 overflow-y-auto space-y-4">
          {visibleGroups.map((group, gi) => (
            <div key={gi}>
              {group.title && (
                <div className={cn("pb-1.5", collapsed ? "lg:hidden" : "px-3")}>
                  <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    {group.title}
                  </p>
                </div>
              )}
              {group.title && gi > 0 && (
                <div className="hidden lg:block border-t border-gray-200/60 dark:border-gray-800/60 mb-2 mx-1" />
              )}
              <div className="space-y-0.5">
                {group.items.map(({ href, label, icon: Icon, improving }) => {
                  const isActive = pathname === href;
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={onClose}
                      title={collapsed ? label : undefined}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200",
                        collapsed && "lg:justify-center lg:px-0",
                        isActive
                          ? "bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400"
                          : "text-gray-500 dark:text-gray-400 hover:bg-gray-100/70 dark:hover:bg-gray-800/40 hover:text-gray-700 dark:hover:text-gray-300"
                      )}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className={cn("flex-1", collapsed && "lg:hidden")}>{label}</span>
                      {improving && !collapsed && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 shrink-0">
                          개선 중
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          {visibleAdmin.length > 0 && (
            <>
              <div className="hidden lg:block border-t border-gray-200/60 dark:border-gray-800/60 mb-2 mx-1" />
              <div className={cn("pb-1.5", collapsed ? "lg:hidden" : "px-3")}>
                <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">관리자</p>
              </div>
              {visibleAdmin.map(({ href, label, icon: Icon }) => {
                const isActive = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onClose}
                    title={collapsed ? label : undefined}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200",
                      collapsed && "lg:justify-center lg:px-0",
                      isActive
                        ? "bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400"
                        : "text-gray-500 dark:text-gray-400 hover:bg-gray-100/70 dark:hover:bg-gray-800/40 hover:text-gray-700 dark:hover:text-gray-300"
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className={cn(collapsed && "lg:hidden")}>{label}</span>
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        {/* 데스크탑 접기/펼치기 버튼 */}
        <div className="hidden lg:flex border-t border-gray-200/80 dark:border-gray-800 p-2 shrink-0">
          <button
            onClick={onToggleCollapse}
            className={cn(
              "flex items-center gap-2 w-full px-3 py-2 rounded-lg text-[13px] font-medium",
              "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300",
              "hover:bg-gray-100/70 dark:hover:bg-gray-800/40 transition-all duration-200",
              collapsed && "justify-center px-0",
            )}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4 shrink-0" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4 shrink-0" />
                <span>접기</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}

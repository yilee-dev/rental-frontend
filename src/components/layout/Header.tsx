"use client";

import { LogOut, Menu, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/authStore";
import { logout } from "@/lib/auth";

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const user = useAuthStore((s) => s.user);

  return (
    <header className="h-14 border-b border-gray-200/80 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md flex items-center px-4 lg:px-6 gap-3 shrink-0 sticky top-0 z-20">
      {/* 모바일 햄버거 */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenuClick}
        aria-label="메뉴 열기"
      >
        <Menu className="w-5 h-5" />
      </Button>

      <div className="flex items-center gap-2.5 font-semibold text-lg flex-1">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-sm">
          <Monitor className="w-4 h-4 text-white" />
        </div>
        <span className="hidden sm:inline bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 bg-clip-text text-transparent">
          렌탈 PC 관리
        </span>
        <span className="sm:hidden bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 bg-clip-text text-transparent">
          렌탈 관리
        </span>
        {/* 다크모드 토글 */}
        <Button
          variant="ghost"
          size="icon"
          className="ml-1"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="테마 전환"
        >
          <Sun className="w-4 h-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute w-4 h-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
      </div>

      {/* 사용자 정보 */}
      {user && (
        <div className="hidden sm:flex items-center gap-2.5">
          {/* 이니셜 아바타 */}
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-sm font-semibold shrink-0 shadow-sm">
            {user.familyName ?? user.name.charAt(0)}
          </div>
          <div className="flex flex-col items-end leading-tight">
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
              {user.familyName && user.givenName
                ? `${user.familyName}${user.givenName}`
                : user.name}
            </span>
            {user.empNo && (
              <span className="text-[11px] text-gray-400">{user.empNo}</span>
            )}
          </div>
        </div>
      )}

      {/* 로그아웃 */}
      <Button
        variant="ghost"
        size="icon"
        onClick={logout}
        aria-label="로그아웃"
        className="text-gray-400 hover:text-red-500 transition-colors"
      >
        <LogOut className="w-4 h-4" />
      </Button>
    </header>
  );
}

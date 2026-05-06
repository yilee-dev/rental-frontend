"use client";

import { useEffect } from "react";
import { fetchCurrentUser, login } from "@/lib/auth";
import { useAuthStore } from "@/store/authStore";

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { initialized, user, setUser, setInitialized } = useAuthStore();

  useEffect(() => {
    fetchCurrentUser().then((user) => {
      if (!user) {
        // 루프 방지: 직전에 로그인 리다이렉트를 이미 수행했으면 재시도하지 않음
        const attempts = parseInt(sessionStorage.getItem("login_attempts") ?? "0", 10);
        if (attempts >= 2) {
          sessionStorage.removeItem("login_attempts");
          sessionStorage.removeItem("redirect_after_login");
          setInitialized(true); // 인증 실패 상태로 확정 — 무한 루프 차단
          return;
        }
        sessionStorage.setItem("login_attempts", String(attempts + 1));
        login();
      } else {
        sessionStorage.removeItem("login_attempts");
        setUser(user);

        // 로그인 후 원래 URL로 복원 — setInitialized 전에 처리해야 현재 페이지가 깜빡이지 않음
        const redirectUrl = sessionStorage.getItem("redirect_after_login");
        if (redirectUrl) {
          sessionStorage.removeItem("redirect_after_login");
          const current = window.location.href;
          if (redirectUrl !== current) {
            window.location.replace(redirectUrl);
            return; // 새 페이지에서 initialized 처리
          }
        }

        setInitialized(true);
      }
    });
  }, [setUser, setInitialized]);

  if (!initialized) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">인증 확인 중...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <p className="text-sm text-destructive font-medium">인증에 실패했습니다.</p>
          <button
            onClick={() => { sessionStorage.removeItem("login_attempts"); login(); }}
            className="text-xs text-muted-foreground underline cursor-pointer"
          >
            다시 로그인
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

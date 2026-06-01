export interface AuthUser {
  username: string;
  name: string;
  givenName?: string;
  familyName?: string;
  email?: string;
  empNo?: string;
  roles?: string[];
  permissions?: string[];
}

const BFF_URL = process.env.NEXT_PUBLIC_BFF_URL ?? "http://10.117.9.40:8080";

/**
 * BFF 세션 쿠키를 기반으로 현재 인증된 사용자 정보를 가져옵니다.
 * 인증되지 않은 경우(401 등) null을 반환합니다.
 */
export async function fetchCurrentUser(): Promise<AuthUser | null> {
  try {
    const res = await fetch(`${BFF_URL}/api/auth/me`, {
      credentials: "include",
    });
    if (!res.ok) return null;
    return await res.json() as AuthUser;
  } catch {
    return null;
  }
}

/**
 * BFF OAuth2 엔드포인트로 리다이렉트하여 Keycloak 로그인을 시작합니다.
 */
export function login() {
  // 로그인 전 현재 URL 저장 (로그인 후 복원용)
  sessionStorage.setItem("redirect_after_login", window.location.href);
  window.location.href = `${BFF_URL}/oauth2/authorization/keycloak`;
}

/**
 * document.cookie에서 XSRF-TOKEN 값을 읽습니다.
 * BFF가 CookieServerCsrfTokenRepository.withHttpOnlyFalse()로 설정되어 있어야 합니다.
 */
export function getCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * BFF sign-out API를 호출하여 Keycloak 세션까지 완전히 종료합니다.
 * CSRF 토큰을 X-XSRF-TOKEN 헤더에 포함합니다.
 */
export function hasAnyAccess(user: AuthUser): boolean {
  return (user.permissions?.length ?? 0) > 0;
}

export async function logout() {
  const csrfToken = getCsrfToken();
  try {
    await fetch(`${BFF_URL}/api/auth/sign-out`, {
      method: "POST",
      credentials: "include",
      headers: {
        ...(csrfToken ? { "X-XSRF-TOKEN": csrfToken } : {}),
      },
    });
  } catch {
    // 실패해도 로그인 페이지로 이동
  }
  // 로그아웃 시에는 현재 URL을 저장하지 않고 Keycloak 로그인으로 리다이렉트
  sessionStorage.removeItem("redirect_after_login");
  window.location.href = `${BFF_URL}/oauth2/authorization/keycloak`;
}

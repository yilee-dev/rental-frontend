import { NextRequest, NextResponse } from "next/server";

const MOBILE_RE = /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|Opera Mini|IEMobile/i;

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const rentalNo = searchParams.get("no");

  // /rental?no=XXX 접속 시 모바일이면 /scan?no=XXX 로 리다이렉트
  if (pathname === "/rental" && rentalNo) {
    const ua = request.headers.get("user-agent") ?? "";
    if (MOBILE_RE.test(ua)) {
      const url = request.nextUrl.clone();
      url.pathname = "/scan";
      url.searchParams.set("no", rentalNo);
      const response = NextResponse.redirect(url);
      // 로그인 후 복원용 쿠키에 rentalNo 저장
      response.cookies.set("scan_rental_no", rentalNo, { path: "/", maxAge: 300 });
      return response;
    }
  }

  // /scan 접속 시 no 파라미터 없으면 쿠키에서 복원
  if (pathname === "/scan" && !rentalNo) {
    const savedNo = request.cookies.get("scan_rental_no")?.value;
    if (savedNo) {
      const url = request.nextUrl.clone();
      url.searchParams.set("no", savedNo);
      const response = NextResponse.redirect(url);
      response.cookies.delete("scan_rental_no");
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/rental", "/scan"],
};

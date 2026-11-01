import { NextResponse, type NextRequest } from "next/server";

// 쿠키가 아예 없으면 로그인 화면으로 보낸다. 서명 검증은 requireAdmin()이 한다.
export function proxy(request: NextRequest) {
  if (!request.cookies.has("mayo_admin")) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/((?!login).*)"],
};

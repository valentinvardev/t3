import { auth } from "~/server/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  const isAuthPage = pathname === "/signin" || pathname === "/signup";

  if (!isLoggedIn && !isAuthPage) {
    return NextResponse.redirect(new URL("/signin", req.nextUrl));
  }

  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/notes", req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

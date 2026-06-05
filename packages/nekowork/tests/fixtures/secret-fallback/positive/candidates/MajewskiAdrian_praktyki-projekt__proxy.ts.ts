import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

export function proxy(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const publicPaths = ["/login", "/register", "/api/login", "/api/register"];

  // Zezwalamy na publiczne ścieżki bez tokena
  if (publicPaths.includes(req.nextUrl.pathname)) {
    return NextResponse.next();
  }

  // Brak tokena — przekierowanie do logowania
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Weryfikacja tokena
  try {
    jwt.verify(token, process.env.JWT_SECRET || "");
  } catch (err) {
    const response = NextResponse.redirect(new URL("/login", req.url));
    response.cookies.delete("token");
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

import { NextResponse, NextRequest } from "next/server";
import { jwtVerify } from "jose";

function deriveSecret(): Uint8Array | null {
  const sk = process.env.STRIPE_SECRET_KEY || "";
  if (!sk) return null;
  const data = new TextEncoder().encode(sk + "::portal");
  let h = 2166136261 >>> 0;
  for (let i = 0; i < data.length; i++) { h ^= data[i]; h = Math.imul(h, 16777619) >>> 0; }
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) bytes[i] = (h = Math.imul(h ^ i, 16777619) >>> 0) & 0xff;
  return bytes;
}

function toHome(pathname: string): string { return "/en/"; }

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  // lascia passare l'handoff da Stripe
  if (pathname.startsWith("/api/portal-auth")) return NextResponse.next();

  // solo i path portal sono protetti
  const isPortal =
    pathname === "/portal" ||
    pathname === "/it/portal" ||
    pathname === "/en/portal" ||
    pathname === "/ar/portal";
  if (!isPortal) return NextResponse.next();

  const SECRET = deriveSecret();
  if (!SECRET) return NextResponse.redirect(new URL(toHome(pathname), req.url));

  // valida SOLO il token in query (?_t=...)
  const url = new URL(req.url);
  const token = url.searchParams.get("_t");
  if (!token) {
    return NextResponse.redirect(new URL(toHome(pathname), req.url));
  }
  try {
    await jwtVerify(token, SECRET, { algorithms: ["HS256"] });
    // token valido → lascia passare (non settiamo cookie, non riscriviamo URL qui)
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL(toHome(pathname), req.url));
  }
}

export const config = {
  matcher: ["/portal", "/it/portal", "/en/portal", "/ar/portal", "/api/portal-auth"],
};

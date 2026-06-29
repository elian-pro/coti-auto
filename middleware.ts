import { auth } from "@/auth";
import { NextResponse } from "next/server";

// Protege todo el dashboard. Si la sesión no existe (o si la sesión
// vino con error de refresh), mandamos al usuario a /login. Excepciones:
//   - /api/auth/*   (los endpoints de NextAuth: callback, signin, etc.)
//   - /api/health   (healthcheck que EasyPanel consulta sin sesión)
//   - /login        (la propia página de login)
//   - /_next, favicon, build assets (Next los excluye con el matcher)

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic =
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/health") ||
    pathname === "/health" ||
    pathname === "/login";

  if (isPublic) return NextResponse.next();
  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
});

// Aplica a todo excepto assets estáticos.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

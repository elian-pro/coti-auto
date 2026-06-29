import { auth } from "@/auth";
import { NextResponse } from "next/server";

// Protege todo el dashboard. Excepciones (rutas públicas):
//   - /api/auth/*   (los endpoints de NextAuth)
//   - /api/health   (healthcheck que EasyPanel consulta sin sesión)
//   - /health
//   - /login        (la propia página de login)
//
// Fail-closed: si auth() truena por env vars faltantes o cualquier otra
// razón, redirigimos a /login con un error en vez de dejar pasar el
// request. Nunca queremos que el dashboard quede expuesto por un mal
// arranque de NextAuth.

function isPublicPath(pathname: string): boolean {
  return (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/health") ||
    pathname === "/health" ||
    pathname === "/login"
  );
}

export default auth((req) => {
  try {
    const { pathname } = req.nextUrl;
    if (isPublicPath(pathname)) return NextResponse.next();

    if (!req.auth) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
  } catch (error) {
    console.error("[middleware] auth() falló, redirigiendo a /login:", error);
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("error", "Configuration");
    return NextResponse.redirect(loginUrl);
  }
});

export const config = {
  // Matchea todo excepto assets estáticos. Sí queremos que aplique al "/" raíz.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

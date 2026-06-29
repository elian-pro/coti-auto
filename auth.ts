import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

// NextAuth v5 (Auth.js). JWT-only sessions (sin DB), Google como único
// provider con scope de Drive read-only. El token del usuario queda
// embebido en la cookie firmada y lo usamos en el server para leer Docs
// privados sin tener que compartirlos con la cuenta de servicio.
//
// Token refresh: el access_token de Google dura ~1h. Cuando expira,
// pedimos uno nuevo con el refresh_token (Google solo lo manda en el
// PRIMER consent; por eso `access_type=offline` y `prompt=consent`).

const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/drive.readonly",
].join(" ");

// Dominio único permitido (configurable). Si vacío, no se restringe.
const ALLOWED_DOMAIN = (
  process.env.AUTH_ALLOWED_DOMAIN ?? "zebradigital.marketing"
)
  .toLowerCase()
  .trim();

// Sanity check de env vars críticas. Si faltan, el middleware fail-closed
// igual redirige a /login, pero esto ayuda a diagnosticarlo en los logs.
if (process.env.NODE_ENV === "production") {
  if (!process.env.AUTH_SECRET) {
    console.error(
      "[auth] FALTA AUTH_SECRET. NextAuth no puede firmar la cookie de sesión.",
    );
  }
  if (!process.env.AUTH_GOOGLE_ID || !process.env.AUTH_GOOGLE_SECRET) {
    console.error(
      "[auth] FALTAN AUTH_GOOGLE_ID o AUTH_GOOGLE_SECRET. El sign-in fallará.",
    );
  }
}

function isAllowedEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  if (!ALLOWED_DOMAIN) return true;
  return email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);
}

type RefreshTokenResult = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
};

async function refreshAccessToken(refreshToken: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID ?? "",
      client_secret: process.env.AUTH_GOOGLE_SECRET ?? "",
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  const data = (await response.json()) as RefreshTokenResult & { error?: string };
  if (!response.ok || data.error) {
    throw new Error(data.error ?? `refresh failed: ${response.status}`);
  }
  return data;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: {
          scope: GOOGLE_SCOPES,
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ profile, user }) {
      // Aceptamos solo correos del dominio permitido.
      const email = (profile?.email ?? user?.email)?.toLowerCase();
      if (isAllowedEmail(email)) return true;
      // false → NextAuth manda a la página de error con AccessDenied,
      // que /login intercepta para mostrar mensaje claro.
      return false;
    },
    async jwt({ token, account }) {
      if (account) {
        // Primer login: guardamos los tokens crudos
        return {
          ...token,
          access_token: account.access_token,
          refresh_token: account.refresh_token,
          expires_at: account.expires_at,
        };
      }
      const expiresAt = token.expires_at as number | undefined;
      if (!expiresAt || Date.now() < expiresAt * 1000 - 60_000) {
        // Aún válido (con buffer de 1 min)
        return token;
      }
      // Vencido: refrescar
      const refreshToken = token.refresh_token as string | undefined;
      if (!refreshToken) {
        return { ...token, error: "MissingRefreshToken" };
      }
      try {
        const refreshed = await refreshAccessToken(refreshToken);
        return {
          ...token,
          access_token: refreshed.access_token,
          expires_at: Math.floor(Date.now() / 1000 + refreshed.expires_in),
          refresh_token: refreshed.refresh_token ?? refreshToken,
          error: undefined,
        };
      } catch (error) {
        return {
          ...token,
          error: `RefreshFailed: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
    async session({ session, token }) {
      // Exponemos solo lo que el server necesita. El access_token NO se manda
      // al cliente (vive en la cookie cifrada de NextAuth), pero está
      // disponible en server actions y route handlers via `auth()`.
      return {
        ...session,
        access_token: token.access_token as string | undefined,
        error: token.error as string | undefined,
      };
    },
  },
  pages: {
    signIn: "/login",
    // Cualquier error de auth (incluido AccessDenied por dominio) se muestra
    // en /login, que lee el query param `error` para mostrar copy adecuado.
    error: "/login",
  },
});

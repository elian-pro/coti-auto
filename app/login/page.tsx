import { signIn } from "@/auth";
import { ZebraLogo } from "@/components/ZebraLogo";

export const dynamic = "force-dynamic";

const ALLOWED_DOMAIN = (
  process.env.AUTH_ALLOWED_DOMAIN ?? "zebradigital.marketing"
)
  .toLowerCase()
  .trim();

function errorCopy(code?: string): { title: string; body: string } | null {
  if (!code) return null;
  switch (code) {
    case "AccessDenied":
      return {
        title: "Acceso restringido",
        body: ALLOWED_DOMAIN
          ? `Este dashboard solo está disponible para cuentas @${ALLOWED_DOMAIN}. Entra con tu correo corporativo.`
          : "Tu cuenta no tiene permiso para entrar al dashboard.",
      };
    case "OAuthAccountNotLinked":
      return {
        title: "Cuenta ya vinculada",
        body: "Este correo ya está asociado a otra forma de inicio de sesión.",
      };
    case "Configuration":
      return {
        title: "Configuración",
        body: "Hay un problema con la configuración de OAuth. Avisa al admin.",
      };
    default:
      return {
        title: "No pudimos iniciar sesión",
        body: `Código: ${code}. Vuelve a intentar.`,
      };
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; error?: string }>;
}) {
  const params = await searchParams;
  const callbackUrl = params.from ?? "/";
  const errorMessage = errorCopy(params.error);

  async function doSignIn() {
    "use server";
    await signIn("google", { redirectTo: callbackUrl });
  }

  return (
    <div className="flex min-h-screen flex-col bg-white text-ink">
      <main className="flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center justify-center">
            <ZebraLogo className="h-6 w-auto text-ink" />
          </div>

          <div className="card p-8 sm:p-10">
            <p className="eyebrow mb-3">Coti Auto</p>
            <h1 className="text-h2 font-semibold text-ink">Inicia sesión</h1>
            <p className="mt-3 text-sm text-ink-500">
              Entra con tu cuenta de Google
              {ALLOWED_DOMAIN ? (
                <>
                  {" "}
                  <strong className="text-ink">@{ALLOWED_DOMAIN}</strong>
                </>
              ) : null}{" "}
              para que el dashboard pueda leer los Docs a los que ya tienes
              acceso, sin compartir cada uno manualmente.
            </p>

            {errorMessage ? (
              <div
                role="alert"
                className="mt-6 rounded-xl border border-ink-200 bg-ink-50 px-4 py-3"
              >
                <p className="eyebrow mb-1">{errorMessage.title}</p>
                <p className="text-sm text-ink">{errorMessage.body}</p>
              </div>
            ) : null}

            <form action={doSignIn} className="mt-8">
              <button type="submit" className="btn-primary w-full">
                <GoogleIcon />
                <span>Continuar con Google</span>
              </button>
            </form>

            <p className="mt-6 text-xs text-ink-500">
              Pedimos acceso de lectura a tus Google Docs (scope
              <code className="mx-1 rounded bg-ink-50 px-1 font-mono text-[11px]">
                drive.readonly
              </code>
              ) para descargar la transcripción de la junta. Nada se almacena
              fuera de tu sesión.
            </p>
          </div>
        </div>
      </main>

      <footer className="bg-ink py-6 text-white/70">
        <div className="container-x flex flex-col items-center justify-between gap-3 sm:flex-row">
          <div className="flex items-center gap-3 text-white">
            <ZebraLogo className="h-4 w-auto" />
            <span className="eyebrow !text-white/60">Coti Auto</span>
          </div>
          <span
            className="text-xs text-white/50"
            style={{ fontFamily: "var(--font-mono), ui-monospace, monospace" }}
          >
            build {process.env.NEXT_PUBLIC_BUILD_TAG ?? "dev"}
          </span>
        </div>
      </footer>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 18 18"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        fill="#FFFFFF"
        d="M16.51 8.18c0-.57-.05-1.12-.14-1.66H9v3.34h4.21a3.6 3.6 0 0 1-1.56 2.36v1.97h2.53c1.48-1.36 2.33-3.37 2.33-6.01z"
      />
      <path
        fill="#FFFFFF"
        d="M9 17c2.11 0 3.88-.7 5.18-1.9l-2.53-1.97c-.7.47-1.6.75-2.65.75-2.04 0-3.77-1.38-4.39-3.24H1.99v2.04A8 8 0 0 0 9 17z"
        opacity="0.85"
      />
      <path
        fill="#FFFFFF"
        d="M4.61 10.64a4.81 4.81 0 0 1 0-3.08V5.52H1.99a8 8 0 0 0 0 6.96l2.62-2.04z"
        opacity="0.7"
      />
      <path
        fill="#FFFFFF"
        d="M9 4.32c1.15 0 2.18.4 3 1.17l2.24-2.24A8 8 0 0 0 1.99 5.52L4.6 7.56C5.23 5.7 6.96 4.32 9 4.32z"
        opacity="0.55"
      />
    </svg>
  );
}

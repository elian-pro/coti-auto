import { auth, signOut } from "@/auth";
import { ZebraLogo } from "./ZebraLogo";

const LEGACY = process.env.NEXT_PUBLIC_DRIVE_FOLDER_URL;
const COTIZACIONES_URL =
  process.env.NEXT_PUBLIC_DRIVE_FOLDER_URL_COTIZACIONES ??
  LEGACY ??
  "https://drive.google.com/drive/folders/1d7Uj4dMx4USMNum-lkD_2w33OAeQgkCD";
const EVALUACIONES_URL =
  process.env.NEXT_PUBLIC_DRIVE_FOLDER_URL_EVALUACIONES ?? LEGACY ?? COTIZACIONES_URL;

export async function Header() {
  const session = await auth();
  const user = session?.user;

  async function doSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <header className="sticky top-0 z-30 border-b border-ink-200 bg-white/85 backdrop-blur-md">
      <div className="container-x flex h-16 items-center justify-between gap-3 md:h-20">
        <div className="flex items-center gap-4">
          <ZebraLogo className="h-5 w-auto text-ink md:h-6" />
          <span className="hidden h-5 w-px bg-ink-200 sm:block" aria-hidden />
          <span className="eyebrow hidden sm:inline">Coti Auto</span>
        </div>

        <nav className="flex items-center gap-2 sm:gap-3">
          <FolderButton href={COTIZACIONES_URL} full="Cotizaciones" short="Cotis" />
          <FolderButton href={EVALUACIONES_URL} full="Diagnósticos" short="Diag" />

          {user ? (
            <form action={doSignOut}>
              <button
                type="submit"
                className="flex items-center gap-2 rounded-full border border-ink-200 bg-white px-3 py-2 text-xs text-ink transition hover:border-ink"
                style={{ transitionTimingFunction: "cubic-bezier(.16,1,.3,1)" }}
                aria-label={`Cerrar sesión (${user.email ?? ""})`}
              >
                <Avatar src={user.image ?? null} alt={user.name ?? "Usuario"} />
                <span className="hidden max-w-[12ch] truncate text-ink-500 sm:inline">
                  {user.email ?? user.name}
                </span>
                <SignOutIcon />
              </button>
            </form>
          ) : null}
        </nav>
      </div>
    </header>
  );
}

function FolderButton({
  href,
  full,
  short,
}: {
  href: string;
  full: string;
  short: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="btn-ghost px-3 py-2 text-xs md:px-5 md:py-3 md:text-sm"
    >
      <FolderIcon />
      <span className="hidden sm:inline">{full}</span>
      <span className="sm:hidden">{short}</span>
      <ArrowUpRight />
    </a>
  );
}

function Avatar({ src, alt }: { src: string | null; alt: string }) {
  if (src) {
    // Evitamos <Image> para no tener que configurar dominios remotos.
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={alt}
        width={20}
        height={20}
        className="h-5 w-5 rounded-full border border-ink-200 object-cover"
      />
    );
  }
  return (
    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ink text-[10px] font-semibold text-white">
      {alt.charAt(0).toUpperCase()}
    </span>
  );
}

function FolderIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

function ArrowUpRight() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7 17 17 7" />
      <path d="M7 7h10v10" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

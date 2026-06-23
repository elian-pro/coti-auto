import { ZebraLogo } from "./ZebraLogo";

const LEGACY = process.env.NEXT_PUBLIC_DRIVE_FOLDER_URL;
const COTIZACIONES_URL =
  process.env.NEXT_PUBLIC_DRIVE_FOLDER_URL_COTIZACIONES ??
  LEGACY ??
  "https://drive.google.com/drive/folders/1d7Uj4dMx4USMNum-lkD_2w33OAeQgkCD";
const EVALUACIONES_URL =
  process.env.NEXT_PUBLIC_DRIVE_FOLDER_URL_EVALUACIONES ?? LEGACY ?? COTIZACIONES_URL;

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-ink-200 bg-white/85 backdrop-blur-md">
      <div className="container-x flex h-16 items-center justify-between gap-3 md:h-20">
        <div className="flex items-center gap-4">
          <ZebraLogo className="h-5 w-auto text-ink md:h-6" />
          <span className="hidden h-5 w-px bg-ink-200 sm:block" aria-hidden />
          <span className="eyebrow hidden sm:inline">Coti Auto</span>
        </div>

        <nav className="flex items-center gap-2 sm:gap-3">
          <FolderButton
            href={COTIZACIONES_URL}
            full="Cotizaciones"
            short="Cotis"
          />
          <FolderButton
            href={EVALUACIONES_URL}
            full="Diagnósticos"
            short="Diag"
          />
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

import { ZebraLogo } from "./ZebraLogo";

const DRIVE_FOLDER_URL =
  process.env.NEXT_PUBLIC_DRIVE_FOLDER_URL ??
  "https://drive.google.com/drive/folders/1d7Uj4dMx4USMNum-lkD_2w33OAeQgkCD";

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-ink-200 bg-white/85 backdrop-blur-md">
      <div className="container-x flex h-16 items-center justify-between gap-3 md:h-20">
        <div className="flex items-center gap-4">
          <ZebraLogo className="h-5 w-auto text-ink md:h-6" />
          <span className="hidden h-5 w-px bg-ink-200 sm:block" aria-hidden />
          <span className="eyebrow hidden sm:inline">Coti Auto</span>
        </div>

        <a
          href={DRIVE_FOLDER_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="btn-ghost px-4 py-2 text-xs md:px-6 md:py-3 md:text-sm"
        >
          <span className="hidden sm:inline">Carpeta de cotizaciones</span>
          <span className="sm:hidden">Carpeta</span>
          <ArrowUpRight />
        </a>
      </div>
    </header>
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

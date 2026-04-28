const DRIVE_FOLDER_URL =
  process.env.NEXT_PUBLIC_DRIVE_FOLDER_URL ??
  "https://drive.google.com/drive/folders/1d7Uj4dMx4USMNum-lkD_2w33OAeQgkCD";

export function Header() {
  return (
    <header className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 rounded-full bg-bone px-5 py-3 text-ink sm:px-7 sm:py-4">
        <span className="font-display text-base font-bold tracking-brand sm:text-lg">
          ZEBRA
        </span>
        <span className="h-5 w-px bg-ink/20" aria-hidden />
        <span className="text-xs font-medium uppercase tracking-[0.3em] text-ink/70 sm:text-sm">
          Coti Auto
        </span>
      </div>

      <a
        href={DRIVE_FOLDER_URL}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex items-center gap-2 rounded-full border border-bone/30 px-4 py-3 text-xs font-medium uppercase tracking-[0.25em] text-bone transition hover:border-bone hover:bg-bone hover:text-ink sm:px-6 sm:py-4"
      >
        <span className="hidden sm:inline">Carpeta de cotizaciones</span>
        <span className="sm:hidden">Carpeta</span>
        <span aria-hidden>↗</span>
      </a>
    </header>
  );
}

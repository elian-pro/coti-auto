export function Header() {
  return (
    <header className="mx-auto w-full">
      <div className="flex items-center justify-between rounded-full bg-bone px-5 py-3 text-ink sm:px-7 sm:py-4">
        <span className="font-display text-base font-bold tracking-brand sm:text-lg">
          ZEBRA
        </span>
        <span className="h-5 w-px bg-ink/20" aria-hidden />
        <span className="text-xs font-medium uppercase tracking-[0.3em] text-ink/70 sm:text-sm">
          Coti Auto
        </span>
      </div>
    </header>
  );
}

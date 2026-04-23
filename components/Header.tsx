export function Header() {
  return (
    <header className="mb-10 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-ink">
          <div className="h-6 w-6 zebra-bar" aria-hidden />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-ink/60">Coti Auto</p>
          <h1 className="font-display text-2xl leading-none text-ink">
            Zebra Dashboard
          </h1>
        </div>
      </div>
      <span className="hidden rounded-full border border-ink px-3 py-1 text-xs uppercase tracking-widest text-ink sm:inline">
        Cotizaciones automáticas
      </span>
    </header>
  );
}

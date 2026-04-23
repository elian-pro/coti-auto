import type { QuoteResult } from "@/lib/types";

export function ResultCard({
  account,
  result,
  onReset,
}: {
  account: string;
  result: QuoteResult;
  onReset: () => void;
}) {
  const driveUrl = result.drive_url;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-10 py-16 text-center">
      <p className="text-xs uppercase tracking-[0.4em] text-bone/60">Cotización lista</p>
      <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
        {account}
      </h2>

      {driveUrl ? (
        <a
          href={driveUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="group inline-flex items-center justify-center gap-3 rounded-full bg-bone px-8 py-4 text-sm font-semibold uppercase tracking-[0.25em] text-ink transition hover:bg-bone/90"
        >
          <span>Abrir en Drive</span>
          <span aria-hidden className="transition group-hover:translate-x-1">
            →
          </span>
        </a>
      ) : (
        <div className="border border-bone/30 px-4 py-3 text-sm text-bone/70">
          El webhook respondió, pero sin enlace de Drive. Revisa el último nodo del flujo en n8n.
        </div>
      )}

      {driveUrl ? (
        <p className="break-all text-xs text-bone/40">{driveUrl}</p>
      ) : null}

      <button
        type="button"
        onClick={onReset}
        className="text-xs uppercase tracking-[0.3em] text-bone/60 underline-offset-4 transition hover:text-bone hover:underline"
      >
        Nueva cotización
      </button>
    </div>
  );
}

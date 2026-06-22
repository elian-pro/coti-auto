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
    <div className="card p-8 sm:p-10">
      <div className="mb-8">
        <p className="eyebrow mb-3">Cotización lista</p>
        <h2 className="text-h2 font-semibold text-ink">{account}</h2>
        {driveUrl ? (
          <p className="mt-3 text-sm text-ink-500">
            El documento se generó en Drive. Ábrelo para revisar o compartir.
          </p>
        ) : (
          <p className="mt-3 text-sm text-ink-500">
            El webhook respondió, pero sin un enlace de Drive. Revisa el último nodo del
            flujo en n8n.
          </p>
        )}
      </div>

      <div className="space-y-4">
        {driveUrl ? (
          <a
            href={driveUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="btn-primary w-full"
          >
            <span>Abrir en Drive</span>
            <ArrowUpRight />
          </a>
        ) : null}

        {driveUrl ? (
          <p className="break-all text-xs text-ink-500">
            <span className="eyebrow mr-2 inline-block align-middle">Url</span>
            {driveUrl}
          </p>
        ) : null}

        <div className="flex items-center justify-between border-t border-ink-200 pt-6">
          <span className="eyebrow">¿Otra cotización?</span>
          <button type="button" onClick={onReset} className="btn-ghost text-sm">
            Nueva cotización
          </button>
        </div>
      </div>
    </div>
  );
}

function ArrowUpRight() {
  return (
    <svg
      width="16"
      height="16"
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

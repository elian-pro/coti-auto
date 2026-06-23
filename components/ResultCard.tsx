import type { QuoteResult } from "@/lib/types";

const VERDICT_LABEL: Record<NonNullable<QuoteResult["evaluation_verdict"]>, string> = {
  no_cotizar: "No cotizar",
  llenar_gaps: "Llenar gaps",
  cotizar: "Cotizar",
  excelente: "Excelente",
};

export function ResultCard({
  account,
  result,
  onReset,
}: {
  account: string;
  result: QuoteResult;
  onReset: () => void;
}) {
  const { docs_url, sheets_url, pdf_url, evaluation_url } = result;
  const hasFiles = Boolean(docs_url || sheets_url || pdf_url || evaluation_url);
  const isPreliminar = Boolean(
    result.razon || (result.preguntas_criticas && result.preguntas_criticas.length),
  );

  // CASO 1: Claude devolvió diagnostico_preliminar (datos insuficientes)
  if (!hasFiles && isPreliminar) {
    return (
      <div className="card p-8 sm:p-10">
        <div className="mb-6">
          <p className="eyebrow mb-3">Datos insuficientes</p>
          <h2 className="text-h2 font-semibold text-ink">{account}</h2>
          <p className="mt-3 text-sm text-ink-500">
            La transcripción no tenía información mínima para construir una propuesta
            sólida. Antes de cotizar conviene volver a hablar con el prospecto.
          </p>
        </div>

        {result.razon ? (
          <section className="mb-6">
            <p className="eyebrow mb-2">Por qué</p>
            <p className="text-sm text-ink">{result.razon}</p>
          </section>
        ) : null}

        {result.preguntas_criticas && result.preguntas_criticas.length > 0 ? (
          <section className="mb-6">
            <p className="eyebrow mb-2">Preguntas críticas pendientes</p>
            <ul className="space-y-2 text-sm text-ink">
              {result.preguntas_criticas.map((q, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-ink-400">·</span>
                  <span>{q}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {result.lo_que_si_entendimos ? (
          <section className="mb-6">
            <p className="eyebrow mb-2">Lo que sí entendimos</p>
            <p className="text-sm text-ink-500">{result.lo_que_si_entendimos}</p>
          </section>
        ) : null}

        <div className="mt-8 flex items-center justify-between border-t border-ink-200 pt-6">
          <span className="eyebrow">Recontactar antes de cotizar</span>
          <button type="button" onClick={onReset} className="btn-ghost text-sm">
            Nueva cotización
          </button>
        </div>
      </div>
    );
  }

  // CASO 2: éxito (con uno o más archivos)
  return (
    <div className="card p-8 sm:p-10">
      <div className="mb-8">
        <p className="eyebrow mb-3">Cotización lista</p>
        <h2 className="text-h2 font-semibold text-ink">{account}</h2>
        {hasFiles ? (
          <p className="mt-3 text-sm text-ink-500">
            Los documentos se generaron en Drive. Ábrelos para revisar, editar o compartir.
          </p>
        ) : (
          <p className="mt-3 text-sm text-ink-500">
            El proceso respondió, pero sin enlaces. Revisa los logs del contenedor para ver
            si falló la subida a Drive o si Claude regresó algo inesperado.
          </p>
        )}
      </div>

      {result.evaluation_status === "ok" && result.evaluation_score !== undefined ? (
        <div className="mb-6 flex items-center justify-between rounded-xl border border-ink-200 bg-ink-50 px-4 py-3">
          <span className="eyebrow">Diagnóstico</span>
          <span className="text-sm text-ink">
            <span
              className="font-semibold tabular-nums"
              style={{ fontFamily: "var(--font-mono), ui-monospace, monospace" }}
            >
              {result.evaluation_score}/100
            </span>
            {result.evaluation_verdict ? (
              <span className="ml-3 text-ink-500">
                · {VERDICT_LABEL[result.evaluation_verdict]}
              </span>
            ) : null}
          </span>
        </div>
      ) : null}

      {result.evaluation_status === "no_aplicable" ? (
        <div className="mb-6 rounded-xl border border-ink-200 bg-ink-50 px-4 py-3">
          <p className="eyebrow mb-1">Diagnóstico no se generó</p>
          <p className="text-sm text-ink-500">
            {result.evaluation_error ?? "Claude no devolvió un JSON evaluable."}
          </p>
        </div>
      ) : null}

      {hasFiles ? (
        <div className="space-y-3">
          {docs_url ? (
            <a
              href={docs_url}
              target="_blank"
              rel="noreferrer noopener"
              className="btn-primary w-full"
            >
              <DocIcon />
              <span>Abrir cotización</span>
              <ArrowUpRight />
            </a>
          ) : null}

          {evaluation_url ? (
            <a
              href={evaluation_url}
              target="_blank"
              rel="noreferrer noopener"
              className="btn-ghost w-full"
            >
              <ChartIcon />
              <span>Abrir diagnóstico</span>
              <ArrowUpRight />
            </a>
          ) : null}

          {sheets_url ? (
            <a
              href={sheets_url}
              target="_blank"
              rel="noreferrer noopener"
              className="btn-ghost w-full"
            >
              <SheetIcon />
              <span>Abrir calculadora</span>
              <ArrowUpRight />
            </a>
          ) : null}

          {pdf_url ? (
            <a
              href={pdf_url}
              target="_blank"
              rel="noreferrer noopener"
              className="flex items-center justify-center gap-2 pt-2 text-xs text-ink-500 underline-offset-4 transition hover:text-ink hover:underline"
            >
              <span className="eyebrow">PDF</span>
              <span>Descargar cotización en PDF</span>
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="mt-8 flex items-center justify-between border-t border-ink-200 pt-6">
        <span className="eyebrow">¿Otra cotización?</span>
        <button type="button" onClick={onReset} className="btn-ghost text-sm">
          Nueva cotización
        </button>
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

function DocIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6" />
      <path d="M8 13h8" />
      <path d="M8 17h6" />
    </svg>
  );
}

function SheetIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
      <path d="M3 15h18" />
      <path d="M9 3v18" />
      <path d="M15 3v18" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 3v18h18" />
      <path d="M7 14l4-4 4 4 5-6" />
    </svg>
  );
}

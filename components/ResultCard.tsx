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
  const { pdf_url, docs_url } = result;

  return (
    <div className="flex flex-1 flex-col items-center justify-center py-12">
      <div className="w-full max-w-2xl rounded-2xl border-2 border-ink bg-bone card-shadow">
        <div className="h-3 zebra-bar rounded-t-2xl" aria-hidden />
        <div className="p-8 sm:p-10">
          <p className="text-xs uppercase tracking-[0.4em] text-ink/60">Cotización lista</p>
          <h2 className="mt-2 font-display text-3xl text-ink sm:text-4xl">{account}</h2>
          <p className="mt-3 text-sm text-ink/70">
            Recibimos la respuesta del flujo n8n. Usa los enlaces para abrir el documento editable
            o descargar el PDF final.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <LinkTile
              disabled={!docs_url}
              href={docs_url}
              label="Abrir Google Docs"
              caption="Editable"
              variant="outline"
            />
            <LinkTile
              disabled={!pdf_url}
              href={pdf_url}
              label="Descargar PDF"
              caption="Versión final"
              variant="solid"
              download
            />
          </div>

          {!pdf_url && !docs_url ? (
            <p className="mt-6 rounded-md border border-ink/30 bg-ink/5 p-3 text-sm text-ink/70">
              El webhook respondió, pero sin <code>pdf_url</code> ni <code>docs_url</code>.
              Revisa el nodo final de n8n para confirmar el formato de la respuesta.
            </p>
          ) : null}

          <div className="mt-10 flex items-center justify-between border-t border-ink/20 pt-6">
            <span className="text-xs uppercase tracking-widest text-ink/60">
              ¿Necesitas otra cotización?
            </span>
            <button
              type="button"
              onClick={onReset}
              className="rounded-full border-2 border-ink bg-ink px-5 py-2 text-sm font-semibold uppercase tracking-widest text-bone transition hover:bg-bone hover:text-ink"
            >
              Nueva cotización
            </button>
          </div>
        </div>
        <div className="h-3 zebra-bar rounded-b-2xl" aria-hidden />
      </div>
    </div>
  );
}

function LinkTile({
  href,
  label,
  caption,
  variant,
  disabled,
  download,
}: {
  href?: string;
  label: string;
  caption: string;
  variant: "solid" | "outline";
  disabled?: boolean;
  download?: boolean;
}) {
  const base =
    "group flex flex-col gap-1 rounded-xl border-2 border-ink p-5 transition focus:outline-none focus:ring-2 focus:ring-ink focus:ring-offset-2 focus:ring-offset-bone";
  const solid = "bg-ink text-bone hover:bg-bone hover:text-ink";
  const outline = "bg-bone text-ink hover:bg-ink hover:text-bone";
  const disabledCls = "cursor-not-allowed opacity-50 hover:bg-transparent hover:text-ink";

  if (disabled || !href) {
    return (
      <div className={`${base} ${variant === "solid" ? "bg-ink text-bone" : "bg-bone text-ink"} ${disabledCls}`}>
        <span className="text-xs uppercase tracking-widest opacity-70">{caption}</span>
        <span className="font-display text-xl">{label}</span>
        <span className="mt-2 text-xs opacity-60">No disponible</span>
      </div>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      download={download}
      className={`${base} ${variant === "solid" ? solid : outline}`}
    >
      <span className="text-xs uppercase tracking-widest opacity-70">{caption}</span>
      <span className="font-display text-xl">{label}</span>
      <span className="mt-2 text-xs opacity-70 group-hover:opacity-100">
        {href.length > 48 ? `${href.slice(0, 45)}…` : href}
      </span>
    </a>
  );
}

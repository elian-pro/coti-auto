import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { isDbEnabled } from "@/lib/db/client";
import { listRecentQuotes } from "@/lib/db/quotes";
import { generateOrGetInsights } from "@/lib/insights";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const VERDICT_LABEL: Record<string, string> = {
  no_cotizar: "No cotizar",
  llenar_gaps: "Llenar gaps",
  cotizar: "Cotizar",
  excelente: "Excelente",
};

function formatDate(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("es-MX", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export default async function EstusPage() {
  if (!isDbEnabled()) {
    return (
      <div className="flex min-h-screen flex-col bg-white text-ink">
        <Header />
        <main className="flex-1">
          <section className="container-x py-16 md:py-24">
            <div className="mx-auto max-w-2xl">
              <p className="eyebrow mb-3">Estus</p>
              <h1 className="text-h1 font-semibold text-ink">Persistencia no configurada</h1>
              <p className="mt-4 text-base text-ink-500">
                Estus necesita una base de datos Postgres para almacenar las
                transcripciones y correr el coach. Configura la env var{" "}
                <code className="rounded bg-ink-50 px-1 font-mono text-sm">DATABASE_URL</code>{" "}
                en EasyPanel apuntando a tu Postgres y redeploya. El dashboard sigue
                funcionando normalmente sin esto — solo pierde la vista agregada.
              </p>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  // Corren en paralelo: el listado + el coach (con su cache interno).
  const [recent, insights] = await Promise.all([
    listRecentQuotes(50),
    generateOrGetInsights(),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-white text-ink">
      <Header />

      <main className="flex-1">
        <section className="relative overflow-hidden">
          <span className="zebra-motif" aria-hidden />
          <div className="container-x relative z-10 py-16 md:py-24">
            <div className="mx-auto max-w-3xl">
              <p className="eyebrow mb-5">Estus</p>
              <h1 className="text-h1 font-semibold text-ink">
                Coach del equipo comercial
              </h1>
              <p className="mt-5 max-w-xl text-base text-ink-500 md:text-[15px]">
                Objeciones y patrones que se repiten en las últimas llamadas, con
                sugerencias para abordarlas. Sale de las transcripciones que ya se
                cotizaron o diagnosticaron.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-ink-50 py-16 md:py-24">
          <div className="container-x">
            <div className="mx-auto max-w-4xl space-y-8">
              {"error" in insights ? (
                <div className="card p-8 sm:p-10">
                  <p className="eyebrow mb-3">Coach no disponible</p>
                  <p className="text-sm text-ink-500">{insights.error}</p>
                </div>
              ) : (
                <>
                  <div className="card p-8 sm:p-10">
                    <div className="mb-6 flex flex-wrap items-baseline justify-between gap-4">
                      <div>
                        <p className="eyebrow mb-3">Síntesis</p>
                        <h2 className="text-h2 font-semibold text-ink">
                          Últimas {insights.nTranscripts}{" "}
                          {insights.nTranscripts === 1 ? "llamada" : "llamadas"}
                        </h2>
                        <p className="mt-2 text-xs text-ink-500">
                          {formatDate(insights.windowFrom)} a{" "}
                          {formatDate(insights.windowTo)}
                          {insights.nTranscripts < insights.sampleSize
                            ? ` · el coach analiza hasta ${insights.sampleSize}`
                            : ""}
                        </p>
                      </div>
                      <span className="text-xs text-ink-500">
                        {insights.fromCache
                          ? `Cache generado ${formatDate(insights.generatedAt)}`
                          : "Recién generado"}
                      </span>
                    </div>
                    <p className="text-base text-ink">
                      {insights.content.sintesis || "Sin síntesis disponible."}
                    </p>
                  </div>

                  {insights.content.objeciones.length > 0 ? (
                    <div className="card p-8 sm:p-10">
                      <p className="eyebrow mb-3">Objeciones recurrentes</p>
                      <h2 className="text-h2 font-semibold text-ink">
                        Cómo abordarlas
                      </h2>
                      <ul className="mt-6 space-y-6">
                        {insights.content.objeciones.map((o, i) => (
                          <li
                            key={i}
                            className="border-t border-ink-200 pt-6 first:border-t-0 first:pt-0"
                          >
                            <div className="flex items-baseline justify-between gap-3">
                              <h3 className="text-base font-semibold text-ink">
                                {o.objecion}
                              </h3>
                              <span
                                className="text-xs text-ink-500 tabular-nums"
                                style={{
                                  fontFamily:
                                    "var(--font-mono), ui-monospace, monospace",
                                }}
                              >
                                {o.frecuencia}× · ranking #{i + 1}
                              </span>
                            </div>
                            {o.ejemplos.length > 0 ? (
                              <ul className="mt-3 space-y-1 pl-4 text-sm text-ink-500">
                                {o.ejemplos.map((e, j) => (
                                  <li key={j} className="italic before:mr-2 before:content-['·']">
                                    {e}
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                            <p className="mt-3 text-sm text-ink">
                              <span className="eyebrow mr-2 inline-block align-middle">
                                Cómo
                              </span>
                              {o.como_abordarla}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {insights.content.patrones.length > 0 ? (
                    <div className="card p-8 sm:p-10">
                      <p className="eyebrow mb-3">Patrones</p>
                      <h2 className="text-h2 font-semibold text-ink">
                        Lo que se está repitiendo
                      </h2>
                      <div className="mt-6 grid gap-4 sm:grid-cols-2">
                        {insights.content.patrones.map((p, i) => (
                          <div
                            key={i}
                            className="rounded-xl border border-ink-200 bg-white p-5"
                          >
                            <h3 className="text-sm font-semibold text-ink">
                              {p.titulo}
                            </h3>
                            <p className="mt-2 text-sm text-ink-500">
                              {p.descripcion}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {insights.content.coaching.length > 0 ? (
                    <div className="card p-8 sm:p-10">
                      <p className="eyebrow mb-3">Coaching accionable</p>
                      <h2 className="text-h2 font-semibold text-ink">
                        Tips para el próximo diagnóstico
                      </h2>
                      <ul className="mt-6 space-y-3 text-sm text-ink">
                        {insights.content.coaching.map((tip, i) => (
                          <li key={i} className="flex gap-3">
                            <span
                              className="mt-0.5 text-ink-500 tabular-nums"
                              style={{
                                fontFamily:
                                  "var(--font-mono), ui-monospace, monospace",
                              }}
                            >
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              )}

              <div className="card p-8 sm:p-10">
                <p className="eyebrow mb-3">Historial</p>
                <h2 className="text-h2 font-semibold text-ink">
                  Últimas {recent.length} cotizaciones
                </h2>

                {recent.length === 0 ? (
                  <p className="mt-4 text-sm text-ink-500">
                    Sin runs registrados todavía.
                  </p>
                ) : (
                  <div className="mt-6 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-ink-200 text-left">
                          <th className="pb-3 pr-4 eyebrow font-medium">Fecha</th>
                          <th className="pb-3 pr-4 eyebrow font-medium">Cuenta</th>
                          <th className="pb-3 pr-4 eyebrow font-medium">Modo</th>
                          <th className="pb-3 pr-4 eyebrow font-medium">Score</th>
                          <th className="pb-3 pr-4 eyebrow font-medium">Veredicto</th>
                          <th className="pb-3 eyebrow font-medium">Archivos</th>
                        </tr>
                      </thead>
                      <tbody className="text-ink">
                        {recent.map((r) => (
                          <tr key={r.id} className="border-b border-ink-200/60">
                            <td
                              className="py-3 pr-4 text-ink-500"
                              style={{
                                fontFamily:
                                  "var(--font-mono), ui-monospace, monospace",
                              }}
                            >
                              {formatDate(r.createdAt)}
                            </td>
                            <td className="py-3 pr-4 font-medium">{r.account}</td>
                            <td className="py-3 pr-4 text-ink-500 text-xs uppercase tracking-widest">
                              {r.mode.replace("_", " ")}
                            </td>
                            <td
                              className="py-3 pr-4 tabular-nums"
                              style={{
                                fontFamily:
                                  "var(--font-mono), ui-monospace, monospace",
                              }}
                            >
                              {r.evaluationScore ?? "—"}
                            </td>
                            <td className="py-3 pr-4 text-ink-500">
                              {r.evaluationVerdict
                                ? VERDICT_LABEL[r.evaluationVerdict] ??
                                  r.evaluationVerdict
                                : "—"}
                            </td>
                            <td className="py-3">
                              <span className="flex gap-2 text-xs">
                                {r.docsUrl ? (
                                  <a
                                    href={r.docsUrl}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    className="text-ink underline underline-offset-2 hover:opacity-70"
                                  >
                                    doc
                                  </a>
                                ) : null}
                                {r.sheetsUrl ? (
                                  <a
                                    href={r.sheetsUrl}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    className="text-ink underline underline-offset-2 hover:opacity-70"
                                  >
                                    sheet
                                  </a>
                                ) : null}
                                {r.evaluationUrl ? (
                                  <a
                                    href={r.evaluationUrl}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    className="text-ink underline underline-offset-2 hover:opacity-70"
                                  >
                                    diag
                                  </a>
                                ) : null}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

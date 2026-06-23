"use client";

import { useEffect, useState } from "react";
import type { QuoteMode } from "@/lib/types";

const TOTAL_MS_BY_MODE: Record<QuoteMode, number> = {
  full:       135_000, // 2:15  (ambos en paralelo)
  quote_only:  90_000, // 1:30
  eval_only:   90_000, // 1:30
};

const ACTION_BY_MODE: Record<QuoteMode, string> = {
  full:       "Generando cotización + diagnóstico",
  quote_only: "Generando cotización",
  eval_only:  "Generando diagnóstico",
};

const COPY_BY_MODE: Record<QuoteMode, string> = {
  full:
    "Estamos llamando a Claude para construir la propuesta y, en paralelo, " +
    "auditando la llamada con el evaluador v2.3.",
  quote_only:
    "Estamos analizando la transcripción y armando la propuesta DOCX " +
    "(y la calculadora 12 meses si aplica).",
  eval_only:
    "Estamos auditando la llamada con el evaluador v2.3 y armando el " +
    "PDF de diagnóstico con scoring y plan de mejora.",
};

const TICK_MS = 250;

function format(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function LoadingScreen({
  account,
  mode = "full",
}: {
  account: string;
  mode?: QuoteMode;
}) {
  const totalMs = TOTAL_MS_BY_MODE[mode];
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const id = window.setInterval(() => {
      setElapsed(Date.now() - start);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const progress = Math.min(elapsed / totalMs, 0.97);
  const remainingMs = Math.max(totalMs - elapsed, 0);

  return (
    <div className="card p-8 sm:p-10">
      <div className="mb-8">
        <p className="eyebrow mb-3">{ACTION_BY_MODE[mode]}</p>
        <h2 className="text-h2 font-semibold text-ink">
          {account || "Cuenta sin nombre"}
        </h2>
        <p className="mt-3 text-sm text-ink-500">
          El proceso dura aproximadamente{" "}
          <strong className="font-semibold text-ink">{format(totalMs / 1000)}</strong>
          . {COPY_BY_MODE[mode]}
          {remainingMs === 0 ? " Casi listo…" : ""}
        </p>
      </div>

      <div className="space-y-3">
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
          <div
            className="h-full rounded-full bg-ink transition-[width] duration-200 ease-linear"
            style={{ width: `${progress * 100}%` }}
            aria-hidden
          />
        </div>
        <div
          className="flex items-center justify-between text-xs text-ink-500"
          style={{ fontFamily: "var(--font-mono), ui-monospace, monospace" }}
        >
          <span className="font-medium tabular-nums">{format(elapsed / 1000)}</span>
          <span className="font-medium tabular-nums">
            {Math.round(progress * 100)}%
          </span>
          <span className="font-medium tabular-nums">{format(totalMs / 1000)}</span>
        </div>
      </div>
    </div>
  );
}

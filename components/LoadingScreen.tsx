"use client";

import { useEffect, useState } from "react";

const TOTAL_MS = 135_000; // 2:15
const TICK_MS = 250;

function format(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function LoadingScreen({ account }: { account: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const id = window.setInterval(() => {
      setElapsed(Date.now() - start);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const progress = Math.min(elapsed / TOTAL_MS, 0.97);
  const remainingMs = Math.max(TOTAL_MS - elapsed, 0);

  return (
    <div className="card p-8 sm:p-10">
      <div className="mb-8">
        <p className="eyebrow mb-3">Generando cotización</p>
        <h2 className="text-h2 font-semibold text-ink">
          {account || "Cuenta sin nombre"}
        </h2>
        <p className="mt-3 text-sm text-ink-500">
          El proceso completo dura aproximadamente{" "}
          <strong className="font-semibold text-ink">2 minutos 15 segundos</strong>.
          Estamos transcribiendo la junta, analizando el contenido y armando el documento
          en Drive.
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
          <span className="font-medium tabular-nums">02:15</span>
        </div>
      </div>
    </div>
  );
}

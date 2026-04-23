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

  // Cap at 97% so it doesn't pretend to be done before the webhook responds.
  const progress = Math.min(elapsed / TOTAL_MS, 0.97);
  const remainingMs = Math.max(TOTAL_MS - elapsed, 0);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-10 py-16 text-center">
      <p className="text-xs uppercase tracking-[0.4em] text-bone/60">Generando cotización</p>
      <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
        {account || "Cuenta sin nombre"}
      </h2>

      <div className="w-full">
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-bone/15">
          <div
            className="h-full rounded-full bg-bone transition-[width] duration-200 ease-linear"
            style={{ width: `${progress * 100}%` }}
            aria-hidden
          />
        </div>
        <div className="mt-3 flex items-center justify-between text-xs uppercase tracking-[0.25em] text-bone/60">
          <span>{format(elapsed / 1000)}</span>
          <span>{Math.round(progress * 100)}%</span>
          <span>02:15</span>
        </div>
      </div>

      <p className="max-w-md text-sm text-bone/60">
        El proceso completo dura aproximadamente <strong className="text-bone">2 minutos 15 segundos</strong>.
        Estamos transcribiendo la junta, analizando el contenido y armando el documento en Drive.
        {remainingMs === 0 ? " Casi listo…" : ""}
      </p>
    </div>
  );
}

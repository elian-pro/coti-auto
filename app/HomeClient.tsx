"use client";

import { useState } from "react";
import { LoadingScreen } from "@/components/LoadingScreen";
import { QuoteForm } from "@/components/QuoteForm";
import { ResultCard } from "@/components/ResultCard";
import type { QuoteMode, QuoteResult } from "@/lib/types";

type Status = "idle" | "loading" | "done";

export default function HomeClient() {
  const [status, setStatus] = useState<Status>("idle");
  const [account, setAccount] = useState("");
  const [mode, setMode] = useState<QuoteMode>("full");
  const [result, setResult] = useState<QuoteResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

  async function handleSubmit({
    account: accountValue,
    meeting_url,
    mode: modeValue,
  }: {
    account: string;
    meeting_url: string;
    mode: QuoteMode;
  }) {
    setAccount(accountValue);
    setMode(modeValue);
    setErrorMessage(undefined);
    setStatus("loading");

    try {
      const response = await fetch("/api/quote-direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account: accountValue,
          meeting_url,
          mode: modeValue,
        }),
      });

      const contentType = response.headers.get("content-type") ?? "";
      const payload = contentType.includes("application/json")
        ? await response.json()
        : { raw: await response.text() };

      if (!response.ok) {
        throw new Error(payload?.error ?? `Error ${response.status}`);
      }

      setResult(payload as QuoteResult);
      setStatus("done");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No pudimos generar la cotización.";
      setErrorMessage(message);
      setStatus("idle");
    }
  }

  function handleReset() {
    setStatus("idle");
    setResult(null);
    setAccount("");
    setErrorMessage(undefined);
  }

  return (
    <main className="flex-1">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <span className="zebra-motif" aria-hidden />
        <div className="container-x relative z-10 py-16 md:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="eyebrow mb-5">Cotizaciones automáticas</p>
            <h1 className="text-h1 font-semibold text-ink">
              De la junta de Drive al documento listo.
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base text-ink-500 md:text-[15px]">
              Pega la liga de la junta y el nombre de la cuenta. En aproximadamente
              2 minutos tienes el documento generado en Drive y disponible en la carpeta
              compartida.
            </p>
          </div>
        </div>
      </section>

      {/* Form / Loading / Result section, recessed surface */}
      <section className="bg-ink-50 py-16 md:py-24">
        <div className="container-x">
          <div className="mx-auto max-w-2xl">
            {status === "idle" ? (
              <QuoteForm
                onSubmit={handleSubmit}
                isSubmitting={false}
                errorMessage={errorMessage}
              />
            ) : null}

            {status === "loading" ? (
              <LoadingScreen account={account} mode={mode} />
            ) : null}

            {status === "done" && result ? (
              <ResultCard account={account} result={result} onReset={handleReset} />
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}

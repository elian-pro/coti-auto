"use client";

import { useState } from "react";
import { Header } from "@/components/Header";
import { LoadingScreen } from "@/components/LoadingScreen";
import { QuoteForm } from "@/components/QuoteForm";
import { ResultCard } from "@/components/ResultCard";
import { ZebraFrame } from "@/components/ZebraFrame";
import type { QuoteResult } from "@/lib/types";

type Status = "idle" | "loading" | "done";

export default function HomePage() {
  const [status, setStatus] = useState<Status>("idle");
  const [account, setAccount] = useState("");
  const [result, setResult] = useState<QuoteResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

  async function handleSubmit({
    account: accountValue,
    meeting_url,
  }: {
    account: string;
    meeting_url: string;
  }) {
    setAccount(accountValue);
    setErrorMessage(undefined);
    setStatus("loading");

    try {
      const response = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account: accountValue, meeting_url }),
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
        error instanceof Error ? error.message : "No pudimos contactar al webhook.";
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
    <ZebraFrame>
      <Header />
      <main className="flex flex-1 flex-col">
        {status === "idle" ? (
          <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center pb-16 pt-12 sm:pt-20">
            <div className="mb-12 text-center sm:mb-16">
              <p className="mb-4 text-xs font-medium uppercase tracking-[0.4em] text-bone/60">
                Cotizaciones automáticas
              </p>
              <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
                De la junta de Drive
                <br />
                al documento listo.
              </h1>
              <p className="mx-auto mt-6 max-w-md text-sm text-bone/60 sm:text-base">
                Pega la liga de la junta y el nombre de la cuenta. En aproximadamente
                2 minutos tienes el documento generado en Drive.
              </p>
            </div>

            <QuoteForm
              onSubmit={handleSubmit}
              isSubmitting={false}
              errorMessage={errorMessage}
            />
          </section>
        ) : null}

        {status === "loading" ? (
          <section className="flex flex-1 items-center justify-center">
            <LoadingScreen account={account} />
          </section>
        ) : null}

        {status === "done" && result ? (
          <section className="flex flex-1 items-center justify-center">
            <ResultCard account={account} result={result} onReset={handleReset} />
          </section>
        ) : null}
      </main>
      <footer className="mt-12 flex items-center justify-between text-xs uppercase tracking-[0.3em] text-bone/40">
        <span>Zebra · Coti Auto</span>
        <span>n8n</span>
      </footer>
    </ZebraFrame>
  );
}

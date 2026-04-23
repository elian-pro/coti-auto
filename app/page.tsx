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
          <QuoteForm
            onSubmit={handleSubmit}
            isSubmitting={false}
            errorMessage={errorMessage}
          />
        ) : null}

        {status === "loading" ? <LoadingScreen account={account} /> : null}

        {status === "done" && result ? (
          <ResultCard account={account} result={result} onReset={handleReset} />
        ) : null}
      </main>
      <footer className="mt-12 flex items-center justify-between border-t border-ink/20 pt-4 text-xs uppercase tracking-widest text-ink/60">
        <span>Coti Auto · Zebra</span>
        <span>n8n · EasyPanel</span>
      </footer>
    </ZebraFrame>
  );
}

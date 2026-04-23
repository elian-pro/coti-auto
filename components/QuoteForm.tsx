"use client";

import { useState } from "react";

const DRIVE_HINT =
  "Ej: https://drive.google.com/file/d/1AbCDefGhIJkLmNoPQRsTuVWxyZ/view";

export function QuoteForm({
  onSubmit,
  isSubmitting,
  errorMessage,
}: {
  onSubmit: (values: { account: string; meeting_url: string }) => void;
  isSubmitting: boolean;
  errorMessage?: string;
}) {
  const [account, setAccount] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [touched, setTouched] = useState(false);

  const trimmedAccount = account.trim();
  const trimmedUrl = meetingUrl.trim();
  const urlIsValid = /^https?:\/\/\S+$/i.test(trimmedUrl);
  const canSubmit = trimmedAccount.length > 0 && urlIsValid && !isSubmitting;

  return (
    <form
      className="mx-auto w-full max-w-2xl"
      onSubmit={(event) => {
        event.preventDefault();
        setTouched(true);
        if (!canSubmit) return;
        onSubmit({ account: trimmedAccount, meeting_url: trimmedUrl });
      }}
    >
      <div className="rounded-2xl border-2 border-ink bg-bone card-shadow">
        <div className="h-3 zebra-bar rounded-t-2xl" aria-hidden />
        <div className="space-y-6 p-8 sm:p-10">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-ink/60">Nueva cotización</p>
            <h2 className="mt-2 font-display text-3xl text-ink sm:text-4xl">
              Completa los datos de la junta
            </h2>
            <p className="mt-2 text-sm text-ink/70">
              Pegamos la liga de la junta (Drive / Meet / Docs) y el nombre de la cuenta.
              El flujo genera el PDF y el documento editable automáticamente.
            </p>
          </div>

          <Field
            label="Nombre de la cuenta"
            hint="Aparecerá en la portada de la cotización."
            error={touched && !trimmedAccount ? "Requerido" : undefined}
          >
            <input
              type="text"
              value={account}
              onChange={(event) => setAccount(event.target.value)}
              placeholder="Ej: Zebra Corp"
              className="w-full rounded-md border-2 border-ink bg-bone px-4 py-3 text-ink outline-none transition focus:ring-2 focus:ring-ink"
              autoComplete="off"
            />
          </Field>

          <Field
            label="Liga de la junta de Drive"
            hint={DRIVE_HINT}
            error={
              touched && trimmedUrl.length > 0 && !urlIsValid
                ? "Debe comenzar con http(s)://"
                : touched && !trimmedUrl
                  ? "Requerido"
                  : undefined
            }
          >
            <input
              type="url"
              value={meetingUrl}
              onChange={(event) => setMeetingUrl(event.target.value)}
              placeholder="https://drive.google.com/..."
              className="w-full rounded-md border-2 border-ink bg-bone px-4 py-3 text-ink outline-none transition focus:ring-2 focus:ring-ink"
              autoComplete="off"
            />
          </Field>

          {errorMessage ? (
            <div className="rounded-md border-2 border-ink bg-ink px-4 py-3 text-sm text-bone">
              {errorMessage}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={!canSubmit}
            className="group relative flex w-full items-center justify-center overflow-hidden rounded-full border-2 border-ink bg-ink px-6 py-4 font-display text-lg uppercase tracking-widest text-bone transition hover:bg-bone hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-ink disabled:hover:text-bone"
          >
            <span className="relative z-10">
              {isSubmitting ? "Enviando…" : "Generar cotización"}
            </span>
          </button>
        </div>
        <div className="h-3 zebra-bar rounded-b-2xl" aria-hidden />
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-baseline justify-between">
        <span className="text-sm font-semibold uppercase tracking-widest text-ink">{label}</span>
        {error ? (
          <span className="text-xs font-semibold uppercase text-ink">{error}</span>
        ) : null}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-ink/60">{hint}</span> : null}
    </label>
  );
}

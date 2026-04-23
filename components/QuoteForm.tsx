"use client";

import { useState } from "react";

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
      className="mx-auto w-full max-w-xl"
      onSubmit={(event) => {
        event.preventDefault();
        setTouched(true);
        if (!canSubmit) return;
        onSubmit({ account: trimmedAccount, meeting_url: trimmedUrl });
      }}
    >
      <div className="space-y-6">
        <Field
          label="Nombre de la cuenta"
          error={touched && !trimmedAccount ? "Requerido" : undefined}
        >
          <input
            type="text"
            value={account}
            onChange={(event) => setAccount(event.target.value)}
            placeholder="Ej. Zebra Corp"
            className="w-full border-b border-bone/30 bg-transparent px-0 py-3 text-lg text-bone placeholder:text-bone/30 outline-none transition focus:border-bone"
            autoComplete="off"
          />
        </Field>

        <Field
          label="Liga de la junta"
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
            className="w-full border-b border-bone/30 bg-transparent px-0 py-3 text-lg text-bone placeholder:text-bone/30 outline-none transition focus:border-bone"
            autoComplete="off"
          />
        </Field>

        {errorMessage ? (
          <div className="border border-bone/30 px-4 py-3 text-sm text-bone/80">
            {errorMessage}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={!canSubmit}
          className="group flex w-full items-center justify-center gap-3 rounded-full bg-bone px-6 py-4 text-sm font-semibold uppercase tracking-[0.25em] text-ink transition hover:bg-bone/90 disabled:cursor-not-allowed disabled:bg-bone/40 disabled:text-ink/60"
        >
          <span>{isSubmitting ? "Enviando" : "Generar cotización"}</span>
          <span aria-hidden className="transition group-hover:translate-x-1">
            →
          </span>
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-baseline justify-between">
        <span className="text-xs font-medium uppercase tracking-[0.25em] text-bone/60">
          {label}
        </span>
        {error ? (
          <span className="text-xs uppercase tracking-widest text-bone">{error}</span>
        ) : null}
      </span>
      {children}
    </label>
  );
}

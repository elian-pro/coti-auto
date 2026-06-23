"use client";

import { useState } from "react";
import type { QuoteMode } from "@/lib/types";

const MODE_OPTIONS: { value: QuoteMode; label: string; hint: string }[] = [
  { value: "full",       label: "Cotización + Diagnóstico", hint: "Genera ambos documentos en paralelo" },
  { value: "quote_only", label: "Solo cotización",          hint: "DOCX + calculadora si aplica" },
  { value: "eval_only",  label: "Solo diagnóstico",         hint: "PDF con scoring de la llamada" },
];

const CTA_LABEL: Record<QuoteMode, string> = {
  full:       "Generar análisis completo",
  quote_only: "Generar cotización",
  eval_only:  "Generar diagnóstico",
};

export function QuoteForm({
  onSubmit,
  isSubmitting,
  errorMessage,
}: {
  onSubmit: (values: { account: string; meeting_url: string; mode: QuoteMode }) => void;
  isSubmitting: boolean;
  errorMessage?: string;
}) {
  const [account, setAccount] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [mode, setMode] = useState<QuoteMode>("full");
  const [touched, setTouched] = useState(false);

  const trimmedAccount = account.trim();
  const trimmedUrl = meetingUrl.trim();
  const urlIsValid = /^https?:\/\/\S+$/i.test(trimmedUrl);
  const canSubmit = trimmedAccount.length > 0 && urlIsValid && !isSubmitting;

  return (
    <form
      className="w-full"
      onSubmit={(event) => {
        event.preventDefault();
        setTouched(true);
        if (!canSubmit) return;
        onSubmit({ account: trimmedAccount, meeting_url: trimmedUrl, mode });
      }}
    >
      <div className="card p-8 sm:p-10">
        <div className="mb-8">
          <p className="eyebrow mb-3">Nueva cotización</p>
          <h2 className="text-h2 font-semibold text-ink">Datos de la junta</h2>
          <p className="mt-3 text-sm text-ink-500">
            Pega la liga de la junta en Drive y el nombre de la cuenta. Elige qué quieres
            generar.
          </p>
        </div>

        <div className="space-y-6">
          <ModeSelector value={mode} onChange={setMode} disabled={isSubmitting} />

          <Field
            label="Nombre de la cuenta"
            error={touched && !trimmedAccount ? "Requerido" : undefined}
          >
            <input
              type="text"
              value={account}
              onChange={(event) => setAccount(event.target.value)}
              placeholder="Zebra Corp"
              className="field-input"
              aria-invalid={touched && !trimmedAccount ? true : undefined}
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
              className="field-input"
              aria-invalid={
                touched && (trimmedUrl.length === 0 || !urlIsValid) ? true : undefined
              }
              autoComplete="off"
            />
          </Field>

          {errorMessage ? (
            <div
              role="alert"
              className="rounded-xl border border-ink-200 bg-ink-50 px-4 py-3 text-sm text-ink"
            >
              {errorMessage}
            </div>
          ) : null}

          <button type="submit" disabled={!canSubmit} className="btn-primary w-full">
            <span>{isSubmitting ? "Enviando" : CTA_LABEL[mode]}</span>
            <ArrowRight />
          </button>
        </div>
      </div>
    </form>
  );
}

function ModeSelector({
  value,
  onChange,
  disabled,
}: {
  value: QuoteMode;
  onChange: (mode: QuoteMode) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="block" disabled={disabled}>
      <legend className="mb-2 text-sm font-medium text-ink">Qué generar</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {MODE_OPTIONS.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              aria-pressed={active}
              className={[
                "flex flex-col items-start gap-1 rounded-xl border px-4 py-3 text-left transition",
                active
                  ? "border-ink bg-ink text-white"
                  : "border-ink-200 bg-white text-ink hover:border-ink",
              ].join(" ")}
              style={{ transitionTimingFunction: "cubic-bezier(.16,1,.3,1)" }}
            >
              <span className="text-sm font-semibold leading-tight">{opt.label}</span>
              <span
                className={[
                  "text-xs leading-tight",
                  active ? "text-white/70" : "text-ink-500",
                ].join(" ")}
              >
                {opt.hint}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
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
        <span className="text-sm font-medium text-ink">{label}</span>
        {error ? (
          <span className="text-xs font-medium text-[#B91C1C]">{error}</span>
        ) : null}
      </span>
      {children}
    </label>
  );
}

function ArrowRight() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12h14" />
      <path d="m13 5 7 7-7 7" />
    </svg>
  );
}

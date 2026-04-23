import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_WEBHOOK_URL =
  "https://n8n-n8n.9qd6cz.easypanel.host/webhook/85a05e12-43a0-449e-9c8a-3e1df24b4769";

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

function getWebhookUrl(): string {
  return process.env.N8N_WEBHOOK_URL?.trim() || DEFAULT_WEBHOOK_URL;
}

function getTimeoutMs(): number {
  const raw = process.env.WEBHOOK_TIMEOUT_MS;
  if (!raw) return DEFAULT_TIMEOUT_MS;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido." }, { status: 400 });
  }

  const { account, meeting_url } = (body ?? {}) as {
    account?: unknown;
    meeting_url?: unknown;
  };

  if (typeof account !== "string" || account.trim().length === 0) {
    return NextResponse.json(
      { error: "El campo 'account' es obligatorio." },
      { status: 400 },
    );
  }
  if (typeof meeting_url !== "string" || !/^https?:\/\/\S+$/i.test(meeting_url.trim())) {
    return NextResponse.json(
      { error: "El campo 'meeting_url' debe ser una URL http(s)." },
      { status: 400 },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getTimeoutMs());

  try {
    const upstream = await fetch(getWebhookUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        account: account.trim(),
        meeting_url: meeting_url.trim(),
        link: meeting_url.trim(),
        source: "coti-auto-dashboard",
      }),
      signal: controller.signal,
    });

    const rawText = await upstream.text();
    let parsed: unknown = undefined;
    try {
      parsed = rawText ? JSON.parse(rawText) : undefined;
    } catch {
      parsed = undefined;
    }

    if (!upstream.ok) {
      return NextResponse.json(
        {
          error: `El webhook respondió con ${upstream.status}.`,
          detail: parsed ?? rawText?.slice(0, 500),
        },
        { status: 502 },
      );
    }

    return NextResponse.json(
      normalizeQuoteResult(parsed, account.trim()),
      { status: 200 },
    );
  } catch (error) {
    const isAbort = error instanceof Error && error.name === "AbortError";
    return NextResponse.json(
      {
        error: isAbort
          ? "El webhook tardó demasiado en responder."
          : "No pudimos contactar al webhook de n8n.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 504 },
    );
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeQuoteResult(payload: unknown, accountFallback: string) {
  const source = unwrap(payload);
  const driveUrl =
    pickString(source, [
      "drive_url",
      "driveUrl",
      "drive",
      "docs_url",
      "docsUrl",
      "doc_url",
      "docUrl",
      "document_url",
      "documentUrl",
      "google_docs",
      "googleDocs",
      "url",
      "link",
    ]) ?? undefined;
  const account = pickString(source, ["account", "cuenta", "client", "name"]) ?? accountFallback;

  return {
    account,
    drive_url: driveUrl,
    raw: payload ?? null,
  };
}

function unwrap(payload: unknown): Record<string, unknown> {
  if (Array.isArray(payload) && payload.length > 0 && typeof payload[0] === "object") {
    return unwrap(payload[0]);
  }
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (record.json && typeof record.json === "object") {
      return record.json as Record<string, unknown>;
    }
    if (record.data && typeof record.data === "object") {
      return record.data as Record<string, unknown>;
    }
    return record;
  }
  return {};
}

function pickString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return null;
}

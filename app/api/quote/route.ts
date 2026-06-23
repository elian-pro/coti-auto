import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Alias retro-compatible: el dashboard antes apuntaba aquí (proxy a n8n).
// Ahora todo el flujo vive en /api/quote-direct (Node + builder local + Drive).
// Re-emite el request al endpoint nuevo para no romper integraciones que
// todavía apunten a /api/quote.

export async function POST(request: Request) {
  const body = await request.text();
  const url = new URL(request.url);
  url.pathname = "/api/quote-direct";
  const response = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  const payload = await response.text();
  return new NextResponse(payload, {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}

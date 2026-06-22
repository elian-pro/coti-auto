// Cliente del microservicio `zebra-api`. Ahora vive en el mismo contenedor que
// el dashboard (puerto 8080 local) o, vía env, en otro host. Mismas dos rutas:
//   POST /generate         -> devuelve DOCX binario
//   POST /generate-excel   -> devuelve XLSX binario
// Auth opcional vía X-API-Key (header) si ZEBRA_API_KEY está seteada en el
// servidor.

import type { ProposalData } from "@/prompts/cotizacion/schema";

const DEFAULT_BASE = process.env.ZEBRA_API_URL ?? "http://127.0.0.1:8080";
const DEFAULT_TIMEOUT_MS = Number.parseInt(
  process.env.ZEBRA_API_TIMEOUT_MS ?? "60000",
  10,
);
const API_KEY = process.env.ZEBRA_API_KEY;

export type GeneratedFile = {
  buffer: Buffer;
  filename: string;
  contentType: string;
};

async function postBinary(
  path: "/generate" | "/generate-excel",
  payload: ProposalData & { __slug__: string },
  fallbackFilename: string,
  expectedContentType: string,
): Promise<GeneratedFile> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: expectedContentType,
    };
    if (API_KEY) headers["X-API-Key"] = API_KEY;

    const response = await fetch(`${DEFAULT_BASE}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(
        `zebra-api ${path} respondió ${response.status}. ${errorBody.slice(0, 200)}`,
      );
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const filename =
      extractFilename(response.headers.get("content-disposition")) ??
      fallbackFilename;
    const contentType =
      response.headers.get("content-type") ?? expectedContentType;
    return { buffer, filename, contentType };
  } finally {
    clearTimeout(timeout);
  }
}

function extractFilename(contentDisposition: string | null): string | null {
  if (!contentDisposition) return null;
  const match =
    /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(contentDisposition);
  return match ? decodeURIComponent(match[1]) : null;
}

export function generateDocx(
  data: ProposalData,
  slug: string,
): Promise<GeneratedFile> {
  return postBinary(
    "/generate",
    { ...data, __slug__: slug },
    `${slug}.docx`,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
}

export function generateXlsx(
  data: ProposalData,
  slug: string,
): Promise<GeneratedFile> {
  return postBinary(
    "/generate-excel",
    { ...data, __slug__: slug },
    `${slug}.xlsx`,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}

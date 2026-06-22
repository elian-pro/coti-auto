// Cliente del microservicio interno `zebra-api` que ya existe en EasyPanel.
// Mismas dos rutas que usa el flujo de n8n:
//   POST /generate         -> devuelve DOCX binario
//   POST /generate-excel   -> devuelve XLSX binario

import type { ProposalData } from "@/prompts/cotizacion/schema";

const DEFAULT_BASE = process.env.ZEBRA_API_URL ?? "http://zebra-api:8080";
const DEFAULT_TIMEOUT_MS = Number.parseInt(
  process.env.ZEBRA_API_TIMEOUT_MS ?? "60000",
  10,
);

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
    const response = await fetch(`${DEFAULT_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: expectedContentType,
      },
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

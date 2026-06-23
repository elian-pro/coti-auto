// Descarga el contenido de un Google Doc como texto plano.
// Prefiere la cuenta de servicio (admite docs privados); si no hay SA o
// el doc está abierto al público, usa el endpoint público de exportación.

import { exportGoogleDocAsText } from "@/lib/drive";

const DOC_ID_RX = /\/document\/d\/([a-zA-Z0-9_-]{20,})/;
const DRIVE_FILE_ID_RX = /\/file\/d\/([a-zA-Z0-9_-]{20,})/;

export class TranscriptFetchError extends Error {
  constructor(
    message: string,
    public readonly stage: "parse_url" | "fetch" | "decode",
  ) {
    super(message);
    this.name = "TranscriptFetchError";
  }
}

export type Transcript = {
  text: string;
  docId: string;
};

export async function fetchTranscript(driveUrl: string): Promise<Transcript> {
  const docMatch = DOC_ID_RX.exec(driveUrl);
  if (docMatch) {
    return fetchDoc(docMatch[1]);
  }
  const fileMatch = DRIVE_FILE_ID_RX.exec(driveUrl);
  if (fileMatch) {
    throw new TranscriptFetchError(
      "El link es un archivo de Drive (no un Google Doc). Solo se soporta Google Docs por ahora.",
      "parse_url",
    );
  }
  throw new TranscriptFetchError(
    "La URL no parece un Google Doc válido.",
    "parse_url",
  );
}

async function fetchDoc(docId: string): Promise<Transcript> {
  // Camino 1: si tenemos cuenta de servicio, leemos vía API (admite privados).
  if (process.env.GOOGLE_SA_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    try {
      const text = await exportGoogleDocAsText(docId);
      if (text.trim().length === 0) {
        throw new TranscriptFetchError("El Google Doc vino vacío.", "decode");
      }
      return { text, docId };
    } catch (error) {
      // Si la SA falla (sin permisos, etc.), caemos al export público.
      if (error instanceof TranscriptFetchError) throw error;
      // Log silencioso, intentamos público
      console.warn(
        "[transcript] SA falló, intentando export público:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  // Camino 2: export público (requiere doc compartido como "cualquiera con el link").
  const url = `https://docs.google.com/document/d/${docId}/export?format=txt`;
  let response: Response;
  try {
    response = await fetch(url, { redirect: "follow" });
  } catch (error) {
    throw new TranscriptFetchError(
      `No pudimos llegar al Google Doc: ${error instanceof Error ? error.message : String(error)}`,
      "fetch",
    );
  }
  if (!response.ok) {
    throw new TranscriptFetchError(
      `Google Doc respondió ${response.status}. Comparte como "cualquiera con el link" o agrega la cuenta de servicio como lector.`,
      "fetch",
    );
  }
  const text = await response.text();
  if (!text.trim()) {
    throw new TranscriptFetchError("El Google Doc vino vacío.", "decode");
  }
  return { text, docId };
}

// Descarga el contenido de un Google Doc / Drive link como texto plano.
//
// Caso 1: la URL es un Google Doc compartido públicamente. Usamos el endpoint
//   `/export?format=txt` que devuelve UTF-8 sin autenticación.
// Caso 2: la URL apunta a un archivo en Drive distinto a un Doc. Lo dejamos
//   pendiente: requeriría cuenta de servicio. Por ahora tiramos error claro.

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
    return fetchDocAsText(docMatch[1]);
  }
  const fileMatch = DRIVE_FILE_ID_RX.exec(driveUrl);
  if (fileMatch) {
    throw new TranscriptFetchError(
      "El link es un archivo de Drive (no un Google Doc). La descarga directa requiere cuenta de servicio. Pendiente Fase 2.1.",
      "parse_url",
    );
  }
  throw new TranscriptFetchError(
    "La URL no parece un Google Doc ni un archivo de Drive válido.",
    "parse_url",
  );
}

async function fetchDocAsText(docId: string): Promise<Transcript> {
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
      `Google Doc respondió ${response.status}. ¿El documento está compartido como "cualquiera con el link"?`,
      "fetch",
    );
  }
  const text = await response.text();
  if (!text.trim()) {
    throw new TranscriptFetchError("El Google Doc vino vacío.", "decode");
  }
  return { text, docId };
}

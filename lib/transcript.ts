// Descarga la transcripción de un Google Doc.
// Estrategia:
//   1. Si recibimos un access_token del usuario (OAuth), preferimos llamar a
//      Drive como ese usuario. Lo natural: el operador ya tiene acceso al
//      Doc, no necesita compartirlo con nadie más.
//   2. Si no hay token de usuario y SÍ hay cuenta de servicio configurada,
//      usamos la SA (requiere que la SA tenga acceso al Doc).
//   3. Como último recurso, intentamos el endpoint público
//      docs.google.com/export?format=txt (el Doc tiene que ser
//      "cualquiera con el link").

import { exportGoogleDocAsText } from "@/lib/drive";

const DOC_ID_RX = /\/document\/d\/([a-zA-Z0-9_-]{20,})/;
const DRIVE_FILE_ID_RX = /\/file\/d\/([a-zA-Z0-9_-]{20,})/;

export class TranscriptFetchError extends Error {
  constructor(
    message: string,
    public readonly stage: "parse_url" | "fetch" | "decode" | "auth",
  ) {
    super(message);
    this.name = "TranscriptFetchError";
  }
}

export type Transcript = {
  text: string;
  docId: string;
  via: "user_oauth" | "service_account" | "public_export";
};

export type FetchOptions = {
  /** Access token de OAuth del usuario (NextAuth) */
  userAccessToken?: string;
};

export async function fetchTranscript(
  driveUrl: string,
  options: FetchOptions = {},
): Promise<Transcript> {
  const docMatch = DOC_ID_RX.exec(driveUrl);
  if (docMatch) {
    return fetchDoc(docMatch[1], options);
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

async function fetchDoc(docId: string, options: FetchOptions): Promise<Transcript> {
  // Camino 1: token de usuario via OAuth (lo más común con sesión activa)
  if (options.userAccessToken) {
    try {
      const text = await exportWithUserToken(docId, options.userAccessToken);
      return { text, docId, via: "user_oauth" };
    } catch (error) {
      // Si el usuario no tiene acceso al Doc, tiramos error claro (no
      // intentamos SA porque casi nunca aplica).
      if (error instanceof TranscriptFetchError) throw error;
      throw new TranscriptFetchError(
        `No pudimos leer el Doc con tu cuenta de Google: ${error instanceof Error ? error.message : String(error)}`,
        "fetch",
      );
    }
  }

  // Camino 2: service account (legacy, requiere compartir con la SA)
  if (
    process.env.GOOGLE_SA_JSON ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
  ) {
    try {
      const text = await exportGoogleDocAsText(docId);
      if (text.trim().length === 0) {
        throw new TranscriptFetchError("El Google Doc vino vacío.", "decode");
      }
      return { text, docId, via: "service_account" };
    } catch (error) {
      if (error instanceof TranscriptFetchError) throw error;
      console.warn(
        "[transcript] SA falló, intentando export público:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  // Camino 3: export público (doc compartido como "cualquiera con el link")
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
      `Google Doc respondió ${response.status}. Inicia sesión con la cuenta que tiene acceso al Doc.`,
      "fetch",
    );
  }
  const text = await response.text();
  if (!text.trim()) {
    throw new TranscriptFetchError("El Google Doc vino vacío.", "decode");
  }
  return { text, docId, via: "public_export" };
}

// Llama directo a la Drive API v3 con el bearer token del usuario.
// Sin SDK de Google (sería más overhead). El endpoint /export con
// mimeType text/plain devuelve el contenido del Doc como texto.
async function exportWithUserToken(
  docId: string,
  accessToken: string,
): Promise<string> {
  const url = `https://www.googleapis.com/drive/v3/files/${docId}/export?mimeType=text%2Fplain`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "text/plain",
    },
  });
  if (response.status === 401) {
    throw new TranscriptFetchError(
      "Tu sesión de Google expiró o el token no tiene permiso de Drive. Vuelve a iniciar sesión.",
      "auth",
    );
  }
  if (response.status === 403) {
    throw new TranscriptFetchError(
      "Tu cuenta no tiene permiso para leer ese Google Doc.",
      "fetch",
    );
  }
  if (response.status === 404) {
    throw new TranscriptFetchError(
      "El Google Doc no existe o no es accesible para tu cuenta.",
      "fetch",
    );
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new TranscriptFetchError(
      `Drive respondió ${response.status}. ${body.slice(0, 200)}`,
      "fetch",
    );
  }
  const text = await response.text();
  if (!text.trim()) {
    throw new TranscriptFetchError("El Google Doc vino vacío.", "decode");
  }
  return text;
}

// Cliente Google Drive con cuenta de servicio. Sube DOCX/XLSX, los convierte
// a Google Docs / Sheets, los pone en la carpeta configurada, y los comparte
// como "cualquiera con el link". Reemplaza los nodos `Upload file1`,
// `Copy XLSX as Sheet1`, `Share file1`, etc. del flujo n8n viejo.

import { Readable } from "node:stream";
import { GoogleAuth } from "google-auth-library";
import { drive as driveFactory, type drive_v3 } from "@googleapis/drive";

const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/drive.file",
];

let cached: drive_v3.Drive | null = null;

function loadCredentials(): Record<string, unknown> {
  const raw =
    process.env.GOOGLE_SA_JSON ??
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!raw) {
    throw new Error(
      "Falta GOOGLE_SA_JSON. Pega el JSON de la cuenta de servicio en EasyPanel.",
    );
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `GOOGLE_SA_JSON no es un JSON válido: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function getDrive(): drive_v3.Drive {
  if (cached) return cached;
  const credentials = loadCredentials();
  const auth = new GoogleAuth({
    credentials: credentials as Record<string, string>,
    scopes: SCOPES,
  });
  // googleapis-common bundles its own google-auth-library copy; TypeScript
  // sees two declarations of GoogleAuth as different types, but they are
  // identical at runtime.
  cached = driveFactory({ version: "v3", auth: auth as unknown as never });
  return cached;
}

export type UploadResult = {
  id: string;
  docs_url: string;
};

async function uploadConverted(
  buffer: Buffer,
  filename: string,
  folderId: string,
  sourceMime: string,
  targetMime: "application/vnd.google-apps.document" | "application/vnd.google-apps.spreadsheet",
  webPrefix: "document" | "spreadsheets",
): Promise<UploadResult> {
  const drive = getDrive();
  const created = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: filename,
      mimeType: targetMime,
      parents: [folderId],
    },
    media: {
      mimeType: sourceMime,
      body: Readable.from(buffer),
    },
    fields: "id",
  });
  const id = created.data.id;
  if (!id) {
    throw new Error("Drive no devolvió fileId tras la subida.");
  }
  // Compartir público (cualquiera con el link puede ver/editar — match con n8n)
  await drive.permissions.create({
    fileId: id,
    supportsAllDrives: true,
    requestBody: {
      role: "writer",
      type: "anyone",
      allowFileDiscovery: false,
    },
  });
  return {
    id,
    docs_url: `https://docs.google.com/${webPrefix}/d/${id}/edit`,
  };
}

export function uploadDocxAsGoogleDoc(
  buffer: Buffer,
  filename: string,
  folderId: string,
): Promise<UploadResult> {
  return uploadConverted(
    buffer,
    filename,
    folderId,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.google-apps.document",
    "document",
  );
}

export function uploadXlsxAsGoogleSheet(
  buffer: Buffer,
  filename: string,
  folderId: string,
): Promise<UploadResult> {
  return uploadConverted(
    buffer,
    filename,
    folderId,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.google-apps.spreadsheet",
    "spreadsheets",
  );
}

// Sube un PDF tal cual (sin conversión a Google Doc). Drive lo muestra con
// su visor nativo. URL canónica de "view".
export async function uploadPdfAsIs(
  buffer: Buffer,
  filename: string,
  folderId: string,
): Promise<UploadResult> {
  const drive = getDrive();
  const created = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: filename.endsWith(".pdf") ? filename : `${filename}.pdf`,
      mimeType: "application/pdf",
      parents: [folderId],
    },
    media: {
      mimeType: "application/pdf",
      body: Readable.from(buffer),
    },
    fields: "id",
  });
  const id = created.data.id;
  if (!id) throw new Error("Drive no devolvió fileId tras la subida del PDF.");
  await drive.permissions.create({
    fileId: id,
    supportsAllDrives: true,
    requestBody: {
      role: "reader",
      type: "anyone",
      allowFileDiscovery: false,
    },
  });
  return {
    id,
    docs_url: `https://drive.google.com/file/d/${id}/view`,
  };
}

// Exporta un Google Doc como texto plano usando la SA. Soporta docs
// privados que tengan permiso de lectura para la cuenta de servicio.
export async function exportGoogleDocAsText(fileId: string): Promise<string> {
  const drive = getDrive();
  const response = await drive.files.export(
    {
      fileId,
      mimeType: "text/plain",
    },
    { responseType: "text" },
  );
  return String(response.data ?? "");
}

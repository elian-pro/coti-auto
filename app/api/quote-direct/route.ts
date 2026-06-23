import { NextResponse } from "next/server";
import { callClaude } from "@/lib/anthropic";
import { uploadDocxAsGoogleDoc, uploadXlsxAsGoogleSheet } from "@/lib/drive";
import {
  ProposalParseError,
  parseClaudeResponse,
  shouldGenerateExcel,
} from "@/lib/proposal-parser";
import { fetchTranscript, TranscriptFetchError } from "@/lib/transcript";
import { generateDocx, generateXlsx } from "@/lib/zebra-api";
import { loadSystemPrompt } from "@/prompts/cotizacion/system_prompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Endpoint unificado. Orquesta TODO el flow que antes hacía n8n:
//   1. Descarga la transcripción del Google Doc (SA si está, público si no).
//   2. Llama a Claude con el system prompt v3.2 (cacheado).
//   3. Valida el JSON contra el schema zod.
//   4. Llama al builder local (FastAPI :8080 dentro del mismo contenedor).
//   5. Sube el DOCX (y XLSX si aplica) a la carpeta de Drive con la SA.
//   6. Devuelve URLs públicas de Drive (Google Doc + Google Sheet + PDF export).
//
// No usa Supabase. No usa n8n.

type Body = {
  account?: unknown;
  meeting_url?: unknown;
};

const DRIVE_FOLDER_ID =
  process.env.DRIVE_FOLDER_ID ??
  "1d7Uj4dMx4USMNum-lkD_2w33OAeQgkCD"; // Carpeta de cotizaciones por default

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido." }, { status: 400 });
  }

  const account = typeof body.account === "string" ? body.account.trim() : "";
  const meetingUrl =
    typeof body.meeting_url === "string" ? body.meeting_url.trim() : "";

  if (!account) {
    return NextResponse.json(
      { error: "El campo 'account' es obligatorio." },
      { status: 400 },
    );
  }
  if (!/^https?:\/\/\S+$/i.test(meetingUrl)) {
    return NextResponse.json(
      { error: "El campo 'meeting_url' debe ser una URL http(s)." },
      { status: 400 },
    );
  }

  const slug =
    account
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "") || "propuesta";

  // 1. Transcripción
  let transcriptText: string;
  try {
    const transcript = await fetchTranscript(meetingUrl);
    transcriptText = transcript.text;
  } catch (error) {
    if (error instanceof TranscriptFetchError) {
      return NextResponse.json(
        { error: error.message, stage: error.stage },
        { status: 400 },
      );
    }
    throw error;
  }

  const userContent = `PROSPECTO: ${account}\n\n--- TRANSCRIPCIÓN / RESUMEN ---\n${transcriptText}`;

  // 2. Claude
  let claudeRaw: string;
  let usage;
  try {
    const result = await callClaude({
      systemPrompt: loadSystemPrompt(),
      userContent,
    });
    claudeRaw = result.rawText;
    usage = result.usage;
  } catch (error) {
    return NextResponse.json(
      {
        error: `Claude falló: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 502 },
    );
  }

  // 3. Validar
  let parsed;
  try {
    parsed = parseClaudeResponse(claudeRaw);
  } catch (error) {
    if (error instanceof ProposalParseError) {
      return NextResponse.json(
        {
          error: error.message,
          stage: error.stage,
          raw_preview: error.rawText,
          schema_issues: error.zodError?.issues,
        },
        { status: 422 },
      );
    }
    throw error;
  }

  if (parsed.kind === "diagnostico_preliminar") {
    return NextResponse.json(
      {
        ...parsed.data,
        usage,
      },
      { status: 200 },
    );
  }

  // 4. Builder local
  const wantsExcel = shouldGenerateExcel(parsed.data);
  let docxFile;
  let xlsxFile = null;
  try {
    docxFile = await generateDocx(parsed.data, slug);
    if (wantsExcel) {
      xlsxFile = await generateXlsx(parsed.data, slug);
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: `Builder falló: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 502 },
    );
  }

  // 5. Subir a Drive
  let docsUrl: string | undefined;
  let sheetsUrl: string | undefined;
  let pdfUrl: string | undefined;
  try {
    const doc = await uploadDocxAsGoogleDoc(
      docxFile.buffer,
      docxFile.filename.replace(/\.docx$/i, ""),
      DRIVE_FOLDER_ID,
    );
    docsUrl = doc.docs_url;
    pdfUrl = `https://docs.google.com/document/d/${doc.id}/export?format=pdf`;

    if (xlsxFile) {
      const sheet = await uploadXlsxAsGoogleSheet(
        xlsxFile.buffer,
        xlsxFile.filename.replace(/\.xlsx$/i, ""),
        DRIVE_FOLDER_ID,
      );
      sheetsUrl = sheet.docs_url;
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: `Subida a Drive falló: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 502 },
    );
  }

  return NextResponse.json(
    {
      status: "ok",
      account,
      slug,
      docs_url: docsUrl,
      sheets_url: sheetsUrl,
      pdf_url: pdfUrl,
      usage,
    },
    { status: 200 },
  );
}

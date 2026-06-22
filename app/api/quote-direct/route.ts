import { NextResponse } from "next/server";
import { callClaude } from "@/lib/anthropic";
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

// Endpoint nuevo (Fase 2 de la migración). Orquesta:
//   1. Descargar la transcripción del Google Doc
//   2. Llamar a Claude con el system prompt v3.2 (cacheado)
//   3. Validar el JSON contra el schema zod
//   4. Llamar al microservicio zebra-api (DOCX, + XLSX si aplica)
//   5. Devolver los binarios al cliente como base64 + metadata
//
// Drive upload + Supabase se quedan en n8n hasta paridad (Fase 2.1).

type Body = {
  account?: unknown;
  meeting_url?: unknown;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json(
      { error: "Cuerpo JSON inválido." },
      { status: 400 },
    );
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

  const slug = account
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

  // 4. Builder
  const wantsExcel = shouldGenerateExcel(parsed.data);
  try {
    const docx = await generateDocx(parsed.data, slug);
    const xlsx = wantsExcel ? await generateXlsx(parsed.data, slug) : null;

    return NextResponse.json(
      {
        status: "ok",
        account,
        slug,
        usage,
        docx: {
          filename: docx.filename,
          content_type: docx.contentType,
          base64: docx.buffer.toString("base64"),
          size_bytes: docx.buffer.length,
        },
        xlsx: xlsx
          ? {
              filename: xlsx.filename,
              content_type: xlsx.contentType,
              base64: xlsx.buffer.toString("base64"),
              size_bytes: xlsx.buffer.length,
            }
          : null,
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: `Builder falló: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 502 },
    );
  }
}

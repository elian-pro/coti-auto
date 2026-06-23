import { NextResponse } from "next/server";
import { callClaude } from "@/lib/anthropic";
import {
  uploadDocxAsGoogleDoc,
  uploadPdfAsIs,
  uploadXlsxAsGoogleSheet,
} from "@/lib/drive";
import {
  EvaluationParseError,
  parseEvaluationResponse,
} from "@/lib/evaluation-parser";
import {
  ProposalParseError,
  parseClaudeResponse,
  shouldGenerateExcel,
} from "@/lib/proposal-parser";
import { fetchTranscript, TranscriptFetchError } from "@/lib/transcript";
import {
  generateDocx,
  generateEvaluationPdf,
  generateXlsx,
} from "@/lib/zebra-api";
import { loadSystemPrompt } from "@/prompts/cotizacion/system_prompt";
import { loadEvalSystemPrompt } from "@/prompts/evaluacion/system_prompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Endpoint unificado. Una sola corrida → dos análisis EN PARALELO:
//   1. Descarga la transcripción del Google Doc (1 sola vez).
//   2. Llama a Claude DOS veces en paralelo:
//      - cotización (prompt v3.2)  → proposal_data
//      - evaluación (prompt v2.3) → evaluation_data
//   3. Valida ambos JSON con sus schemas zod.
//   4. Llama al builder local en paralelo:
//      - /generate         → DOCX cotización
//      - /generate-excel   → XLSX calculadora (solo si aplica)
//      - /evaluate         → PDF evaluación
//   5. Sube todo a Drive con la SA.
//   6. Devuelve URLs.

type Body = {
  account?: unknown;
  meeting_url?: unknown;
};

const DRIVE_FOLDER_ID =
  process.env.DRIVE_FOLDER_ID ?? "1d7Uj4dMx4USMNum-lkD_2w33OAeQgkCD";

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

  // 2. Claude en paralelo: cotización + evaluación
  let cotResult, evalResult;
  try {
    [cotResult, evalResult] = await Promise.all([
      callClaude({
        systemPrompt: loadSystemPrompt(),
        userContent,
      }),
      callClaude({
        systemPrompt: loadEvalSystemPrompt(),
        userContent,
      }),
    ]);
  } catch (error) {
    return NextResponse.json(
      {
        error: `Claude falló: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 502 },
    );
  }

  // 3. Validar JSONs
  let cotParsed;
  try {
    cotParsed = parseClaudeResponse(cotResult.rawText);
  } catch (error) {
    if (error instanceof ProposalParseError) {
      return NextResponse.json(
        {
          error: `Cotización: ${error.message}`,
          stage: error.stage,
          raw_preview: error.rawText,
          schema_issues: error.zodError?.issues,
        },
        { status: 422 },
      );
    }
    throw error;
  }

  let evalParsed;
  try {
    evalParsed = parseEvaluationResponse(evalResult.rawText);
  } catch (error) {
    if (error instanceof EvaluationParseError) {
      // No abortamos toda la corrida si solo falla la evaluación; seguimos
      // con la cotización y reportamos el problema en la respuesta.
      evalParsed = {
        kind: "fallback" as const,
        data: {
          status: "evaluacion_no_aplicable" as const,
          razon: `Schema del evaluador no validó: ${error.message}`,
        },
        _error: error,
      };
    } else {
      throw error;
    }
  }

  // 3b. Si la cotización vino como "datos insuficientes", no construimos nada
  if (cotParsed.kind === "diagnostico_preliminar") {
    return NextResponse.json(
      {
        ...cotParsed.data,
        usage: {
          cotizacion: cotResult.usage,
          evaluacion: evalResult.usage,
        },
      },
      { status: 200 },
    );
  }

  // 4. Builder en paralelo
  const wantsExcel = shouldGenerateExcel(cotParsed.data);
  const evalDataForBuilder =
    evalParsed.kind === "evaluation" ? evalParsed.data : null;

  type Maybe<T> = T | null;

  type BuildResult = {
    docx: Awaited<ReturnType<typeof generateDocx>>;
    xlsx: Maybe<Awaited<ReturnType<typeof generateXlsx>>>;
    evaluation: Maybe<Awaited<ReturnType<typeof generateEvaluationPdf>>>;
  };

  let built: BuildResult;
  try {
    const [docx, xlsx, evaluation] = await Promise.all([
      generateDocx(cotParsed.data, slug),
      wantsExcel ? generateXlsx(cotParsed.data, slug) : Promise.resolve(null),
      evalDataForBuilder
        ? generateEvaluationPdf(evalDataForBuilder, slug)
        : Promise.resolve(null),
    ]);
    built = { docx, xlsx, evaluation };
  } catch (error) {
    return NextResponse.json(
      {
        error: `Builder falló: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 502 },
    );
  }

  // 5. Subir a Drive (también en paralelo)
  let docsUrl: string | undefined;
  let sheetsUrl: string | undefined;
  let pdfUrl: string | undefined;
  let evaluationUrl: string | undefined;
  try {
    const [doc, sheet, evalPdf] = await Promise.all([
      uploadDocxAsGoogleDoc(
        built.docx.buffer,
        built.docx.filename.replace(/\.docx$/i, ""),
        DRIVE_FOLDER_ID,
      ),
      built.xlsx
        ? uploadXlsxAsGoogleSheet(
            built.xlsx.buffer,
            built.xlsx.filename.replace(/\.xlsx$/i, ""),
            DRIVE_FOLDER_ID,
          )
        : Promise.resolve(null),
      built.evaluation
        ? uploadPdfAsIs(
            built.evaluation.buffer,
            built.evaluation.filename.replace(/\.pdf$/i, ""),
            DRIVE_FOLDER_ID,
          )
        : Promise.resolve(null),
    ]);
    docsUrl = doc.docs_url;
    pdfUrl = `https://docs.google.com/document/d/${doc.id}/export?format=pdf`;
    if (sheet) sheetsUrl = sheet.docs_url;
    if (evalPdf) evaluationUrl = evalPdf.docs_url;
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
      evaluation_url: evaluationUrl,
      evaluation_status:
        evalParsed.kind === "evaluation"
          ? "ok"
          : evalParsed.kind === "fallback"
            ? "no_aplicable"
            : "skipped",
      evaluation_score:
        evalParsed.kind === "evaluation" ? evalParsed.data.score_total : undefined,
      evaluation_verdict:
        evalParsed.kind === "evaluation" ? evalParsed.data.veredicto : undefined,
      usage: {
        cotizacion: cotResult.usage,
        evaluacion: evalResult.usage,
      },
    },
    { status: 200 },
  );
}

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { callClaude, classifyAnthropicError } from "@/lib/anthropic";
import { saveQuoteRun } from "@/lib/db/quotes";
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
import type { QuoteMode } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Endpoint unificado con 3 modos según `mode` en el body:
//   - "full"       (default) → cotización + diagnóstico en paralelo
//   - "quote_only"           → solo cotización (DOCX + Sheet)
//   - "eval_only"            → solo diagnóstico (PDF evaluador)

type Body = {
  account?: unknown;
  meeting_url?: unknown;
  mode?: unknown;
};

const FOLDER_COTIZACIONES =
  process.env.DRIVE_FOLDER_ID_COTIZACIONES ??
  process.env.DRIVE_FOLDER_ID ??
  "1d7Uj4dMx4USMNum-lkD_2w33OAeQgkCD";

const FOLDER_EVALUACIONES =
  process.env.DRIVE_FOLDER_ID_EVALUACIONES ??
  process.env.DRIVE_FOLDER_ID ??
  FOLDER_COTIZACIONES;

const VALID_MODES: QuoteMode[] = ["full", "quote_only", "eval_only"];

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
  const mode: QuoteMode =
    typeof body.mode === "string" && (VALID_MODES as string[]).includes(body.mode)
      ? (body.mode as QuoteMode)
      : "full";

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

  const wantCotizacion = mode === "full" || mode === "quote_only";
  const wantEvaluacion = mode === "full" || mode === "eval_only";

  const slug =
    account
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "") || "propuesta";

  // 0. Sesión: el token OAuth del usuario nos sirve para leer Docs privados
  // sin tener que compartirlos con la cuenta de servicio.
  const session = await auth();
  const userAccessToken =
    (session as { access_token?: string } | null)?.access_token;
  if (session && (session as { error?: string }).error) {
    return NextResponse.json(
      {
        error: `Sesión inválida: ${(session as { error?: string }).error}. Cierra sesión y entra de nuevo.`,
      },
      { status: 401 },
    );
  }

  // 1. Transcripción
  let transcriptText: string;
  try {
    const transcript = await fetchTranscript(meetingUrl, { userAccessToken });
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

  // 2. Claude — solo las llamadas que el modo requiere
  type ClaudeResult = Awaited<ReturnType<typeof callClaude>>;
  let cotResult: ClaudeResult | null = null;
  let evalResult: ClaudeResult | null = null;
  try {
    const [cot, ev] = await Promise.all([
      wantCotizacion
        ? callClaude({ systemPrompt: loadSystemPrompt(), userContent })
        : Promise.resolve(null),
      wantEvaluacion
        ? callClaude({ systemPrompt: loadEvalSystemPrompt(), userContent })
        : Promise.resolve(null),
    ]);
    cotResult = cot;
    evalResult = ev;
  } catch (error) {
    const classified = classifyAnthropicError(error);
    return NextResponse.json(
      {
        error: classified.message,
        error_kind: classified.kind,
        stage: "claude",
      },
      { status: classified.status },
    );
  }

  // 3. Validar JSON de cotización (si aplica)
  let cotParsed: ReturnType<typeof parseClaudeResponse> | null = null;
  if (wantCotizacion && cotResult) {
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
  }

  // Si la cotización vino como "datos insuficientes", devolvemos eso tal cual.
  if (cotParsed && cotParsed.kind === "diagnostico_preliminar") {
    return NextResponse.json(
      {
        ...cotParsed.data,
        mode,
        usage: {
          cotizacion: cotResult?.usage,
          evaluacion: evalResult?.usage,
        },
      },
      { status: 200 },
    );
  }

  // 4. Validar JSON del evaluador (si aplica). No aborta si falla.
  type EvalParsedShape =
    | (ReturnType<typeof parseEvaluationResponse> & { _error?: never })
    | {
        kind: "fallback";
        data: { status: "evaluacion_no_aplicable"; razon: string };
        _error?: EvaluationParseError;
      };
  let evalParsed: EvalParsedShape | null = null;
  if (wantEvaluacion && evalResult) {
    try {
      evalParsed = parseEvaluationResponse(evalResult.rawText);
    } catch (error) {
      if (error instanceof EvaluationParseError) {
        evalParsed = {
          kind: "fallback",
          data: {
            status: "evaluacion_no_aplicable",
            razon: `Schema del evaluador no validó: ${error.message}`,
          },
          _error: error,
        };
      } else {
        throw error;
      }
    }
  }

  // 5. Builder en paralelo según lo que se haya validado
  const proposalData =
    cotParsed && cotParsed.kind === "proposal" ? cotParsed.data : null;
  const wantsExcel = proposalData ? shouldGenerateExcel(proposalData) : false;
  const evalDataForBuilder =
    evalParsed && evalParsed.kind === "evaluation" ? evalParsed.data : null;

  let docxFile: Awaited<ReturnType<typeof generateDocx>> | null = null;
  let xlsxFile: Awaited<ReturnType<typeof generateXlsx>> | null = null;
  let evalFile: Awaited<ReturnType<typeof generateEvaluationPdf>> | null = null;
  try {
    const [docx, xlsx, ev] = await Promise.all([
      proposalData ? generateDocx(proposalData, slug) : Promise.resolve(null),
      proposalData && wantsExcel
        ? generateXlsx(proposalData, slug)
        : Promise.resolve(null),
      evalDataForBuilder
        ? generateEvaluationPdf(evalDataForBuilder, slug)
        : Promise.resolve(null),
    ]);
    docxFile = docx;
    xlsxFile = xlsx;
    evalFile = ev;
  } catch (error) {
    return NextResponse.json(
      {
        error: `Builder falló: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 502 },
    );
  }

  // 6. Subir a Drive
  // Naming canónico: `{Cliente} {Tipo}` — sin slug ni hash, así los archivos
  // se ven limpios en la carpeta y en la barra del Google Doc / Sheet.
  // Sanitiza / y \ porque Drive los trata como path-separator.
  const safeAccount = account.replace(/[\/\\]/g, "-").trim();
  const driveName = {
    docx: `${safeAccount} Propuesta`,
    xlsx: `${safeAccount} Calculadora`,
    pdf:  `${safeAccount} Diagnóstico`,
  };

  let docsUrl: string | undefined;
  let sheetsUrl: string | undefined;
  let pdfUrl: string | undefined;
  let evaluationUrl: string | undefined;
  try {
    const [doc, sheet, evalPdf] = await Promise.all([
      docxFile
        ? uploadDocxAsGoogleDoc(docxFile.buffer, driveName.docx, FOLDER_COTIZACIONES)
        : Promise.resolve(null),
      xlsxFile
        ? uploadXlsxAsGoogleSheet(xlsxFile.buffer, driveName.xlsx, FOLDER_COTIZACIONES)
        : Promise.resolve(null),
      evalFile
        ? uploadPdfAsIs(evalFile.buffer, driveName.pdf, FOLDER_EVALUACIONES)
        : Promise.resolve(null),
    ]);
    if (doc) {
      docsUrl = doc.docs_url;
      pdfUrl = `https://docs.google.com/document/d/${doc.id}/export?format=pdf`;
    }
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

  // 7. Persistir el run (fire-and-forget). Solo activa si DATABASE_URL existe.
  const evaluationScore =
    evalParsed && evalParsed.kind === "evaluation"
      ? evalParsed.data.score_total
      : null;
  const evaluationVerdict =
    evalParsed && evalParsed.kind === "evaluation"
      ? evalParsed.data.veredicto
      : null;
  const tokensInput =
    (cotResult?.usage?.input_tokens ?? 0) +
    (evalResult?.usage?.input_tokens ?? 0);
  const tokensOutput =
    (cotResult?.usage?.output_tokens ?? 0) +
    (evalResult?.usage?.output_tokens ?? 0);

  void saveQuoteRun({
    account,
    meetingUrl,
    userEmail: session?.user?.email ?? null,
    mode,
    transcript: transcriptText,
    proposalJson: cotParsed && cotParsed.kind === "proposal" ? cotParsed.data : null,
    evaluationJson:
      evalParsed && evalParsed.kind === "evaluation" ? evalParsed.data : null,
    docsUrl: docsUrl ?? null,
    sheetsUrl: sheetsUrl ?? null,
    pdfUrl: pdfUrl ?? null,
    evaluationUrl: evaluationUrl ?? null,
    evaluationScore,
    evaluationVerdict,
    tokensInput,
    tokensOutput,
    status: "ok",
    errorStage: null,
    errorMessage: null,
  });

  return NextResponse.json(
    {
      status: "ok",
      mode,
      account,
      slug,
      docs_url: docsUrl,
      sheets_url: sheetsUrl,
      pdf_url: pdfUrl,
      evaluation_url: evaluationUrl,
      evaluation_status: wantEvaluacion
        ? evalParsed && evalParsed.kind === "evaluation"
          ? "ok"
          : "no_aplicable"
        : "skipped",
      evaluation_score: evaluationScore ?? undefined,
      evaluation_verdict: evaluationVerdict ?? undefined,
      evaluation_error:
        evalParsed && evalParsed.kind === "fallback"
          ? evalParsed.data.razon
          : undefined,
      evaluation_schema_issues:
        evalParsed && evalParsed.kind === "fallback" && evalParsed._error
          ? evalParsed._error.zodError?.issues
          : undefined,
      evaluation_raw_preview:
        evalParsed && evalParsed.kind === "fallback" && evalParsed._error
          ? evalParsed._error.rawText
          : undefined,
      usage: {
        cotizacion: cotResult?.usage,
        evaluacion: evalResult?.usage,
      },
    },
    { status: 200 },
  );
}

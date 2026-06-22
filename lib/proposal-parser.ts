import { z } from "zod";
import {
  claudeResponseSchema,
  diagnosticoPreliminarSchema,
  proposalDataSchema,
  type ClaudeResponse,
  type DiagnosticoPreliminar,
  type ProposalData,
} from "@/prompts/cotizacion/schema";

export type ParsedClaude =
  | { kind: "proposal"; data: ProposalData }
  | { kind: "diagnostico_preliminar"; data: DiagnosticoPreliminar };

export class ProposalParseError extends Error {
  constructor(
    message: string,
    public readonly stage: "strip_fences" | "json_parse" | "schema_validate",
    public readonly rawText?: string,
    public readonly zodError?: z.ZodError,
  ) {
    super(message);
    this.name = "ProposalParseError";
  }
}

// Sanitiza salidas comunes de Claude: quita fences ```json``` si las metió,
// reemplaza em-dash (—) por dos puntos para honrar la regla del prompt
// (Claude los mete pese a la instrucción explícita), y trimea espacios.
export function sanitizeClaudeText(raw: string): string {
  let text = raw.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    text = text.trim();
  }
  // Em-dash es regla ZR explícita del DS y del prompt. Cinturón y tirantes.
  text = text.replaceAll("—", ":");
  return text;
}

export function parseClaudeResponse(rawText: string): ParsedClaude {
  const sanitized = sanitizeClaudeText(rawText);

  let parsed: unknown;
  try {
    parsed = JSON.parse(sanitized);
  } catch (error) {
    throw new ProposalParseError(
      `Claude no devolvió JSON válido: ${error instanceof Error ? error.message : String(error)}`,
      "json_parse",
      sanitized.slice(0, 500),
    );
  }

  const result = claudeResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new ProposalParseError(
      `El JSON de Claude no cumple el schema proposal_data v3.2.`,
      "schema_validate",
      sanitized.slice(0, 500),
      result.error,
    );
  }

  if (
    "status" in result.data &&
    result.data.status === "diagnostico_preliminar"
  ) {
    return { kind: "diagnostico_preliminar", data: result.data };
  }
  // Defensive: zod may pick either branch of the union. Re-validate against
  // proposalDataSchema to discriminate cleanly.
  const proposalResult = proposalDataSchema.safeParse(parsed);
  if (proposalResult.success) {
    return { kind: "proposal", data: proposalResult.data };
  }
  const diagResult = diagnosticoPreliminarSchema.safeParse(parsed);
  if (diagResult.success) {
    return { kind: "diagnostico_preliminar", data: diagResult.data };
  }
  throw new ProposalParseError(
    "El JSON validó la union pero no encaja en ninguna rama discriminada.",
    "schema_validate",
    sanitized.slice(0, 500),
  );
}

// Helper para tests / debug: detecta si el caso requiere Excel anexo según las
// mismas reglas que usa el flujo n8n.
export function shouldGenerateExcel(data: ClaudeResponse): boolean {
  if ("status" in data) return false;
  const inputs = data.calculadora_inputs;
  if (!inputs) return false;
  return (
    data.genera_excel_anexo === true &&
    inputs.unidades_totales > 0 &&
    inputs.ticket_promedio > 0 &&
    inputs.absorcion_meses > 0
  );
}

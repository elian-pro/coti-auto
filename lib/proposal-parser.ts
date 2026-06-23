import { z } from "zod";
import { safeJsonParse } from "@/lib/json-repair";
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

// Sanitiza salidas de Claude. Acepta tres formas comunes y devuelve el JSON
// listo para `JSON.parse`:
//   1. JSON desnudo: `{"foo": ...}` ← cotización (prompt v3.2 lo exige)
//   2. JSON en fences ```json ... ``` o ``` ... ```
//   3. Markdown narrativo seguido / precedido de JSON (caso del evaluador
//      v2.3 que entrega "reporte narrativo + JSON estructurado")
//
// También reemplaza em-dash (—) por dos puntos para honrar la regla del
// prompt y del DS (Claude los mete pese a la instrucción explícita).
export function sanitizeClaudeText(raw: string): string {
  let text = raw.trim();

  // Caso 2: fenced block. Buscar el bloque ```json``` (o ```...```) que
  // contenga un objeto. Preferimos el ÚLTIMO para responder a "narrativa +
  // JSON al final" (patrón del prompt evaluador v2.3).
  const fenceMatches = [
    ...text.matchAll(/```(?:json)?\s*\n?([\s\S]*?)\n?```/gi),
  ];
  for (const match of fenceMatches.reverse()) {
    const candidate = match[1].trim();
    if (candidate.startsWith("{") && candidate.endsWith("}")) {
      text = candidate;
      break;
    }
  }

  // Caso 3: si la respuesta sigue sin empezar con `{`, agarrar del primer
  // `{` hasta el último `}` (el JSON suele venir AL FINAL después del
  // markdown narrativo).
  if (!text.trim().startsWith("{")) {
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first !== -1 && last > first) {
      text = text.slice(first, last + 1);
    }
  }

  // Em-dash a dos puntos (regla ZR-02 + del prompt). Cinturón y tirantes.
  text = text.replaceAll("—", ":");

  return text.trim();
}

export function parseClaudeResponse(rawText: string): ParsedClaude {
  const sanitized = sanitizeClaudeText(rawText);

  let parsed: unknown;
  try {
    parsed = safeJsonParse(sanitized).data;
  } catch (error) {
    throw new ProposalParseError(
      `Claude no devolvió JSON válido: ${error instanceof Error ? error.message : String(error)}`,
      "json_parse",
      sanitized.slice(0, 12_000),
    );
  }

  const result = claudeResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new ProposalParseError(
      `El JSON de Claude no cumple el schema proposal_data v3.2.`,
      "schema_validate",
      sanitized.slice(0, 12_000),
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
    sanitized.slice(0, 12_000),
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

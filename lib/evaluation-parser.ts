import { z } from "zod";
import {
  evaluationFallbackSchema,
  evaluationResponseSchema,
  evaluationSchema,
  type EvaluationData,
  type EvaluationFallback,
} from "@/prompts/evaluacion/schema";
import { sanitizeClaudeText } from "@/lib/proposal-parser";

export type ParsedEvaluation =
  | { kind: "evaluation"; data: EvaluationData }
  | { kind: "fallback"; data: EvaluationFallback };

export class EvaluationParseError extends Error {
  constructor(
    message: string,
    public readonly stage: "json_parse" | "schema_validate",
    public readonly rawText?: string,
    public readonly zodError?: z.ZodError,
  ) {
    super(message);
    this.name = "EvaluationParseError";
  }
}

export function parseEvaluationResponse(rawText: string): ParsedEvaluation {
  const sanitized = sanitizeClaudeText(rawText);

  let parsed: unknown;
  try {
    parsed = JSON.parse(sanitized);
  } catch (error) {
    throw new EvaluationParseError(
      `El JSON del evaluador no se pudo parsear: ${error instanceof Error ? error.message : String(error)}`,
      "json_parse",
      sanitized.slice(0, 500),
    );
  }

  const result = evaluationResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new EvaluationParseError(
      "El JSON del evaluador no cumple el schema v2.3.",
      "schema_validate",
      sanitized.slice(0, 500),
      result.error,
    );
  }

  // Discriminar branch
  const fb = evaluationFallbackSchema.safeParse(parsed);
  if (fb.success) return { kind: "fallback", data: fb.data };
  const ev = evaluationSchema.safeParse(parsed);
  if (ev.success) return { kind: "evaluation", data: ev.data };

  throw new EvaluationParseError(
    "El JSON validó la union pero no encaja en ninguna rama discriminada.",
    "schema_validate",
    sanitized.slice(0, 500),
  );
}

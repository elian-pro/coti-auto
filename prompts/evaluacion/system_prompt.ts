// Loader del prompt evaluador v2.3 (mismo patrón que cotización).
import { readFileSync } from "node:fs";
import path from "node:path";

let cached: string | null = null;

export function loadEvalSystemPrompt(): string {
  if (cached) return cached;
  const file = path.join(process.cwd(), "prompts/evaluacion/system_prompt.md");
  cached = readFileSync(file, "utf8");
  return cached;
}

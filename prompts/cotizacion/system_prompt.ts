// Generated from system_prompt.md via build-time inline. Importing the raw
// markdown directly keeps the source human-editable while the runtime gets
// a static string suitable for caching.

import { readFileSync } from "node:fs";
import path from "node:path";

let cached: string | null = null;

export function loadSystemPrompt(): string {
  if (cached) return cached;
  const file = path.join(process.cwd(), "prompts/cotizacion/system_prompt.md");
  cached = readFileSync(file, "utf8");
  return cached;
}

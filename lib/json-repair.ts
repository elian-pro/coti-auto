import { jsonrepair } from "jsonrepair";

// Parse JSON con fallback automático a `jsonrepair`. Maneja los problemas
// comunes en outputs de LLM:
//   - comillas curly de español ("hola" en vez de "hola")
//   - comas trailing antes de } o ]
//   - saltos de línea literales dentro de strings
//   - comentarios // o /* */
//   - keys sin comillas
//   - apóstrofes en vez de comillas dobles
//
// Si JSON.parse natural pasa, lo usamos. Si truena, intentamos repair.
// Si el repair también truena, propagamos el error original (más útil
// para debug que el de repair).

export type SafeJsonParseResult = {
  data: unknown;
  repaired: boolean;
};

export function safeJsonParse(text: string): SafeJsonParseResult {
  try {
    return { data: JSON.parse(text), repaired: false };
  } catch (firstError) {
    try {
      const repaired = jsonrepair(text);
      return { data: JSON.parse(repaired), repaired: true };
    } catch {
      // Volvemos a tirar el error original (más informativo: dice posición).
      throw firstError;
    }
  }
}

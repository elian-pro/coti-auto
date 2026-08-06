// Coach: lee transcripciones recientes, le pide a Claude que sintetice
// objeciones/dudas recurrentes de los prospectos y consejos accionables
// para los vendedores. Cachea el resultado en `insights` por 24h.

import { z } from "zod";
import { callClaude, classifyAnthropicError } from "@/lib/anthropic";
import {
  getLatestInsight,
  getRecentTranscripts,
  saveInsight,
  type CoachTranscript,
} from "@/lib/db/quotes";
import { safeJsonParse } from "@/lib/json-repair";

// Cuántas llamadas recientes analiza el coach. Configurable por env para
// subirlo conforme se acumule historial (ej. 10, 25) sin tocar código.
const COACH_SAMPLE_SIZE = (() => {
  const raw = Number.parseInt(process.env.COACH_SAMPLE_SIZE ?? "5", 10);
  return Number.isFinite(raw) && raw > 0 ? Math.min(raw, 50) : 5;
})();

const MAX_CHARS_PER_TRANSCRIPT = 6_000; // recorta transcripciones muy largas

const insightsSchema = z.object({
  objeciones: z
    .array(
      z.object({
        objecion: z.string(),
        frecuencia: z.number().int().min(1),
        ejemplos: z.array(z.string()).max(3).default([]),
        como_abordarla: z.string(),
      }),
    )
    .default([]),
  patrones: z
    .array(
      z.object({
        titulo: z.string(),
        descripcion: z.string(),
      }),
    )
    .default([]),
  coaching: z.array(z.string()).default([]),
  sintesis: z.string().default(""),
});

export type InsightsContent = z.infer<typeof insightsSchema>;

const SYSTEM_PROMPT = `Eres un coach senior de ventas para Zebra High Performance Marketing.
Recibes múltiples transcripciones de llamadas de diagnóstico comercial recientes.
Tu único trabajo es identificar PATRONES entre todas ellas.

Salida obligatoria: un JSON válido con el schema exacto:

{
  "objeciones": [
    {
      "objecion": "string, la objeción o duda tal como la formula el prospecto",
      "frecuencia": number, cuántas transcripciones la mencionaron (aproximado, honesto),
      "ejemplos": ["cita textual 1", "cita textual 2"] máx 3,
      "como_abordarla": "consejo accionable de 2-3 líneas para el vendedor: cómo prevenirla, redirigirla o convertirla en oportunidad"
    }
  ],
  "patrones": [
    {
      "titulo": "nombre corto del patrón (ej. 'Autodiagnóstico agresivo del cliente')",
      "descripcion": "2-3 líneas describiendo qué pasa y qué implica para la venta"
    }
  ],
  "coaching": [
    "consejo 1 de coaching general, accionable",
    "consejo 2"
  ],
  "sintesis": "párrafo de 3-5 líneas resumiendo la salud comercial general que se observa"
}

Reglas duras:
- Máximo 6 objeciones, máximo 5 patrones, máximo 6 tips de coaching.
- Rankea por FRECUENCIA real observada, no por gravedad.
- No inventes objeciones que no aparezcan en las transcripciones.
- Cita textual sólo lo que esté literal en algún transcript.
- No uses em-dash (—). Usa coma, dos puntos o paréntesis.
- Primer carácter de la respuesta: {  Último: }  Nada más.`;

function buildUserContent(transcripts: CoachTranscript[]): string {
  const chunks = transcripts.map((t, i) => {
    const text = (t.transcript ?? "").slice(0, MAX_CHARS_PER_TRANSCRIPT);
    const verdict = t.evaluationVerdict ? ` · veredicto=${t.evaluationVerdict}` : "";
    const score =
      t.evaluationScore !== null && t.evaluationScore !== undefined
        ? ` · score=${t.evaluationScore}`
        : "";
    return `--- LLAMADA ${i + 1} · cuenta=${t.account}${verdict}${score} · fecha=${t.createdAt.toISOString().slice(0, 10)} ---\n${text}`;
  });
  return chunks.join("\n\n");
}

export type InsightsResult = {
  content: InsightsContent;
  nTranscripts: number;
  sampleSize: number;
  generatedAt: Date;
  fromCache: boolean;
  windowFrom: Date;
  windowTo: Date;
};

export async function generateOrGetInsights(): Promise<
  InsightsResult | { error: string; kind?: string }
> {
  // 1. Traer las últimas N transcripciones
  const rows = await getRecentTranscripts(COACH_SAMPLE_SIZE);
  if (rows.length === 0) {
    return {
      error:
        "Aún no hay transcripciones almacenadas. Genera algunas cotizaciones y vuelve.",
    };
  }

  // El lote va de la más vieja a la más nueva del set seleccionado.
  const windowTo = rows[0].createdAt; // rows viene DESC
  const windowFrom = rows[rows.length - 1].createdAt;

  // 2. Cache: sirve solo si el lote analizado es EXACTAMENTE el mismo.
  // Comparamos la transcripción más reciente y el conteo; si entró una
  // llamada nueva (o cambió COACH_SAMPLE_SIZE), regeneramos.
  const cached = await getLatestInsight();
  if (
    cached &&
    cached.nTranscripts === rows.length &&
    cached.windowTo.getTime() === windowTo.getTime()
  ) {
    const parsed = insightsSchema.safeParse(cached.content);
    if (parsed.success) {
      return {
        content: parsed.data,
        nTranscripts: cached.nTranscripts,
        sampleSize: COACH_SAMPLE_SIZE,
        generatedAt: cached.generatedAt,
        fromCache: true,
        windowFrom: cached.windowFrom,
        windowTo: cached.windowTo,
      };
    }
  }

  const userContent = buildUserContent(rows);

  // 3. Claude
  let rawText: string;
  try {
    const res = await callClaude({
      systemPrompt: SYSTEM_PROMPT,
      userContent,
      maxTokens: 4_000,
    });
    rawText = res.rawText;
  } catch (error) {
    const c = classifyAnthropicError(error);
    return { error: c.message, kind: c.kind };
  }

  // 4. Parsear + validar
  let obj: unknown;
  try {
    obj = safeJsonParse(rawText).data;
  } catch (error) {
    return {
      error: `Claude no devolvió JSON parseable: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  const parsed = insightsSchema.safeParse(obj);
  if (!parsed.success) {
    return {
      error: `El JSON del coach no cumple el schema. Issues: ${JSON.stringify(parsed.error.issues).slice(0, 300)}`,
    };
  }

  // 5. Guardar en cache y devolver
  await saveInsight({
    windowFrom,
    windowTo,
    nTranscripts: rows.length,
    content: parsed.data,
  });

  return {
    content: parsed.data,
    nTranscripts: rows.length,
    sampleSize: COACH_SAMPLE_SIZE,
    generatedAt: new Date(),
    fromCache: false,
    windowFrom,
    windowTo,
  };
}

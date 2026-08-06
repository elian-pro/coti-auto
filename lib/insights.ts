// Coach: lee transcripciones recientes, le pide a Claude que sintetice
// objeciones/dudas recurrentes de los prospectos y consejos accionables
// para los vendedores. Cachea el resultado en `insights` por 24h.

import { z } from "zod";
import { callClaude, classifyAnthropicError } from "@/lib/anthropic";
import {
  getLatestInsight,
  getRecentTranscripts,
  getTranscriptsSince,
  saveInsight,
  type CoachTranscript,
} from "@/lib/db/quotes";
import { safeJsonParse } from "@/lib/json-repair";

function envInt(name: string, fallback: number, cap: number): number {
  const raw = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(raw) && raw > 0 ? Math.min(raw, cap) : fallback;
}

// Criterio principal: llamadas de los últimos N días.
const COACH_WINDOW_DAYS = envInt("COACH_WINDOW_DAYS", 30, 365);
// Piso: si la ventana junta menos de esto, completamos con las más recientes
// aunque sean más viejas, para que /estus nunca salga vacío.
const COACH_MIN_SAMPLE = envInt("COACH_MIN_SAMPLE", 5, 50);
// Techo: tope duro para no reventar el tamaño del prompt.
const COACH_MAX_SAMPLE = envInt("COACH_MAX_SAMPLE", 25, 50);

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
  /** true = la ventana de días no alcanzó y se completó con las más recientes */
  usedFallback: boolean;
  windowDays: number;
  minSample: number;
  generatedAt: Date;
  fromCache: boolean;
  windowFrom: Date;
  windowTo: Date;
};

export async function generateOrGetInsights(): Promise<
  InsightsResult | { error: string; kind?: string }
> {
  const cutoff = new Date(
    Date.now() - COACH_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );

  // 1. Criterio principal: llamadas dentro de la ventana de días.
  let rows = await getTranscriptsSince(cutoff, COACH_MAX_SAMPLE);
  let usedFallback = false;

  // 2. Piso: si la ventana no junta suficiente material, tomamos las últimas
  // COACH_MIN_SAMPLE sin importar la fecha para que el coach no salga vacío.
  if (rows.length < COACH_MIN_SAMPLE) {
    const fallbackRows = await getRecentTranscripts(COACH_MIN_SAMPLE);
    if (fallbackRows.length > rows.length) {
      rows = fallbackRows;
      usedFallback = true;
    }
  }

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
        usedFallback,
        windowDays: COACH_WINDOW_DAYS,
        minSample: COACH_MIN_SAMPLE,
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
    usedFallback,
    windowDays: COACH_WINDOW_DAYS,
    minSample: COACH_MIN_SAMPLE,
    generatedAt: new Date(),
    fromCache: false,
    windowFrom,
    windowTo,
  };
}

import { and, desc, gte, sql } from "drizzle-orm";
import { ensureSchema, getDb, isDbEnabled } from "./client";
import { insights, quotes, type NewInsight, type NewQuote, type Quote } from "./schema";

// Guarda un run del /api/quote-direct. No lanza excepciones al caller —
// si Postgres no está disponible, loguea y sigue.
export async function saveQuoteRun(input: NewQuote): Promise<void> {
  if (!isDbEnabled()) return;
  try {
    await ensureSchema();
    const db = getDb();
    if (!db) return;
    await db.insert(quotes).values(input);
  } catch (error) {
    console.error(
      "[db] saveQuoteRun falló (persistencia opcional):",
      error instanceof Error ? error.message : String(error),
    );
  }
}

// Lista los últimos N runs (para la tabla de /estus).
export async function listRecentQuotes(limit = 50): Promise<Quote[]> {
  if (!isDbEnabled()) return [];
  try {
    await ensureSchema();
    const db = getDb();
    if (!db) return [];
    return await db
      .select()
      .from(quotes)
      .orderBy(desc(quotes.createdAt))
      .limit(limit);
  } catch (error) {
    console.error(
      "[db] listRecentQuotes falló:",
      error instanceof Error ? error.message : String(error),
    );
    return [];
  }
}

export type CoachTranscript = Pick<
  Quote,
  "id" | "createdAt" | "account" | "transcript" | "evaluationVerdict" | "evaluationScore"
>;

// Solo runs que sí guardaron transcripción.
const HAS_TRANSCRIPT = sql`${quotes.transcript} IS NOT NULL AND length(${quotes.transcript}) > 0`;

const COACH_COLUMNS = {
  id: quotes.id,
  createdAt: quotes.createdAt,
  account: quotes.account,
  transcript: quotes.transcript,
  evaluationVerdict: quotes.evaluationVerdict,
  evaluationScore: quotes.evaluationScore,
};

// Trae las últimas N transcripciones (sin filtro de fecha). Se usa como
// fallback cuando la ventana de días no junta material suficiente.
export async function getRecentTranscripts(
  limit: number,
): Promise<CoachTranscript[]> {
  if (!isDbEnabled()) return [];
  try {
    await ensureSchema();
    const db = getDb();
    if (!db) return [];
    return await db
      .select(COACH_COLUMNS)
      .from(quotes)
      .where(HAS_TRANSCRIPT)
      .orderBy(desc(quotes.createdAt))
      .limit(limit);
  } catch (error) {
    console.error(
      "[db] getRecentTranscripts falló:",
      error instanceof Error ? error.message : String(error),
    );
    return [];
  }
}

// Trae las transcripciones dentro de una ventana de fechas, topadas a `limit`.
export async function getTranscriptsSince(
  windowFrom: Date,
  limit: number,
): Promise<CoachTranscript[]> {
  if (!isDbEnabled()) return [];
  try {
    await ensureSchema();
    const db = getDb();
    if (!db) return [];
    return await db
      .select(COACH_COLUMNS)
      .from(quotes)
      .where(and(gte(quotes.createdAt, windowFrom), HAS_TRANSCRIPT))
      .orderBy(desc(quotes.createdAt))
      .limit(limit);
  } catch (error) {
    console.error(
      "[db] getTranscriptsSince falló:",
      error instanceof Error ? error.message : String(error),
    );
    return [];
  }
}

export type CachedInsight = {
  id: string;
  generatedAt: Date;
  windowFrom: Date;
  windowTo: Date;
  nTranscripts: number;
  content: unknown;
};

// Devuelve la fila de insights más reciente. La decisión de si sirve como
// cache la toma el caller (compara contra el lote actual de transcripciones).
export async function getLatestInsight(): Promise<CachedInsight | null> {
  if (!isDbEnabled()) return null;
  try {
    await ensureSchema();
    const db = getDb();
    if (!db) return null;
    const rows = await db
      .select()
      .from(insights)
      .orderBy(desc(insights.generatedAt))
      .limit(1);
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      id: row.id,
      generatedAt: row.generatedAt,
      windowFrom: row.windowFrom,
      windowTo: row.windowTo,
      nTranscripts: row.nTranscripts,
      content: row.content,
    };
  } catch (error) {
    console.error(
      "[db] getLatestInsight falló:",
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

export async function saveInsight(input: NewInsight): Promise<void> {
  if (!isDbEnabled()) return;
  try {
    await ensureSchema();
    const db = getDb();
    if (!db) return;
    await db.insert(insights).values(input);
  } catch (error) {
    console.error(
      "[db] saveInsight falló:",
      error instanceof Error ? error.message : String(error),
    );
  }
}

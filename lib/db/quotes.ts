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

// Trae solo las transcripciones dentro de una ventana, para alimentar al
// coach. Filtra runs sin transcript (por si algún día guardamos placeholders).
export async function getTranscriptsSince(
  windowFrom: Date,
): Promise<Pick<Quote, "id" | "createdAt" | "account" | "transcript" | "evaluationVerdict" | "evaluationScore">[]> {
  if (!isDbEnabled()) return [];
  try {
    await ensureSchema();
    const db = getDb();
    if (!db) return [];
    const rows = await db
      .select({
        id: quotes.id,
        createdAt: quotes.createdAt,
        account: quotes.account,
        transcript: quotes.transcript,
        evaluationVerdict: quotes.evaluationVerdict,
        evaluationScore: quotes.evaluationScore,
      })
      .from(quotes)
      .where(
        and(
          gte(quotes.createdAt, windowFrom),
          sql`${quotes.transcript} IS NOT NULL AND length(${quotes.transcript}) > 0`,
        ),
      )
      .orderBy(desc(quotes.createdAt));
    return rows;
  } catch (error) {
    console.error(
      "[db] getTranscriptsSince falló:",
      error instanceof Error ? error.message : String(error),
    );
    return [];
  }
}

// Cache lookup: la última fila de insights que cubre al menos hasta `since`
// y se generó hace menos de `maxAgeMs`. Si no existe, retorna null.
export async function getLatestInsightIfFresh(
  since: Date,
  maxAgeMs: number,
): Promise<{ id: string; generatedAt: Date; nTranscripts: number; content: unknown } | null> {
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
    const ageMs = Date.now() - row.generatedAt.getTime();
    if (ageMs > maxAgeMs) return null;
    // Si la ventana anterior no cubre el rango pedido, tampoco sirve.
    if (row.windowFrom > since) return null;
    return {
      id: row.id,
      generatedAt: row.generatedAt,
      nTranscripts: row.nTranscripts,
      content: row.content,
    };
  } catch (error) {
    console.error(
      "[db] getLatestInsightIfFresh falló:",
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

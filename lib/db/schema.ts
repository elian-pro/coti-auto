import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  index,
} from "drizzle-orm/pg-core";

// Cada run del /api/quote-direct queda archivado aquí. Nada bloqueante:
// la escritura se hace fire-and-forget al final de la petición.
export const quotes = pgTable(
  "quotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    // Input
    account: text("account").notNull(),
    meetingUrl: text("meeting_url").notNull(),
    userEmail: text("user_email"), // del OAuth de NextAuth (puede ser null si aún no obligábamos login)
    mode: text("mode").notNull(), // full | quote_only | eval_only

    // Contenido crudo
    transcript: text("transcript"), // texto plano del Doc
    proposalJson: jsonb("proposal_json"), // JSON validado de Claude cotización
    evaluationJson: jsonb("evaluation_json"), // JSON validado del evaluador

    // Salidas
    docsUrl: text("docs_url"),
    sheetsUrl: text("sheets_url"),
    pdfUrl: text("pdf_url"),
    evaluationUrl: text("evaluation_url"),

    // Denormalizado para queries rápidas
    evaluationScore: integer("evaluation_score"),
    evaluationVerdict: text("evaluation_verdict"), // no_cotizar | llenar_gaps | cotizar | excelente

    // Uso de tokens (sumado de ambas llamadas Claude)
    tokensInput: integer("tokens_input"),
    tokensOutput: integer("tokens_output"),

    // Si algo falló: qué stage y mensaje. Cuando status === 'ok', vacíos.
    status: text("status").notNull().default("ok"), // ok | error
    errorStage: text("error_stage"),
    errorMessage: text("error_message"),
  },
  (table) => ({
    createdAtIdx: index("quotes_created_at_idx").on(table.createdAt),
    accountIdx: index("quotes_account_idx").on(table.account),
    verdictIdx: index("quotes_verdict_idx").on(table.evaluationVerdict),
  }),
);

// Cache de insights agregados que se muestran en /estus. Cada corrida del
// coach guarda una fila con la ventana de fechas cubierta y el JSON producido
// por Claude, para no re-generar en cada visita.
export const insights = pgTable("insights", {
  id: uuid("id").primaryKey().defaultRandom(),
  generatedAt: timestamp("generated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  windowFrom: timestamp("window_from", { withTimezone: true }).notNull(),
  windowTo: timestamp("window_to", { withTimezone: true }).notNull(),
  nTranscripts: integer("n_transcripts").notNull(),
  content: jsonb("content").notNull(), // { objections, coaching, patterns, ... }
});

export type Quote = typeof quotes.$inferSelect;
export type NewQuote = typeof quotes.$inferInsert;
export type Insight = typeof insights.$inferSelect;
export type NewInsight = typeof insights.$inferInsert;

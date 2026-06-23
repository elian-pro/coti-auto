export type QuoteRequest = {
  account: string;
  meeting_url: string;
};

export type QuoteResult = {
  status?: string;
  account?: string;
  docs_url?: string;
  sheets_url?: string;
  pdf_url?: string;
  evaluation_url?: string;
  evaluation_status?: "ok" | "no_aplicable" | "skipped";
  evaluation_score?: number;
  evaluation_verdict?: "no_cotizar" | "llenar_gaps" | "cotizar" | "excelente";
  evaluation_error?: string;
  evaluation_schema_issues?: unknown;
  evaluation_raw_preview?: string;

  // Branch alterno: Claude devolvió diagnostico_preliminar porque la
  // transcripción no traía info mínima para cotizar.
  razon?: string;
  preguntas_criticas?: string[];
  lo_que_si_entendimos?: string;

  raw?: unknown;
};

export type QuoteError = {
  error: string;
  detail?: string;
};

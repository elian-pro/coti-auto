export type QuoteRequest = {
  account: string;
  meeting_url: string;
};

export type QuoteResult = {
  account?: string;
  docs_url?: string;
  sheets_url?: string;
  pdf_url?: string;
  raw?: unknown;
};

export type QuoteError = {
  error: string;
  detail?: string;
};

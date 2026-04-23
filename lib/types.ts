export type QuoteRequest = {
  account: string;
  meeting_url: string;
};

export type QuoteResult = {
  pdf_url?: string;
  docs_url?: string;
  account?: string;
  raw?: unknown;
};

export type QuoteError = {
  error: string;
  detail?: string;
};

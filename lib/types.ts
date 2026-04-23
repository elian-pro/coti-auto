export type QuoteRequest = {
  account: string;
  meeting_url: string;
};

export type QuoteResult = {
  account?: string;
  drive_url?: string;
  raw?: unknown;
};

export type QuoteError = {
  error: string;
  detail?: string;
};

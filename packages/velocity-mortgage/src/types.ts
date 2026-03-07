export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type VelocityRecord = Record<string, unknown>;

export interface VelocityRequestOptions {
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface VelocityGetDealsQuery {
  dealstatus?: string;
  customsource?: string;
  datetype?: number;
  startdate?: string;
  enddate?: string;
  loancode?: string;
  page?: number;
}

export interface VelocityConfig {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  apiKeyQueryParam: string;
}

export class VelocityApiError extends Error {
  readonly status: number;
  readonly url: string;
  readonly payload?: unknown;

  constructor(message: string, status: number, url: string, payload?: unknown) {
    super(message);
    this.name = "VelocityApiError";
    this.status = status;
    this.url = url;
    this.payload = payload;
  }
}

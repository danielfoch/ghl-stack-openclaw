import type { DdfConfig, HttpMethod } from "./types.js";
import { Semaphore, TokenBucket, sleep } from "./limiter.js";
import { urlJoin } from "./odata.js";

class DdfHttpError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly snippet?: string
  ) {
    super(message);
  }
}

type RequestOptions = {
  query?: Record<string, string>;
  headers?: Record<string, string>;
  body?: string;
};

function parseRetryAfterMs(value: string | null): number | undefined {
  if (!value) return undefined;
  const secs = Number(value);
  if (Number.isFinite(secs)) return Math.max(0, secs) * 1000;
  const at = Date.parse(value);
  if (Number.isNaN(at)) return undefined;
  return Math.max(0, at - Date.now());
}

function b64(value: string): string {
  return Buffer.from(value, "utf8").toString("base64");
}

export class DdfClient {
  private readonly semaphore: Semaphore;
  private readonly bucket: TokenBucket;

  private token?: { value: string; expEpochSec: number };
  private tokenFetch?: Promise<string>;

  constructor(private readonly cfg: DdfConfig) {
    this.semaphore = new Semaphore(cfg.concurrency);
    this.bucket = new TokenBucket(cfg.rps, cfg.burst);
  }

  async get(path: string, query?: Record<string, string>): Promise<unknown> {
    return this.requestWithAuth("GET", path, { query });
  }

  async request(
    method: HttpMethod,
    path: string,
    options: {
      query?: Record<string, string | number | boolean | null | undefined>;
      body?: Record<string, unknown> | null;
      auth?: boolean;
    } = {}
  ): Promise<unknown> {
    const query = options.query
      ? Object.fromEntries(
          Object.entries(options.query)
            .filter(([, v]) => v != null)
            .map(([k, v]) => [k, String(v)])
        )
      : undefined;

    if (options.auth === false) {
      return this.requestJson(method, path, {
        query,
        headers: {
          accept: "application/json"
        },
        body: options.body ? JSON.stringify(options.body) : undefined
      });
    }

    return this.requestWithAuth(method, path, {
      query,
      body: options.body ? JSON.stringify(options.body) : undefined,
      headers: options.body ? { "content-type": "application/json" } : undefined
    });
  }

  private async requestWithAuth(method: HttpMethod, path: string, options: RequestOptions): Promise<unknown> {
    const token = await this.getBearerToken();
    const headers: Record<string, string> = {
      accept: "application/json, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.1",
      authorization: `Bearer ${token}`,
      ...(this.cfg.userAgent ? { "user-agent": this.cfg.userAgent } : {}),
      ...(options.headers ?? {})
    };

    try {
      return await this.requestJson(method, path, { ...options, headers });
    } catch (error) {
      if (error instanceof DdfHttpError && error.statusCode === 401) {
        this.token = undefined;
        const refreshed = await this.getBearerToken();
        const retryHeaders = { ...headers, authorization: `Bearer ${refreshed}` };
        return this.requestJson(method, path, { ...options, headers: retryHeaders });
      }
      throw error;
    }
  }

  private async requestJson(method: HttpMethod, path: string, options: RequestOptions): Promise<unknown> {
    const maxRetries = this.cfg.retries;
    let attempt = 0;

    while (true) {
      const release = await this.semaphore.acquire();
      let retryAfterMs: number | undefined;

      try {
        await this.bucket.take();
        const url = this.makeUrl(path, options.query);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.cfg.timeoutMs);
        const response = await fetch(url, {
          method,
          headers: options.headers,
          body: options.body,
          signal: controller.signal
        });
        clearTimeout(timeout);

        const text = await response.text();

        if (response.status >= 400) {
          retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
          throw new DdfHttpError(
            `HTTP ${response.status}`,
            response.status,
            text.slice(0, 1000)
          );
        }

        if (!text) return null;

        try {
          return JSON.parse(text);
        } catch {
          return text;
        }
      } catch (error) {
        const statusCode = error instanceof DdfHttpError ? error.statusCode : undefined;
        const retryable = statusCode == null || statusCode === 429 || (statusCode >= 500 && statusCode <= 599);

        if (!retryable || attempt >= maxRetries) {
          throw error;
        }

        attempt += 1;
        const baseDelay = 250 * Math.pow(2, attempt - 1);
        const jitter = Math.floor(Math.random() * 100);
        await sleep(Math.max(retryAfterMs ?? 0, baseDelay + jitter));
      } finally {
        release();
      }
    }
  }

  private async getBearerToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.token && this.token.expEpochSec - 60 > now) {
      return this.token.value;
    }

    if (this.tokenFetch) {
      return this.tokenFetch;
    }

    this.tokenFetch = this.fetchToken();
    try {
      return await this.tokenFetch;
    } finally {
      this.tokenFetch = undefined;
    }
  }

  private async fetchToken(): Promise<string> {
    const params = new URLSearchParams();
    params.set("grant_type", this.cfg.tokenGrant);
    if (this.cfg.scope) params.set("scope", this.cfg.scope);

    if (this.cfg.tokenGrant === "password") {
      if (!this.cfg.username || !this.cfg.password) {
        throw new Error("Username/password are required for password grant");
      }
      params.set("username", this.cfg.username);
      params.set("password", this.cfg.password);
    }

    const headers: Record<string, string> = {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
      ...(this.cfg.userAgent ? { "user-agent": this.cfg.userAgent } : {})
    };

    if (this.cfg.clientId && this.cfg.clientSecret) {
      if (this.cfg.authUseBasic) {
        headers.authorization = `Basic ${b64(`${this.cfg.clientId}:${this.cfg.clientSecret}`)}`;
      } else {
        params.set("client_id", this.cfg.clientId);
        params.set("client_secret", this.cfg.clientSecret);
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.cfg.timeoutMs);
    const response = await fetch(this.cfg.authUrl, {
      method: "POST",
      headers,
      body: params.toString(),
      signal: controller.signal
    });
    clearTimeout(timeout);

    const text = await response.text();
    if (response.status >= 400) {
      throw new DdfHttpError(`Auth failed with ${response.status}`, response.status, text.slice(0, 1000));
    }

    const payload = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    const token = payload.access_token;
    const expiresIn = Number(payload.expires_in ?? 3600);

    if (typeof token !== "string" || !Number.isFinite(expiresIn)) {
      throw new Error("Auth response missing access_token/expires_in");
    }

    this.token = { value: token, expEpochSec: Math.floor(Date.now() / 1000) + expiresIn };
    return token;
  }

  private makeUrl(path: string, query?: Record<string, string>): string {
    const url = new URL(urlJoin(this.cfg.baseUrl, path));
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        url.searchParams.set(key, value);
      }
    }
    return url.toString();
  }
}

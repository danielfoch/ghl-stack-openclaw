import { request } from "undici";
import type { Config, TokenGrant } from "./config.js";
import { sleep, Semaphore, TokenBucket } from "./limiter.js";
import { urlJoin } from "./odata.js";

export class DdfHttpError extends Error {
  statusCode?: number;
  responseSnippet?: string;
  constructor(message: string, opts?: { statusCode?: number; responseSnippet?: string }) {
    super(message);
    this.name = "DdfHttpError";
    this.statusCode = opts?.statusCode;
    this.responseSnippet = opts?.responseSnippet;
  }
}

function b64(s: string) {
  return Buffer.from(s, "utf8").toString("base64");
}

type TokenCacheEntry = { token: string; expEpochSec: number };

function redactTokenLikeFields(obj: any) {
  if (!obj || typeof obj !== "object") return obj;
  const clone: any = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof k === "string" && /token/i.test(k)) clone[k] = "***";
    else clone[k] = v;
  }
  return clone;
}

function parseRetryAfterMs(h: unknown): number | undefined {
  if (Array.isArray(h)) return parseRetryAfterMs(h[0]);
  if (typeof h !== "string" || !h.trim()) return undefined;
  const s = h.trim();
  const secs = Number(s);
  if (Number.isFinite(secs)) return Math.max(0, secs) * 1000;
  const dt = Date.parse(s);
  if (!Number.isFinite(dt)) return undefined;
  return Math.max(0, dt - Date.now());
}

export class DdfClient {
  private tokenCache: TokenCacheEntry | null = null;
  private tokenSingleFlight: Promise<string> | null = null;

  private semaphore: Semaphore;
  private bucket: TokenBucket;

  constructor(private cfg: Config) {
    this.semaphore = new Semaphore(cfg.DDF_HTTP_CONCURRENCY);
    this.bucket = new TokenBucket(cfg.DDF_HTTP_RPS, cfg.DDF_HTTP_BURST);
  }

  invalidateToken() {
    this.tokenCache = null;
  }

  async get(path: string, query?: Record<string, string>) {
    return this.requestWithAuth("GET", path, { query });
  }

  private async requestWithAuth(
    method: "GET" | "POST",
    pathOrUrl: string,
    opts: { query?: Record<string, string>; headers?: Record<string, string>; body?: string }
  ) {
    const token = await this.getBearerToken();
    const headers: Record<string, string> = {
      accept: "application/json, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.1",
      authorization: `Bearer ${token}`,
      ...(this.cfg.DDF_USER_AGENT ? { "user-agent": this.cfg.DDF_USER_AGENT } : {}),
      ...(opts.headers ?? {}),
    };
    return this.requestJson(method, pathOrUrl, { ...opts, headers }, { retry401: true });
  }

  private async requestJson(
    method: "GET" | "POST",
    pathOrUrl: string,
    opts: { query?: Record<string, string>; headers?: Record<string, string>; body?: string },
    state: { retry401: boolean }
  ): Promise<unknown> {
    const maxRetries = Math.max(0, Math.floor(this.cfg.DDF_HTTP_RETRIES));
    let transientAttempts = 0;
    let allow401Refresh = state.retry401;

    while (true) {
      const release = await this.semaphore.acquire();
      let action: "return" | "retry" | "refresh" = "return";
      let result: unknown = null;
      let delayMs: number | undefined;

      try {
        await this.bucket.take();
        const u = this.toUrl(pathOrUrl, opts.query);

        const resp = await request(u, {
          method,
          headers: opts.headers,
          body: opts.body,
          bodyTimeout: this.cfg.DDF_HTTP_TIMEOUT_MS,
          headersTimeout: this.cfg.DDF_HTTP_TIMEOUT_MS,
        });

        const status = resp.statusCode;
        const retryAfter = parseRetryAfterMs((resp.headers as any)?.["retry-after"]);
        const text = await resp.body.text();

        if (status === 401 && allow401Refresh) {
          allow401Refresh = false;
          action = "refresh";
        } else if (status === 429 || (status >= 500 && status <= 599)) {
          if (transientAttempts < maxRetries) {
            transientAttempts += 1;
            action = "retry";
            const baseDelay = 250 * Math.pow(2, transientAttempts - 1);
            const jitter = Math.floor(Math.random() * 150);
            delayMs = retryAfter != null ? retryAfter : baseDelay + jitter;
          } else {
            throw new DdfHttpError(`HTTP ${status}`, { statusCode: status, responseSnippet: text.slice(0, 1200) });
          }
        } else if (status >= 400) {
          throw new DdfHttpError(`HTTP ${status}`, { statusCode: status, responseSnippet: text.slice(0, 1200) });
        } else {
          if (!text) {
            result = null;
          } else {
            try {
              result = JSON.parse(text);
            } catch {
              result = text;
            }
          }
          action = "return";
        }
      } catch (e: any) {
        const status = e instanceof DdfHttpError ? e.statusCode : undefined;
        const retryable = status == null || status === 429 || (status >= 500 && status <= 599);
        if (retryable && transientAttempts < maxRetries) {
          transientAttempts += 1;
          action = "retry";
          const baseDelay = 250 * Math.pow(2, transientAttempts - 1);
          const jitter = Math.floor(Math.random() * 150);
          delayMs = baseDelay + jitter;
        } else {
          throw e;
        }
      } finally {
        release();
      }

      if (action === "return") return result;

      if (action === "refresh") {
        this.invalidateToken();
        const newToken = await this.getBearerToken();
        opts.headers = { ...(opts.headers ?? {}), authorization: `Bearer ${newToken}` };
        continue;
      }

      await sleep(Math.max(0, delayMs ?? 0));
    }
  }

  private toUrl(pathOrUrl: string, query?: Record<string, string>) {
    const u =
      pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")
        ? new URL(pathOrUrl)
        : new URL(urlJoin(this.cfg.DDF_BASE_URL, pathOrUrl));
    if (query) for (const [k, v] of Object.entries(query)) u.searchParams.set(k, v);
    return u.toString();
  }

  private async getBearerToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.tokenCache && this.tokenCache.expEpochSec - 60 > now) return this.tokenCache.token;

    if (this.tokenSingleFlight) return this.tokenSingleFlight;
    this.tokenSingleFlight = this.fetchToken().finally(() => {
      this.tokenSingleFlight = null;
    });
    return this.tokenSingleFlight;
  }

  private async fetchToken(): Promise<string> {
    const grant: TokenGrant = this.cfg.DDF_TOKEN_GRANT;
    const body = new URLSearchParams();
    body.set("grant_type", grant);
    if (this.cfg.DDF_SCOPE) body.set("scope", this.cfg.DDF_SCOPE);

    const hasClient = !!(this.cfg.DDF_CLIENT_ID && this.cfg.DDF_CLIENT_SECRET);
    const headers: Record<string, string> = {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
      ...(this.cfg.DDF_USER_AGENT ? { "user-agent": this.cfg.DDF_USER_AGENT } : {}),
    };

    if (grant === "password") {
      if (!this.cfg.DDF_USERNAME || !this.cfg.DDF_PASSWORD) {
        throw new Error("DDF_TOKEN_GRANT=password requires DDF_USERNAME and DDF_PASSWORD");
      }
      body.set("username", this.cfg.DDF_USERNAME);
      body.set("password", this.cfg.DDF_PASSWORD);
    }

    if (hasClient && this.cfg.DDF_AUTH_USE_BASIC) {
      headers.authorization = `Basic ${b64(`${this.cfg.DDF_CLIENT_ID}:${this.cfg.DDF_CLIENT_SECRET}`)}`;
    } else if (hasClient) {
      body.set("client_id", this.cfg.DDF_CLIENT_ID!);
      body.set("client_secret", this.cfg.DDF_CLIENT_SECRET!);
    }

    // Token calls should not be rate-limited as aggressively as data calls, but still respect concurrency.
    const release = await this.semaphore.acquire();
    try {
      const resp = await request(this.cfg.DDF_AUTH_URL, {
        method: "POST",
        headers,
        body: body.toString(),
        bodyTimeout: this.cfg.DDF_HTTP_TIMEOUT_MS,
        headersTimeout: this.cfg.DDF_HTTP_TIMEOUT_MS,
      });
      const text = await resp.body.text();
      const status = resp.statusCode;

      if (status >= 400) {
        throw new DdfHttpError(`Token HTTP ${status}`, { statusCode: status, responseSnippet: text.slice(0, 1200) });
      }

      let json: any = null;
      if (text) {
        try {
          json = JSON.parse(text);
        } catch {
          throw new Error(`Token response was not valid JSON: ${text.slice(0, 1200)}`);
        }
      }
      const token = json?.access_token;
      const expiresIn = Number(json?.expires_in ?? 3600);
      if (!token || !Number.isFinite(expiresIn)) {
        throw new Error(
          `Token response missing access_token/expires_in: ${JSON.stringify(redactTokenLikeFields(json)).slice(0, 1200)}`
        );
      }

      const exp = Math.floor(Date.now() / 1000) + expiresIn;
      this.tokenCache = { token, expEpochSec: exp };
      return token;
    } finally {
      release();
    }
  }
}

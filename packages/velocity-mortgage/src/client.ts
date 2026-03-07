import { VelocityApiError, VelocityConfig, VelocityGetDealsQuery, VelocityRequestOptions } from "./types.js";

export class VelocityClient {
  constructor(private readonly cfg: VelocityConfig) {}

  createContact(payload: Record<string, unknown>) {
    return this.request<unknown>("POST", "/v1/contacts/contact", { body: payload });
  }

  getSampleContact() {
    return this.request<unknown>("GET", "/v1/contacts/contact/sample");
  }

  createDeal(payload: Record<string, unknown>) {
    return this.request<unknown>("POST", "/v1/deals/deal", { body: payload });
  }

  getSampleDeal() {
    return this.request<unknown>("GET", "/v1/deals/deal/sample");
  }

  getDeals(query: VelocityGetDealsQuery) {
    return this.request<unknown>("GET", "/v1/deals", { query: { ...query } });
  }

  searchDeals(payload: Record<string, unknown>) {
    return this.request<unknown>("POST", "/v1/deals/search", { body: payload });
  }

  async request<T = unknown>(
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    path: string,
    options: VelocityRequestOptions = {}
  ): Promise<T> {
    const url = this.buildUrl(path, options.query);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.cfg.timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          Accept: "application/json",
          ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...(options.headers ?? {})
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal
      });

      const rawBody = await response.text();
      const parsedBody = tryParseJson(rawBody);

      if (!response.ok) {
        const message =
          typeof parsedBody === "string"
            ? parsedBody
            : `Velocity API request failed with status ${response.status}`;
        throw new VelocityApiError(message, response.status, url, parsedBody);
      }

      if (parsedBody === undefined || parsedBody === null || parsedBody === "") {
        return undefined as T;
      }

      return parsedBody as T;
    } catch (error) {
      if (error instanceof VelocityApiError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Velocity API request timed out after ${this.cfg.timeoutMs}ms`);
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildUrl(
    path: string,
    query: Record<string, string | number | boolean | null | undefined> = {}
  ): string {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const base = new URL(this.cfg.baseUrl.endsWith("/") ? this.cfg.baseUrl : `${this.cfg.baseUrl}/`);
    const url = new URL(normalizedPath.slice(1), base);

    url.searchParams.set(this.cfg.apiKeyQueryParam, this.cfg.apiKey);

    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) {
        continue;
      }
      url.searchParams.set(key, String(value));
    }

    return url.toString();
  }
}

function tryParseJson(body: string): unknown {
  if (!body || !body.trim()) {
    return undefined;
  }

  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

import { BridgeProviderName, OpenClawBridgeEvent, PullRequest } from "../types.js";
import { ProviderAdapter, ProviderHealth } from "./interfaces.js";

type HttpJsonProviderConfig = {
  provider: BridgeProviderName;
  baseUrl?: string;
  apiKey?: string;
  pullPath: string;
  pushPath: string;
};

export class HttpJsonProvider implements ProviderAdapter {
  readonly name: BridgeProviderName;

  constructor(private readonly cfg: HttpJsonProviderConfig) {
    this.name = cfg.provider;
  }

  async healthCheck(): Promise<ProviderHealth> {
    if (!this.cfg.baseUrl) {
      return {
        provider: this.name,
        ok: false,
        detail: `${this.name} base URL is not configured`
      };
    }

    try {
      await this.request("GET", this.cfg.pullPath);
      return {
        provider: this.name,
        ok: true,
        detail: `${this.name} endpoint reachable`
      };
    } catch (error) {
      return {
        provider: this.name,
        ok: false,
        detail: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async pull(input: PullRequest) {
    const q = new URLSearchParams();
    q.set("resource", input.resource);
    if (input.filter) {
      q.set("filter", input.filter);
    }
    if (input.cursor) {
      q.set("cursor", input.cursor);
    }
    if (input.limit) {
      q.set("limit", String(input.limit));
    }

    const response = await this.request(
      "GET",
      `${this.cfg.pullPath}${q.size ? `?${q.toString()}` : ""}`
    );

    const records =
      response && typeof response === "object" && Array.isArray((response as any).records)
        ? ((response as any).records as unknown[])
        : Array.isArray(response)
          ? response
          : [];

    return {
      provider: this.name,
      resource: input.resource,
      records,
      nextCursor:
        response && typeof response === "object"
          ? ((response as Record<string, unknown>).nextCursor as string | undefined)
          : undefined,
      raw: response
    };
  }

  async push(event: OpenClawBridgeEvent) {
    const response = await this.request("POST", this.cfg.pushPath, event);
    return {
      provider: this.name,
      accepted: true,
      response
    };
  }

  private async request(
    method: "GET" | "POST",
    path: string,
    payload?: unknown
  ): Promise<unknown> {
    if (!this.cfg.baseUrl) {
      throw new Error(`Missing base URL for provider ${this.name}`);
    }

    const url = new URL(path, this.cfg.baseUrl);
    const headers: Record<string, string> = {
      Accept: "application/json"
    };

    if (payload !== undefined) {
      headers["content-type"] = "application/json";
    }

    if (this.cfg.apiKey) {
      headers["x-api-key"] = this.cfg.apiKey;
      headers.Authorization = `Bearer ${this.cfg.apiKey}`;
    }

    const res = await fetch(url, {
      method,
      headers,
      body: payload === undefined ? undefined : JSON.stringify(payload)
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`${this.name} ${method} ${url.pathname} failed (${res.status}): ${body}`);
    }

    const body = await res.text();
    if (!body) {
      return { ok: true };
    }

    try {
      return JSON.parse(body) as unknown;
    } catch {
      return { raw: body };
    }
  }
}

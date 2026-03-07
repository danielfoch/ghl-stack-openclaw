import { NewtonLinkConfig } from "./config.js";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type JsonObject = { [key: string]: JsonValue };

type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
};

export class NewtonLinkApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly statusText: string,
    readonly body: unknown
  ) {
    super(message);
  }
}

export class NewtonLinkClient {
  private accessToken?: string;
  private expiresAtMs = 0;

  constructor(private readonly cfg: NewtonLinkConfig) {}

  async getToken(forceRefresh = false): Promise<{ token: string; expiresAtMs: number }> {
    if (!forceRefresh && this.accessToken && Date.now() < this.expiresAtMs - 30_000) {
      return { token: this.accessToken, expiresAtMs: this.expiresAtMs };
    }

    const params = new URLSearchParams({
      grant_type: "client_credentials",
      scope: this.cfg.NEWTON_LINK_SCOPE,
      client_id: this.cfg.NEWTON_LINK_CLIENT_ID,
      client_secret: this.cfg.NEWTON_LINK_CLIENT_SECRET
    });

    const response = await fetch(this.cfg.NEWTON_LINK_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params,
      signal: AbortSignal.timeout(this.cfg.NEWTON_LINK_TIMEOUT_MS)
    });

    const body = (await response.json()) as TokenResponse | Record<string, unknown>;

    if (!response.ok) {
      throw new NewtonLinkApiError(
        "Newton token request failed",
        response.status,
        response.statusText,
        body
      );
    }

    const tokenResponse = body as TokenResponse;
    this.accessToken = tokenResponse.access_token;
    this.expiresAtMs = Date.now() + tokenResponse.expires_in * 1000;

    return {
      token: this.accessToken,
      expiresAtMs: this.expiresAtMs
    };
  }

  async get(pathname: string, query: Record<string, string | undefined>) {
    const queryParams = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        queryParams.set(key, value);
      }
    }

    const url = `${this.cfg.NEWTON_LINK_BASE_URL}${pathname}?${queryParams.toString()}`;
    return this.request("GET", url);
  }

  async post(pathname: string, body: JsonObject) {
    const url = `${this.cfg.NEWTON_LINK_BASE_URL}${pathname}`;
    return this.request("POST", url, body);
  }

  private async request(method: "GET" | "POST", url: string, body?: JsonObject) {
    const { token } = await this.getToken();

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(method === "POST" ? { "Content-Type": "application/json" } : {})
      },
      body: method === "POST" ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(this.cfg.NEWTON_LINK_TIMEOUT_MS)
    });

    const contentType = response.headers.get("content-type") ?? "";
    const parsedBody = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      throw new NewtonLinkApiError(
        `Newton API request failed (${method} ${url})`,
        response.status,
        response.statusText,
        parsedBody
      );
    }

    return parsedBody;
  }
}

export type { JsonObject, JsonValue };

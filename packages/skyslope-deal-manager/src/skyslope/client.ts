import type { AppConfig } from "../config.js";

export class SkySlopeClient {
  private accessToken?: string;
  private accessTokenExpiresAt = 0;

  constructor(private readonly cfg: AppConfig) {}

  private interpolate(pathTemplate: string, params: Record<string, string>): string {
    let out = pathTemplate;
    for (const [key, value] of Object.entries(params)) {
      out = out.replace(`{${key}}`, encodeURIComponent(value));
    }
    return out;
  }

  private async ensureAccessToken(): Promise<string> {
    if (!this.cfg.SKY_SLOPE_CLIENT_ID || !this.cfg.SKY_SLOPE_CLIENT_SECRET) {
      throw new Error(
        "SkySlope credentials missing. Set SKY_SLOPE_CLIENT_ID and SKY_SLOPE_CLIENT_SECRET."
      );
    }

    if (this.accessToken && Date.now() < this.accessTokenExpiresAt - 60_000) {
      return this.accessToken;
    }

    const tokenUrl = new URL(
      this.cfg.SKY_SLOPE_TOKEN_URL,
      this.cfg.SKY_SLOPE_BASE_URL
    ).toString();

    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.cfg.SKY_SLOPE_CLIENT_ID,
      client_secret: this.cfg.SKY_SLOPE_CLIENT_SECRET,
      ...(this.cfg.SKY_SLOPE_SCOPE ? { scope: this.cfg.SKY_SLOPE_SCOPE } : {})
    });

    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });

    if (!res.ok) {
      const bodyText = await res.text();
      throw new Error(`SkySlope auth failed (${res.status}): ${bodyText}`);
    }

    const json = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
    };

    if (!json.access_token) {
      throw new Error("SkySlope auth response missing access_token.");
    }

    this.accessToken = json.access_token;
    this.accessTokenExpiresAt = Date.now() + (json.expires_in ?? 3600) * 1000;
    return this.accessToken;
  }

  async request(path: string, init?: RequestInit): Promise<unknown> {
    const token = await this.ensureAccessToken();
    const url = new URL(path, this.cfg.SKY_SLOPE_BASE_URL).toString();
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {})
      }
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`SkySlope request failed (${res.status}): ${body}`);
    }

    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return res.json();
    }

    return res.text();
  }

  async getTransaction(transactionId: string): Promise<unknown> {
    const path = this.interpolate(this.cfg.SKY_SLOPE_TRANSACTIONS_PATH, {
      transactionId
    });
    return this.request(path);
  }

  async listTransactionFiles(transactionId: string): Promise<unknown> {
    const path = this.interpolate(this.cfg.SKY_SLOPE_FILES_PATH, {
      transactionId
    });
    return this.request(path);
  }

  async getFileContent(fileId: string): Promise<ArrayBuffer> {
    const token = await this.ensureAccessToken();
    const path = this.interpolate(this.cfg.SKY_SLOPE_FILE_CONTENT_PATH, { fileId });
    const url = new URL(path, this.cfg.SKY_SLOPE_BASE_URL).toString();
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    if (!res.ok) {
      throw new Error(`SkySlope file download failed (${res.status})`);
    }
    return res.arrayBuffer();
  }
}

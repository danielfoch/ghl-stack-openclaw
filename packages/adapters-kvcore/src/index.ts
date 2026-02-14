import { z } from "zod";

export const kvCoreConfigSchema = z.object({
  KVCORE_BASE_URL: z.string().url().default("https://api.kvcore.com"),
  KVCORE_API_TOKEN: z.string().min(8),
  KVCORE_TIMEOUT_MS: z.coerce.number().int().positive().default(30000)
});

export type KvCoreConfig = z.infer<typeof kvCoreConfigSchema>;

export function loadKvCoreConfig(env: NodeJS.ProcessEnv = process.env): KvCoreConfig {
  return kvCoreConfigSchema.parse(env);
}

export type KvCoreRequest = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
};

export type TwilioConfig = {
  accountSid: string;
  authToken: string;
  from: string;
};

export class KvCoreAdapter {
  constructor(private readonly config: KvCoreConfig) {}

  async searchContacts(query?: string, page?: number, perPage?: number): Promise<unknown> {
    return this.request({
      method: "GET",
      path: "/v2/public/contacts",
      query: {
        search: query,
        page,
        per_page: perPage
      }
    });
  }

  async getContact(contactId: number): Promise<unknown> {
    return this.request({ method: "GET", path: `/v2/public/contact/${contactId}` });
  }

  async createContact(payload: Record<string, unknown>): Promise<unknown> {
    return this.request({ method: "POST", path: "/v2/public/contact", body: payload });
  }

  async updateContact(contactId: number, payload: Record<string, unknown>): Promise<unknown> {
    return this.request({ method: "PUT", path: `/v2/public/contact/${contactId}`, body: payload });
  }

  async addTags(contactId: number, tags: string[]): Promise<unknown> {
    return this.request({ method: "PUT", path: `/v2/public/contact/${contactId}/tags`, body: { tags } });
  }

  async removeTags(contactId: number, tags: string[]): Promise<unknown> {
    return this.request({ method: "DELETE", path: `/v2/public/contact/${contactId}/tags`, body: { tags } });
  }

  async listNotes(contactId: number): Promise<unknown> {
    return this.request({ method: "GET", path: `/v2/public/contact/${contactId}/action/note` });
  }

  async addNote(contactId: number, note: string): Promise<unknown> {
    return this.request({
      method: "PUT",
      path: `/v2/public/contact/${contactId}/action/note`,
      body: { note }
    });
  }

  async logCall(contactId: number, payload: Record<string, unknown>): Promise<unknown> {
    return this.request({ method: "PUT", path: `/v2/public/contact/${contactId}/action/call`, body: payload });
  }

  async sendText(contactId: number, message: string): Promise<unknown> {
    return this.request({ method: "PUT", path: `/v2/public/contact/${contactId}/text`, body: { message } });
  }

  async sendEmail(contactId: number, subject: string, message: string): Promise<unknown> {
    return this.request({
      method: "PUT",
      path: `/v2/public/contact/${contactId}/email`,
      body: { subject, message }
    });
  }

  async scheduleCall(payload: Record<string, unknown>): Promise<unknown> {
    return this.request({ method: "POST", path: "/v2/public/schedule-call", body: payload });
  }

  async getUserTasks(userId: number): Promise<unknown> {
    return this.request({ method: "GET", path: `/v2/public/user/${userId}/tasks` });
  }

  async getUserCalls(userId: number): Promise<unknown> {
    return this.request({ method: "GET", path: `/v2/public/user/${userId}/calls` });
  }

  async refreshCampaigns(): Promise<unknown> {
    return this.request({ method: "PUT", path: "/v2/public/superaccount/campaigns/refresh" });
  }

  async raw(request: KvCoreRequest): Promise<unknown> {
    return this.request(request);
  }

  private async request(input: KvCoreRequest): Promise<unknown> {
    const url = new URL(input.path, this.config.KVCORE_BASE_URL);
    if (input.query) {
      for (const [key, value] of Object.entries(input.query)) {
        if (value === undefined || value === null) continue;
        url.searchParams.set(key, String(value));
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.KVCORE_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: input.method,
        headers: {
          Authorization: `Bearer ${this.config.KVCORE_API_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: input.body === undefined ? undefined : JSON.stringify(input.body),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`KVcore ${input.method} ${url.pathname} failed (${response.status}): ${errorText}`);
      }

      if (response.status === 204) return { ok: true };

      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
      if (!contentType.includes("application/json")) {
        return {
          ok: true,
          status: response.status,
          text: await response.text()
        };
      }

      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }
}

export async function createTwilioCall(
  cfg: TwilioConfig,
  input: { to: string; twimlUrl?: string; twiml?: string }
): Promise<{ sid: string; status: string; to: string; from: string }> {
  if (!input.twimlUrl && !input.twiml) {
    throw new Error("Provide twimlUrl or twiml");
  }

  const form = new URLSearchParams();
  form.set("To", input.to);
  form.set("From", cfg.from);
  if (input.twimlUrl) form.set("Url", input.twimlUrl);
  if (input.twiml) form.set("Twiml", input.twiml);

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${cfg.accountSid}/Calls.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: form.toString()
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Twilio call create failed (${response.status}): ${text}`);
  }

  const body = (await response.json()) as Record<string, unknown>;
  return {
    sid: String(body.sid ?? ""),
    status: String(body.status ?? "queued"),
    to: String(body.to ?? input.to),
    from: String(body.from ?? cfg.from)
  };
}

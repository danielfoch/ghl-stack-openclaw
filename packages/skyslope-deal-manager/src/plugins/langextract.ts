import type { LangExtractPlugin } from "./interfaces.js";

export class HttpLangExtractPlugin implements LangExtractPlugin {
  constructor(
    private readonly endpoint?: string,
    private readonly apiKey?: string
  ) {}

  async extractStructured(text: string): Promise<Record<string, unknown>> {
    if (!this.endpoint) {
      return {
        summary: text.slice(0, 1200),
        fallback: true
      };
    }

    const res = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {})
      },
      body: JSON.stringify({ text })
    });

    if (!res.ok) {
      throw new Error(`langextract request failed: ${res.status}`);
    }

    return (await res.json()) as Record<string, unknown>;
  }
}

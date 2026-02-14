import type { NanoPdfAuthoringPlugin } from "./interfaces.js";

export class GeminiNanoPdfAuthoring implements NanoPdfAuthoringPlugin {
  constructor(
    private readonly apiKey?: string,
    private readonly model = "gemini-2.0-flash"
  ) {}

  async authorDocument(input: {
    title: string;
    instructions: string;
    context?: string;
  }): Promise<{ markdown: string }> {
    if (!this.apiKey) {
      return {
        markdown: `# ${input.title}\n\n${input.instructions}\n\n${input.context ?? ""}`
      };
    }

    const prompt = [
      `Draft a concise real-estate transaction document in markdown.`,
      `Title: ${input.title}`,
      `Instructions: ${input.instructions}`,
      input.context ? `Context: ${input.context}` : ""
    ]
      .filter(Boolean)
      .join("\n");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    if (!res.ok) {
      throw new Error(`Gemini request failed: ${res.status}`);
    }

    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    const text =
      json.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("\n") ?? "";

    return { markdown: text || `# ${input.title}\n\n${input.instructions}` };
  }
}

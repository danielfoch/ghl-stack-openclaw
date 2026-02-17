import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export interface HttpVoiceGenerateInput {
  baseUrl: string;
  apiKey?: string;
  text: string;
  voiceId?: string;
  modelId?: string;
  outputDir: string;
}

export async function generateVoiceWithHttpProvider(
  input: HttpVoiceGenerateInput
): Promise<{ filePath: string; extension: "mp3" | "wav" | "m4a" }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  if (input.apiKey) {
    headers.Authorization = `Bearer ${input.apiKey}`;
  }

  const response = await fetch(input.baseUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      text: input.text,
      voice_id: input.voiceId,
      model_id: input.modelId
    })
  });

  if (!response.ok) {
    const msg = await response.text();
    throw new Error(`Voice provider HTTP ${response.status}: ${msg.slice(0, 500)}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const extension = pickExtension(contentType);
  const bytes = Buffer.from(await response.arrayBuffer());

  await mkdir(input.outputDir, { recursive: true });
  const filePath = path.join(
    input.outputDir,
    `voice-http-${Date.now()}-${Math.random().toString(16).slice(2, 8)}.${extension}`
  );
  await writeFile(filePath, bytes);

  return {
    filePath,
    extension
  };
}

function pickExtension(contentType: string): "mp3" | "wav" | "m4a" {
  const lower = contentType.toLowerCase();
  if (lower.includes("audio/wav") || lower.includes("audio/x-wav")) return "wav";
  if (lower.includes("audio/mp4") || lower.includes("audio/m4a")) return "m4a";
  return "mp3";
}

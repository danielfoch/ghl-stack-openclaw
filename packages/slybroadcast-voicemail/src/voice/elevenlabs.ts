import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export interface ElevenLabsGenerateInput {
  apiKey: string;
  baseUrl: string;
  voiceId: string;
  modelId: string;
  text: string;
  outputDir: string;
}

export async function generateVoiceWithElevenLabs(
  input: ElevenLabsGenerateInput
): Promise<{ filePath: string; extension: "mp3" }> {
  const endpoint = `${input.baseUrl.replace(/\/$/, "")}/v1/text-to-speech/${encodeURIComponent(input.voiceId)}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "xi-api-key": input.apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg"
    },
    body: JSON.stringify({
      text: input.text,
      model_id: input.modelId,
      output_format: "mp3_44100_128"
    })
  });

  if (!response.ok) {
    const msg = await response.text();
    throw new Error(`ElevenLabs HTTP ${response.status}: ${msg.slice(0, 500)}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  await mkdir(input.outputDir, { recursive: true });
  const filePath = path.join(
    input.outputDir,
    `elevenlabs-${Date.now()}-${Math.random().toString(16).slice(2, 8)}.mp3`
  );
  await writeFile(filePath, bytes);

  return {
    filePath,
    extension: "mp3"
  };
}

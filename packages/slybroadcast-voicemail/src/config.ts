import { z } from "zod";

const envSchema = z.object({
  SLYBROADCAST_BASE_URL: z
    .string()
    .url()
    .default("https://www.slybroadcast.com/gateway/vmb.json.php"),
  SLYBROADCAST_UID: z.string().optional(),
  SLYBROADCAST_EMAIL: z.string().optional(),
  SLYBROADCAST_PASSWORD: z.string().min(1),
  SLYBROADCAST_DEFAULT_CALLER_ID: z.string().optional(),
  SLYBROADCAST_PUBLIC_AUDIO_BASE_URL: z.string().url().optional(),
  SLYBROADCAST_AUDIO_STAGING_DIR: z
    .string()
    .default("./tmp/slybroadcast-audio"),
  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_BASE_URL: z.string().url().default("https://api.elevenlabs.io"),
  ELEVENLABS_TTS_VOICE_ID: z.string().optional(),
  ELEVENLABS_TTS_MODEL_ID: z.string().default("eleven_multilingual_v2"),
  VOICE_HTTP_BASE_URL: z.string().url().optional(),
  VOICE_HTTP_API_KEY: z.string().optional()
});

export type AppConfig = z.infer<typeof envSchema> & {
  SLYBROADCAST_UID: string;
};

export function loadConfig(): AppConfig {
  const parsed = envSchema.parse(process.env);
  const uid = parsed.SLYBROADCAST_UID ?? parsed.SLYBROADCAST_EMAIL;
  if (!uid) {
    throw new Error(
      "Missing SLYBROADCAST_UID (or SLYBROADCAST_EMAIL fallback)"
    );
  }
  return {
    ...parsed,
    SLYBROADCAST_UID: uid
  };
}

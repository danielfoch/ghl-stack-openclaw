import { z } from "zod";

const envSchema = z.object({
  OPENCLAW_BRIDGE_DB_PATH: z.string().default("./openclaw-bridge.db"),

  LONEWOLF_BASE_URL: z.string().url().default("https://api.pre.lwolf.com"),
  LONEWOLF_BEARER_TOKEN: z.string().optional(),
  LONEWOLF_SUBSCRIPTION_KEY: z.string().optional(),
  LONEWOLF_USER_ID: z.string().optional(),
  LONEWOLF_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),

  NEXONE_BASE_URL: z.string().url().optional(),
  NEXONE_API_KEY: z.string().optional(),
  NEXONE_PULL_PATH: z.string().default("/api/mls/listings"),
  NEXONE_PUSH_PATH: z.string().default("/api/openclaw/events"),

  FALTOUR_BASE_URL: z.string().url().optional(),
  FALTOUR_API_KEY: z.string().optional(),
  FALTOUR_PULL_PATH: z.string().default("/api/mls/listings"),
  FALTOUR_PUSH_PATH: z.string().default("/api/openclaw/events")
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(): AppConfig {
  return envSchema.parse(process.env);
}

import { z } from "zod";
import { VelocityConfig } from "./types.js";

const envSchema = z.object({
  VELOCITY_BASE_URL: z.string().url().default("https://api-velocity.newton.ca/api/forms"),
  VELOCITY_API_KEY: z.string().min(1),
  VELOCITY_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  VELOCITY_API_KEY_QUERY_PARAM: z.string().min(1).default("apiKey")
});

export function loadConfig(): VelocityConfig {
  const env = envSchema.parse(process.env);
  return {
    baseUrl: env.VELOCITY_BASE_URL,
    apiKey: env.VELOCITY_API_KEY,
    timeoutMs: env.VELOCITY_TIMEOUT_MS,
    apiKeyQueryParam: env.VELOCITY_API_KEY_QUERY_PARAM
  };
}

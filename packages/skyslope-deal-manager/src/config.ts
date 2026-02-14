import { z } from "zod";

const envSchema = z.object({
  SKY_SLOPE_BASE_URL: z.string().url().default("https://api.skyslope.com"),
  SKY_SLOPE_TOKEN_URL: z.string().default("/oauth/token"),
  SKY_SLOPE_CLIENT_ID: z.string().optional(),
  SKY_SLOPE_CLIENT_SECRET: z.string().optional(),
  SKY_SLOPE_SCOPE: z.string().optional(),
  SKY_SLOPE_TRANSACTIONS_PATH: z
    .string()
    .default("/api/transactions/{transactionId}"),
  SKY_SLOPE_FILES_PATH: z
    .string()
    .default("/api/transactions/{transactionId}/files"),
  SKY_SLOPE_FILE_CONTENT_PATH: z
    .string()
    .default("/api/files/{fileId}/download"),
  DEAL_DB_PATH: z.string().default("./skyslope-deals.db"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4.1-mini"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.0-flash"),
  LANGEXTRACT_ENDPOINT: z.string().url().optional(),
  LANGEXTRACT_API_KEY: z.string().optional()
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(): AppConfig {
  return envSchema.parse(process.env);
}

import { z } from "zod";

const boolish = z.union([z.literal("true"), z.literal("false")]).transform((v) => v === "true");

export const appConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.string().default("info"),
  APP_ENV: z.string().default("local"),
  APP_REGION_ALLOWLIST: z.string().default("+1"),
  APP_ALLOWED_INBOUND_EMAILS: z.string().default(""),
  APP_ALLOWED_INBOUND_PHONES: z.string().default(""),
  APP_WEBHOOK_SHARED_SECRET: z.string().min(8),
  APP_ENCRYPTION_KEY: z.string().min(32),
  APP_ENABLE_ELEVENLABS: boolish.default("false"),
  APP_ALLOW_NON_US_CA: boolish.default("false"),
  APP_DB_PATH: z.string().default("./fub-screenless.db"),

  FUB_BASE_URL: z.string().url(),
  FUB_API_KEY: z.string().min(8),
  FUB_SOURCE_TAG: z.string().default("OpenClawScreenless"),

  IDX_PROVIDER: z.string().default("mock"),
  IDX_BASE_URL: z.string().url().optional(),
  IDX_API_KEY: z.string().optional(),

  SENDHUB_BASE_URL: z.string().url(),
  SENDHUB_API_KEY: z.string().min(8),
  SENDHUB_WEBHOOK_SECRET: z.string().min(8),

  EMAIL_PROVIDER: z.enum(["smtp", "sendgrid", "mailgun", "gmail", "gog"]).default("smtp"),
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_SECURE: boolish.default("false"),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email().default("assistant@example.com"),

  SENDGRID_API_KEY: z.string().optional(),
  MAILGUN_API_KEY: z.string().optional(),
  MAILGUN_DOMAIN: z.string().optional(),

  GMAIL_CLIENT_ID: z.string().optional(),
  GMAIL_CLIENT_SECRET: z.string().optional(),
  GMAIL_REDIRECT_URI: z.string().url().optional(),
  GMAIL_REFRESH_TOKEN: z.string().optional(),

  GOG_CLI_PATH: z.string().default("gog"),

  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_BASE_URL: z.string().url().optional()
});

export type AppConfig = z.infer<typeof appConfigSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return appConfigSchema.parse(env);
}

export function csv(input: string): string[] {
  return input.split(",").map((x) => x.trim()).filter(Boolean);
}

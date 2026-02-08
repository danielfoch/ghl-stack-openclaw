import { z } from "zod";

export type TokenGrant = "password" | "client_credentials";
export type KeyStyle = "quoted" | "unquoted";
export type LogLevel = "debug" | "info" | "warn" | "error";

const toNum = (fallback: number) =>
  z
    .string()
    .optional()
    .transform((v) => {
      if (v == null || v.trim() === "") return fallback;
      const n = Number(v);
      return Number.isFinite(n) ? n : fallback;
    });

const toBool = (fallback: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => {
      if (v == null) return fallback;
      const s = v.trim().toLowerCase();
      if (s === "true" || s === "1" || s === "yes") return true;
      if (s === "false" || s === "0" || s === "no") return false;
      return fallback;
    });

export const ConfigSchema = z.object({
  DDF_BASE_URL: z.string().url(),
  DDF_AUTH_URL: z.string().url(),

  DDF_TOKEN_GRANT: z.enum(["password", "client_credentials"]).default("client_credentials"),
  DDF_AUTH_USE_BASIC: toBool(true),

  DDF_CLIENT_ID: z.string().optional(),
  DDF_CLIENT_SECRET: z.string().optional(),
  DDF_SCOPE: z.string().optional(),

  DDF_USERNAME: z.string().optional(),
  DDF_PASSWORD: z.string().optional(),

  DDF_DEFAULT_TOP: toNum(25),
  DDF_MAX_TOP: toNum(200),

  DDF_PROPERTY_KEY_STYLE: z.enum(["quoted", "unquoted"]).default("quoted"),

  // HTTP hardening
  DDF_HTTP_TIMEOUT_MS: toNum(30_000),
  DDF_HTTP_RETRIES: toNum(2),
  DDF_HTTP_CONCURRENCY: toNum(6),
  DDF_HTTP_RPS: toNum(8),
  DDF_HTTP_BURST: toNum(16),
  DDF_USER_AGENT: z.string().optional(),

  // Media endpoint defaults (often varies by deployment)
  DDF_MEDIA_ENTITY: z.string().optional().default("Media"),
  DDF_MEDIA_RECORD_KEY_FIELD: z.string().optional().default("ResourceRecordKey"),
  DDF_MEDIA_ORDER_FIELD: z.string().optional().default("Order"),

  // Logging
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  LOG_TOOL_ARGS: toBool(false),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const cfg = ConfigSchema.parse(env);
  if (cfg.DDF_TOKEN_GRANT === "client_credentials") {
    if (!cfg.DDF_CLIENT_ID || !cfg.DDF_CLIENT_SECRET) {
      throw new Error("DDF_TOKEN_GRANT=client_credentials requires DDF_CLIENT_ID and DDF_CLIENT_SECRET");
    }
  }
  if (cfg.DDF_TOKEN_GRANT === "password") {
    if (!cfg.DDF_USERNAME || !cfg.DDF_PASSWORD) {
      throw new Error("DDF_TOKEN_GRANT=password requires DDF_USERNAME and DDF_PASSWORD");
    }
  }
  return cfg;
}

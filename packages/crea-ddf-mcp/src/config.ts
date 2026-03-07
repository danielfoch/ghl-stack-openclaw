import { z } from "zod";
import type { DdfConfig } from "./types.js";

const envSchema = z.object({
  DDF_BASE_URL: z.string().url(),
  DDF_AUTH_URL: z.string().url(),
  DDF_TOKEN_GRANT: z.enum(["password", "client_credentials"]).default("client_credentials"),
  DDF_AUTH_USE_BASIC: z
    .string()
    .optional()
    .transform((v) => (v == null ? true : ["1", "true", "yes"].includes(v.toLowerCase()))),
  DDF_CLIENT_ID: z.string().optional(),
  DDF_CLIENT_SECRET: z.string().optional(),
  DDF_USERNAME: z.string().optional(),
  DDF_PASSWORD: z.string().optional(),
  DDF_SCOPE: z.string().optional(),
  DDF_PROPERTY_KEY_STYLE: z.enum(["quoted", "unquoted"]).default("quoted"),
  DDF_DEFAULT_TOP: z.coerce.number().int().positive().default(25),
  DDF_MAX_TOP: z.coerce.number().int().positive().default(200),
  DDF_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  DDF_HTTP_RETRIES: z.coerce.number().int().min(0).default(2),
  DDF_HTTP_CONCURRENCY: z.coerce.number().int().positive().default(6),
  DDF_HTTP_RPS: z.coerce.number().positive().default(8),
  DDF_HTTP_BURST: z.coerce.number().positive().default(16),
  DDF_USER_AGENT: z.string().optional(),
  DDF_MEDIA_ENTITY: z.string().default("Media"),
  DDF_MEDIA_RECORD_KEY_FIELD: z.string().default("ResourceRecordKey"),
  DDF_MEDIA_ORDER_FIELD: z.string().default("Order")
});

export function loadConfig(): DdfConfig {
  const env = envSchema.parse(process.env);

  if (env.DDF_TOKEN_GRANT === "client_credentials" && (!env.DDF_CLIENT_ID || !env.DDF_CLIENT_SECRET)) {
    throw new Error("DDF_TOKEN_GRANT=client_credentials requires DDF_CLIENT_ID and DDF_CLIENT_SECRET");
  }

  if (env.DDF_TOKEN_GRANT === "password" && (!env.DDF_USERNAME || !env.DDF_PASSWORD)) {
    throw new Error("DDF_TOKEN_GRANT=password requires DDF_USERNAME and DDF_PASSWORD");
  }

  return {
    baseUrl: env.DDF_BASE_URL,
    authUrl: env.DDF_AUTH_URL,
    tokenGrant: env.DDF_TOKEN_GRANT,
    authUseBasic: env.DDF_AUTH_USE_BASIC,
    clientId: env.DDF_CLIENT_ID,
    clientSecret: env.DDF_CLIENT_SECRET,
    username: env.DDF_USERNAME,
    password: env.DDF_PASSWORD,
    scope: env.DDF_SCOPE,
    propertyKeyStyle: env.DDF_PROPERTY_KEY_STYLE,
    defaultTop: env.DDF_DEFAULT_TOP,
    maxTop: env.DDF_MAX_TOP,
    timeoutMs: env.DDF_HTTP_TIMEOUT_MS,
    retries: env.DDF_HTTP_RETRIES,
    concurrency: env.DDF_HTTP_CONCURRENCY,
    rps: env.DDF_HTTP_RPS,
    burst: env.DDF_HTTP_BURST,
    userAgent: env.DDF_USER_AGENT,
    mediaEntity: env.DDF_MEDIA_ENTITY,
    mediaRecordKeyField: env.DDF_MEDIA_RECORD_KEY_FIELD,
    mediaOrderField: env.DDF_MEDIA_ORDER_FIELD
  };
}

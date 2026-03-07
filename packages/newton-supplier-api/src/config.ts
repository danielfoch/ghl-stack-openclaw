import { z } from "zod";

const envSchema = z.object({
  NEWTON_SUPPLIER_ENDPOINT: z.string().url(),
  NEWTON_SUPPLIER_NAMESPACE: z.string().default("http://tempuri.org/"),
  NEWTON_SUPPLIER_ACTION_BASE: z.string().optional(),
  NEWTON_SUPPLIER_SOAP_ENVELOPE_NS: z
    .string()
    .default("http://schemas.xmlsoap.org/soap/envelope/"),
  NEWTON_SUPPLIER_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  NEWTON_SUPPLIER_BASIC_AUTH_USER: z.string().optional(),
  NEWTON_SUPPLIER_BASIC_AUTH_PASSWORD: z.string().optional(),
  NEWTON_SUPPLIER_GET_OPERATION: z.string().default("Get"),
  NEWTON_SUPPLIER_ACK_OPERATION: z.string().default("Ack")
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(): AppConfig {
  const cfg = envSchema.parse(process.env);

  const hasUser = Boolean(cfg.NEWTON_SUPPLIER_BASIC_AUTH_USER);
  const hasPass = Boolean(cfg.NEWTON_SUPPLIER_BASIC_AUTH_PASSWORD);
  if (hasUser !== hasPass) {
    throw new Error(
      "Set both NEWTON_SUPPLIER_BASIC_AUTH_USER and NEWTON_SUPPLIER_BASIC_AUTH_PASSWORD, or neither"
    );
  }

  return cfg;
}

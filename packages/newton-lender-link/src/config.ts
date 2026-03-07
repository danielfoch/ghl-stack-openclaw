import { z } from "zod";

const envSchema = z.object({
  NEWTON_LINK_BASE_URL: z.string().url().default("https://api-link.newton.ca"),
  NEWTON_LINK_TOKEN_URL: z
    .string()
    .url()
    .default("https://api-link.newton.ca/identity/connect/token"),
  NEWTON_LINK_CLIENT_ID: z.string().min(1),
  NEWTON_LINK_CLIENT_SECRET: z.string().min(1),
  NEWTON_LINK_SCOPE: z.string().min(1).default("Link.Pos.Api"),
  NEWTON_LINK_UNIT_ID: z.string().min(1),
  NEWTON_LINK_POS_SYSTEM_ID: z.string().min(1),
  NEWTON_LINK_TIMEOUT_MS: z.coerce.number().int().positive().default(30000)
});

export type NewtonLinkConfig = z.infer<typeof envSchema>;

export function loadConfig(): NewtonLinkConfig {
  return envSchema.parse(process.env);
}

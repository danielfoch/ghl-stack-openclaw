import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env var: ${name}`);
  }
  return value;
}

export const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 4000),
  appOrigin: required("APP_ORIGIN"),
  apiOrigin: required("API_ORIGIN"),
  allowHumanReadonlyEnv: process.env.ALLOW_HUMAN_READONLY === "true",
  jwtSecret: required("JWT_SECRET"),
  csrfSecret: required("CSRF_SECRET"),
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  sessionTtlMinutes: Number(process.env.SESSION_TTL_MINUTES || 60),
  siweNonceTtlSeconds: Number(process.env.SIWE_NONCE_TTL_SECONDS || 300),
  actionNonceTtlSeconds: Number(process.env.ACTION_NONCE_TTL_SECONDS || 300),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX || 100),
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  chainId: Number(process.env.CHAIN_ID || 11155111),
  escrowContractAddress: process.env.ESCROW_CONTRACT_ADDRESS || "",
  openclawApiKey: process.env.OPENCLAW_API_KEY || "",
  openclawApiAgentWallet: (process.env.OPENCLAW_API_AGENT_WALLET || "").toLowerCase(),
};

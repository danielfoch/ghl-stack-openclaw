import { NextFunction, Request, Response } from "express";
import { prisma } from "../db";
import { config } from "../config";

const PUBLIC_ROUTES = new Set([
  "/health",
  "/auth/request-nonce",
  "/auth/verify",
]);

export async function botOnlyGate(req: Request, res: Response, next: NextFunction) {
  if (PUBLIC_ROUTES.has(req.path)) return next();
  const apiKeyHeader = req.header("x-openclaw-api-key");
  if (apiKeyHeader) {
    if (!config.openclawApiKey || apiKeyHeader !== config.openclawApiKey) {
      return res.status(401).json({ error: "Invalid OpenClaw API key" });
    }
    if (req.authMethod !== "api_key" || !req.agent) {
      return res.status(401).json({
        error:
          "OpenClaw API key accepted but no integration agent is resolved. Set OPENCLAW_API_AGENT_WALLET or send x-openclaw-agent-wallet.",
      });
    }
    return next();
  }

  if (req.authMethod === "api_key") return next();
  if (req.agent) return next();

  const appConfig = await prisma.appConfig.findUnique({ where: { id: "singleton" } });
  const allowReadonly = config.allowHumanReadonlyEnv && Boolean(appConfig?.humanReadonlyMode);

  if (!allowReadonly) {
    return res.status(403).json({ error: "Bot-only access. Human browsing disabled." });
  }

  if (req.method !== "GET") {
    return res.status(403).json({ error: "Read-only mode for humans" });
  }

  return next();
}

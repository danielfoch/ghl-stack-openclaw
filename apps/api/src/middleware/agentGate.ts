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

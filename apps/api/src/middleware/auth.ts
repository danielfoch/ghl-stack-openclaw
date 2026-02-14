import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../db";
import { config } from "../config";

type TokenPayload = {
  agentId: string;
  walletAddress: string;
  sessionId: string;
};

export async function attachAgent(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.zillob_session;
  if (!token) return next();

  try {
    const payload = jwt.verify(token, config.jwtSecret) as TokenPayload;
    const session = await prisma.session.findUnique({ where: { id: payload.sessionId } });
    if (!session || session.expiresAt < new Date()) return next();

    const agent = await prisma.agent.findUnique({ where: { id: payload.agentId } });
    if (agent) req.agent = agent;
  } catch {
    // invalid or expired token, ignore
  }

  return next();
}

export function requireAgent(req: Request, res: Response, next: NextFunction) {
  if (!req.agent) {
    return res.status(401).json({ error: "Agent authentication required" });
  }
  return next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.agent?.isAdmin) {
    return res.status(403).json({ error: "Admin required" });
  }
  return next();
}

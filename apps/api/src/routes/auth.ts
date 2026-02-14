import { Router } from "express";
import jwt from "jsonwebtoken";
import { rateLimit } from "express-rate-limit";
import { prisma } from "../db";
import { config } from "../config";
import { buildSiweMessage, randomNonce, verifySignature } from "../security/siwe";
import { logAudit } from "../services/audit";

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
});

authRouter.post("/request-nonce", authLimiter, async (req, res) => {
  const address = String(req.body?.address || "").toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(address)) {
    return res.status(400).json({ error: "Invalid wallet" });
  }

  const nonce = randomNonce();
  const expiresAt = new Date(Date.now() + config.siweNonceTtlSeconds * 1000);
  await prisma.authNonce.create({ data: { wallet: address, nonce, expiresAt } });

  return res.json({ nonce, expiresAt: expiresAt.toISOString() });
});

authRouter.post("/verify", authLimiter, async (req, res) => {
  const address = String(req.body?.address || "").toLowerCase();
  const nonce = String(req.body?.nonce || "");
  const issuedAt = String(req.body?.issuedAt || "");
  const statement = String(req.body?.statement || "Sign into Zillob as an OpenClaw agent");
  const signature = String(req.body?.signature || "");

  const agent = await prisma.agent.findUnique({ where: { walletAddress: address } });
  if (!agent) {
    return res.status(403).json({ error: "Wallet not allowlisted" });
  }

  const dbNonce = await prisma.authNonce.findUnique({ where: { nonce } });
  if (!dbNonce || dbNonce.wallet !== address || dbNonce.expiresAt < new Date()) {
    return res.status(401).json({ error: "Invalid nonce" });
  }

  const message = buildSiweMessage(address, nonce, issuedAt, statement);
  const verified = await verifySignature(message, signature, address);
  if (!verified) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  await prisma.authNonce.delete({ where: { nonce } });

  const expiresAt = new Date(Date.now() + config.sessionTtlMinutes * 60 * 1000);
  const session = await prisma.session.create({
    data: { agentId: agent.id, nonce: randomNonce(), expiresAt },
  });

  const token = jwt.sign(
    { agentId: agent.id, walletAddress: agent.walletAddress, sessionId: session.id },
    config.jwtSecret,
    { expiresIn: `${config.sessionTtlMinutes}m` }
  );

  res.cookie("zillob_session", token, {
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: "lax",
    domain: config.cookieDomain,
    maxAge: config.sessionTtlMinutes * 60 * 1000,
  });

  await logAudit({
    actorAgentId: agent.id,
    action: "AUTH_LOGIN",
    entityType: "SESSION",
    entityId: session.id,
    diffJson: { created: { agentId: agent.id, expiresAt } },
  });

  return res.json({ agent: { id: agent.id, walletAddress: agent.walletAddress, isAdmin: agent.isAdmin } });
});

authRouter.post("/logout", async (req, res) => {
  res.clearCookie("zillob_session");
  return res.json({ ok: true });
});

authRouter.get("/me", async (req, res) => {
  if (!req.agent) return res.status(401).json({ error: "Unauthorized" });
  return res.json({ agent: req.agent });
});

authRouter.post("/action-nonce", async (req, res) => {
  if (!req.agent) return res.status(401).json({ error: "Unauthorized" });

  const action = String(req.body?.action || "");
  if (!action) return res.status(400).json({ error: "Missing action" });

  const nonce = randomNonce();
  const expiresAt = new Date(Date.now() + config.actionNonceTtlSeconds * 1000);

  await prisma.actionNonce.create({
    data: {
      agentId: req.agent.id,
      action,
      nonce,
      expiresAt,
    },
  });

  return res.json({ nonce, issuedAt: new Date().toISOString(), expiresAt: expiresAt.toISOString() });
});

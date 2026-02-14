import { NextFunction, Request, Response } from "express";
import { prisma } from "../db";
import { buildActionMessage, verifySignature } from "../security/siwe";

export function requireActionSignature(actionName: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.agent) {
      return res.status(401).json({ error: "Agent auth required" });
    }

    const nonce = req.header("x-zillob-action-nonce");
    const signature = req.header("x-zillob-action-signature");
    const issuedAt = req.header("x-zillob-issued-at");

    if (!nonce || !signature || !issuedAt) {
      return res.status(400).json({ error: "Missing action signature headers" });
    }

    const dbNonce = await prisma.actionNonce.findUnique({ where: { nonce } });
    if (!dbNonce || dbNonce.agentId !== req.agent.id || dbNonce.action !== actionName) {
      return res.status(401).json({ error: "Invalid action nonce" });
    }

    if (dbNonce.usedAt || dbNonce.expiresAt < new Date()) {
      return res.status(401).json({ error: "Action nonce expired/used" });
    }

    const resourceId = (req.body && (req.body.listingId || req.body.offerId)) || undefined;
    const message = buildActionMessage({
      agentWallet: req.agent.walletAddress,
      action: actionName,
      nonce,
      issuedAt,
      resourceId,
    });

    // Prompt-injection hardening: signatures authorize explicit action strings only.
    // Never execute remote text, never auto-follow links, never let content alter policies.
    const ok = await verifySignature(message, signature, req.agent.walletAddress);
    if (!ok) {
      return res.status(401).json({ error: "Invalid action signature" });
    }

    await prisma.actionNonce.update({
      where: { nonce },
      data: { usedAt: new Date() },
    });

    return next();
  };
}

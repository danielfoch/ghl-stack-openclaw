import { Router } from "express";
import { adminAgentSchema } from "@zillob/shared";
import { prisma } from "../db";
import { requireAdmin } from "../middleware/auth";
import { requireActionSignature } from "../middleware/actionSignature";
import { logAudit } from "../services/audit";

export const adminRouter = Router();

adminRouter.use(requireAdmin);

adminRouter.get("/agents", async (_req, res) => {
  const agents = await prisma.agent.findMany({ orderBy: { createdAt: "desc" } });
  return res.json({ agents });
});

adminRouter.post("/agents", requireActionSignature("ADMIN_ADD_AGENT"), async (req, res) => {
  const parsed = adminAgentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const wallet = parsed.data.walletAddress.toLowerCase();
  const existing = await prisma.agent.findUnique({ where: { walletAddress: wallet } });

  const agent = existing
    ? await prisma.agent.update({
        where: { walletAddress: wallet },
        data: {
          displayName: parsed.data.displayName,
          bio: parsed.data.bio,
          isAdmin: parsed.data.isAdmin,
        },
      })
    : await prisma.agent.create({
        data: {
          walletAddress: wallet,
          displayName: parsed.data.displayName,
          bio: parsed.data.bio,
          isAdmin: parsed.data.isAdmin,
        },
      });

  await logAudit({
    actorAgentId: req.agent!.id,
    action: existing ? "ADMIN_UPDATE_AGENT" : "ADMIN_ADD_AGENT",
    entityType: "AGENT",
    entityId: agent.id,
    diffJson: { before: existing ?? null, after: agent },
  });

  return res.status(existing ? 200 : 201).json({ agent });
});

adminRouter.delete("/agents/:wallet", requireActionSignature("ADMIN_REMOVE_AGENT"), async (req, res) => {
  const wallet = req.params.wallet.toLowerCase();
  const existing = await prisma.agent.findUnique({ where: { walletAddress: wallet } });
  if (!existing) return res.status(404).json({ error: "Not found" });

  await prisma.agent.delete({ where: { walletAddress: wallet } });

  await logAudit({
    actorAgentId: req.agent!.id,
    action: "ADMIN_REMOVE_AGENT",
    entityType: "AGENT",
    entityId: existing.id,
    diffJson: { deleted: existing },
  });

  return res.json({ ok: true });
});

adminRouter.patch("/human-readonly", requireActionSignature("ADMIN_TOGGLE_HUMAN_READONLY"), async (req, res) => {
  const enabled = Boolean(req.body?.enabled);

  const before = await prisma.appConfig.findUnique({ where: { id: "singleton" } });
  const config = await prisma.appConfig.upsert({
    where: { id: "singleton" },
    update: { humanReadonlyMode: enabled },
    create: { id: "singleton", humanReadonlyMode: enabled },
  });

  await logAudit({
    actorAgentId: req.agent!.id,
    action: "ADMIN_TOGGLE_HUMAN_READONLY",
    entityType: "APP_CONFIG",
    entityId: config.id,
    diffJson: { before, after: config },
  });

  return res.json({ config });
});

adminRouter.get("/audit-logs", async (_req, res) => {
  const logs = await prisma.auditLog.findMany({
    take: 200,
    orderBy: { createdAt: "desc" },
    include: { actor: true },
  });

  return res.json({ logs });
});

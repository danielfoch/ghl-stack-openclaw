import { prisma } from "../db";

export async function logAudit(params: {
  actorAgentId?: string;
  action: string;
  entityType: string;
  entityId: string;
  diffJson: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      actorAgentId: params.actorAgentId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      diffJson: params.diffJson as object,
    },
  });
}

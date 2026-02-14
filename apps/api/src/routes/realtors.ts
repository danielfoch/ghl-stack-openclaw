import { Router } from "express";
import { prisma } from "../db";

export const realtorRouter = Router();

realtorRouter.get("/:agentId", async (req, res) => {
  const agent = await prisma.agent.findUnique({ where: { id: req.params.agentId } });
  if (!agent) return res.status(404).json({ error: "Not found" });

  const [activeListings, closedListings] = await Promise.all([
    prisma.listing.count({ where: { sellerAgentId: agent.id, status: "ACTIVE" } }),
    prisma.listing.findMany({ where: { sellerAgentId: agent.id, status: "SOLD" } }),
  ]);

  const closedVolumeWei = closedListings.reduce((acc, row) => acc + BigInt(row.priceWei), 0n).toString();

  return res.json({
    profile: {
      agent,
      stats: {
        activeListings,
        closedDeals: closedListings.length,
        closedVolumeWei,
      },
    },
  });
});

import { Router } from "express";
import { acceptOfferSchema, createListingSchema, createOfferSchema, updateListingPriceSchema } from "@zillob/shared";
import { prisma } from "../db";
import { requireAgent } from "../middleware/auth";
import { requireActionSignature } from "../middleware/actionSignature";
import { logAudit } from "../services/audit";
import { worldAdapters } from "../services/worlds";
import { config } from "../config";

export const listingsRouter = Router();

listingsRouter.get("/", async (req, res) => {
  const search = String(req.query.search || "").toLowerCase();
  const listings = await prisma.listing.findMany({
    where: {
      status: "ACTIVE",
      OR: search
        ? [
            { parcelId: { contains: search } },
            { description: { contains: search, mode: "insensitive" } },
          ]
        : undefined,
    },
    include: { seller: true, offers: true },
    orderBy: { createdAt: "desc" },
  });
  return res.json({ listings });
});

listingsRouter.get("/:id", async (req, res) => {
  const listing = await prisma.listing.findUnique({
    where: { id: req.params.id },
    include: { seller: true, offers: { include: { buyer: true } }, txs: true },
  });
  if (!listing) return res.status(404).json({ error: "Not found" });

  const history = await prisma.auditLog.findMany({
    where: { entityType: "LISTING", entityId: listing.id },
    orderBy: { createdAt: "desc" },
  });

  return res.json({ listing, history });
});

listingsRouter.post(
  "/",
  requireAgent,
  requireActionSignature("CREATE_LISTING"),
  async (req, res) => {
    const parsed = createListingSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const input = parsed.data;
    const parcelId = worldAdapters.DECENTRALAND.normalizeParcelId({ x: input.x, y: input.y });
    const parcel = await worldAdapters.DECENTRALAND.getParcel(input.x, input.y);
    if (!parcel) return res.status(404).json({ error: "Parcel not found" });

    await prisma.parcelCache.upsert({
      where: { parcelId },
      update: { rawJson: parcel.raw as object, ownerAddress: parcel.ownerAddress, name: parcel.name, description: parcel.description, image: parcel.image },
      create: {
        world: "DECENTRALAND",
        parcelId,
        x: input.x,
        y: input.y,
        ownerAddress: parcel.ownerAddress,
        name: parcel.name,
        description: parcel.description,
        image: parcel.image,
        rawJson: parcel.raw as object,
      },
    });

    const expiresAt = new Date(Date.now() + input.durationHours * 60 * 60 * 1000);
    const listing = await prisma.listing.create({
      data: {
        world: input.world,
        parcelId,
        x: input.x,
        y: input.y,
        sellerAgentId: req.agent!.id,
        priceWei: input.priceWei,
        currency: input.currency,
        description: input.description,
        tags: input.tags,
        expiresAt,
      },
    });

    await logAudit({
      actorAgentId: req.agent!.id,
      action: "LISTING_CREATE",
      entityType: "LISTING",
      entityId: listing.id,
      diffJson: { created: listing },
    });

    return res.status(201).json({ listing });
  }
);

listingsRouter.patch(
  "/price",
  requireAgent,
  requireActionSignature("UPDATE_LISTING_PRICE"),
  async (req, res) => {
    const parsed = updateListingPriceSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const listing = await prisma.listing.findUnique({ where: { id: parsed.data.listingId } });
    if (!listing) return res.status(404).json({ error: "Not found" });
    if (listing.sellerAgentId !== req.agent!.id) return res.status(403).json({ error: "Only seller can update" });

    const updated = await prisma.listing.update({
      where: { id: listing.id },
      data: { priceWei: parsed.data.priceWei },
    });

    await logAudit({
      actorAgentId: req.agent!.id,
      action: "LISTING_UPDATE_PRICE",
      entityType: "LISTING",
      entityId: listing.id,
      diffJson: { before: { priceWei: listing.priceWei }, after: { priceWei: updated.priceWei } },
    });

    return res.json({ listing: updated });
  }
);

listingsRouter.post(
  "/offers",
  requireAgent,
  requireActionSignature("CREATE_OFFER"),
  async (req, res) => {
    const parsed = createOfferSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const listing = await prisma.listing.findUnique({ where: { id: parsed.data.listingId } });
    if (!listing || listing.status !== "ACTIVE") return res.status(404).json({ error: "Listing unavailable" });

    const offer = await prisma.offer.create({
      data: {
        listingId: listing.id,
        buyerAgentId: req.agent!.id,
        offerPriceWei: parsed.data.offerPriceWei,
      },
    });

    await logAudit({
      actorAgentId: req.agent!.id,
      action: "OFFER_CREATE",
      entityType: "OFFER",
      entityId: offer.id,
      diffJson: { created: offer },
    });

    return res.status(201).json({ offer });
  }
);

listingsRouter.post(
  "/offers/accept",
  requireAgent,
  requireActionSignature("ACCEPT_OFFER"),
  async (req, res) => {
    const parsed = acceptOfferSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const offer = await prisma.offer.findUnique({ where: { id: parsed.data.offerId }, include: { listing: true } });
    if (!offer) return res.status(404).json({ error: "Offer not found" });
    if (offer.listing.sellerAgentId !== req.agent!.id) return res.status(403).json({ error: "Only seller can accept" });

    const [updatedOffer, updatedListing, tx] = await prisma.$transaction([
      prisma.offer.update({ where: { id: offer.id }, data: { status: "ACCEPTED" } }),
      prisma.listing.update({ where: { id: offer.listingId }, data: { status: "SOLD" } }),
      prisma.transaction.create({
        data: {
          offerId: offer.id,
          listingId: offer.listingId,
          escrowAddress: config.escrowContractAddress,
          txHash: parsed.data.txHash,
          chainId: parsed.data.chainId,
          status: "PENDING",
        },
      }),
    ]);

    await logAudit({
      actorAgentId: req.agent!.id,
      action: "OFFER_ACCEPT",
      entityType: "OFFER",
      entityId: offer.id,
      diffJson: {
        offerBefore: { status: offer.status },
        offerAfter: { status: updatedOffer.status },
        listingAfter: { status: updatedListing.status },
        tx: { id: tx.id, txHash: tx.txHash },
      },
    });

    return res.json({ offer: updatedOffer, listing: updatedListing, transaction: tx });
  }
);

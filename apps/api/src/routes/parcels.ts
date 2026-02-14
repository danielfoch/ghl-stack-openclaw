import { Router } from "express";
import { prisma } from "../db";
import { worldAdapters } from "../services/worlds";

export const parcelsRouter = Router();

parcelsRouter.get("/:x/:y", async (req, res) => {
  const x = Number(req.params.x);
  const y = Number(req.params.y);
  const parcelId = worldAdapters.DECENTRALAND.normalizeParcelId({ x, y });

  const cached = await prisma.parcelCache.findUnique({ where: { parcelId } });
  if (cached) return res.json({ parcel: cached, source: "cache" });

  const parcel = await worldAdapters.DECENTRALAND.getParcel(x, y);
  if (!parcel) return res.status(404).json({ error: "Parcel not found" });

  const stored = await prisma.parcelCache.create({
    data: {
      world: "DECENTRALAND",
      parcelId: parcel.parcelId,
      x: parcel.x,
      y: parcel.y,
      ownerAddress: parcel.ownerAddress,
      name: parcel.name,
      description: parcel.description,
      image: parcel.image,
      rawJson: parcel.raw as object,
    },
  });

  return res.json({ parcel: stored, source: "api" });
});

parcelsRouter.get("/search/box", async (req, res) => {
  const xMin = Number(req.query.xMin ?? -10);
  const xMax = Number(req.query.xMax ?? 10);
  const yMin = Number(req.query.yMin ?? -10);
  const yMax = Number(req.query.yMax ?? 10);

  const rows = await worldAdapters.DECENTRALAND.searchParcels({ xMin, xMax, yMin, yMax });

  await prisma.$transaction(
    rows.map((parcel) =>
      prisma.parcelCache.upsert({
        where: { parcelId: parcel.parcelId },
        update: {
          ownerAddress: parcel.ownerAddress,
          name: parcel.name,
          description: parcel.description,
          image: parcel.image,
          rawJson: parcel.raw as object,
        },
        create: {
          world: "DECENTRALAND",
          parcelId: parcel.parcelId,
          x: parcel.x,
          y: parcel.y,
          ownerAddress: parcel.ownerAddress,
          name: parcel.name,
          description: parcel.description,
          image: parcel.image,
          rawJson: parcel.raw as object,
        },
      })
    )
  );

  return res.json({ parcels: rows });
});

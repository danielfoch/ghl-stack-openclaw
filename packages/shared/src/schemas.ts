import { z } from "zod";

export const walletAddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address");

export const siweRequestSchema = z.object({
  address: walletAddressSchema,
  nonce: z.string().min(8),
  issuedAt: z.string(),
  statement: z.string().min(5),
  signature: z.string().min(40),
});

export const createListingSchema = z.object({
  world: z.literal("DECENTRALAND"),
  x: z.number().int().min(-300).max(300),
  y: z.number().int().min(-300).max(300),
  priceWei: z.string().regex(/^\d+$/),
  currency: z.enum(["ETH", "MANA"]),
  description: z.string().max(2000).optional().default(""),
  tags: z.array(z.string().min(1).max(30)).max(10).default([]),
  durationHours: z.number().int().min(1).max(24 * 90),
});

export const createOfferSchema = z.object({
  listingId: z.string().uuid(),
  offerPriceWei: z.string().regex(/^\d+$/),
});

export const updateListingPriceSchema = z.object({
  listingId: z.string().uuid(),
  priceWei: z.string().regex(/^\d+$/),
});

export const acceptOfferSchema = z.object({
  offerId: z.string().uuid(),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  chainId: z.number().int().positive(),
});

export const adminAgentSchema = z.object({
  walletAddress: walletAddressSchema,
  displayName: z.string().min(1).max(80).optional(),
  bio: z.string().max(400).optional(),
  isAdmin: z.boolean().default(false),
});

export const ugcSubscribeSchema = z.object({
  email: z.string().email().optional(),
  autoApprove: z.boolean().optional(),
  pricePerVideoUsd: z.number().int().min(1).max(5000).optional(),
});

export const createConceptSchema = z.object({
  title: z.string().min(4).max(120),
  summary: z.string().min(10).max(500),
  script: z.string().min(20).max(20000),
  chartData: z.record(z.any()).optional(),
  sourceNotes: z.string().max(5000).optional(),
});

export const respondToConceptSchema = z.object({
  decision: z.enum(["APPROVE", "DECLINE"]),
});

export const diyListingTourSchema = z.object({
  photoUrls: z.array(z.string().url()).min(1).max(20),
  script: z.string().min(10).max(5000),
  provider: z.enum(["KLING", "SEEDANCE"]).optional(),
});

export const diyTakeExplainerSchema = z.object({
  take: z.string().min(10).max(2000),
  context: z.string().max(3000).optional(),
  provider: z.enum(["KLING", "SEEDANCE", "HEYGEN"]).optional(),
});

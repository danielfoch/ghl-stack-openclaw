import { Router } from "express";
import {
  createConceptSchema,
  diyListingTourSchema,
  diyTakeExplainerSchema,
  respondToConceptSchema,
  ugcSubscribeSchema,
} from "@zillob/shared";
import { prisma } from "../db";
import { requireAgent } from "../middleware/auth";
import { chooseRecommendedProvider, ugcBillingProvider, ugcVideoProvider } from "../services/ugc/providers";

export const ugcRouter = Router();

ugcRouter.get("/subscribers/me", requireAgent, async (req, res) => {
  const subscriber = await prisma.ugcSubscriber.findUnique({ where: { agentId: req.agent!.id } });
  return res.json({ subscriber });
});

ugcRouter.post("/subscribers/me", requireAgent, async (req, res) => {
  const parsed = ugcSubscribeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const subscriber = await prisma.ugcSubscriber.upsert({
    where: { agentId: req.agent!.id },
    update: {
      email: parsed.data.email,
      autoApprove: parsed.data.autoApprove,
      pricePerVideoUsd: parsed.data.pricePerVideoUsd,
      status: "ACTIVE",
    },
    create: {
      agentId: req.agent!.id,
      email: parsed.data.email,
      autoApprove: parsed.data.autoApprove ?? false,
      pricePerVideoUsd: parsed.data.pricePerVideoUsd ?? 49,
      status: "ACTIVE",
    },
  });

  return res.status(201).json({ subscriber });
});

ugcRouter.post("/concepts", requireAgent, async (req, res) => {
  const parsed = createConceptSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const concept = await prisma.contentConcept.create({
    data: {
      title: parsed.data.title,
      summary: parsed.data.summary,
      script: parsed.data.script,
      chartData: parsed.data.chartData,
      sourceNotes: parsed.data.sourceNotes,
      createdByAgentId: req.agent!.id,
    },
  });

  return res.status(201).json({ concept });
});

ugcRouter.get("/concepts", requireAgent, async (_req, res) => {
  const concepts = await prisma.contentConcept.findMany({
    include: { createdBy: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return res.json({ concepts });
});

ugcRouter.post("/concepts/:id/publish", requireAgent, async (req, res) => {
  const concept = await prisma.contentConcept.findUnique({ where: { id: req.params.id } });
  if (!concept) return res.status(404).json({ error: "Concept not found" });

  const subscribers = await prisma.ugcSubscriber.findMany({ where: { status: "ACTIVE" } });

  const result = await prisma.$transaction(async (tx) => {
    const updatedConcept = await tx.contentConcept.update({
      where: { id: concept.id },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });

    const createdNotifications = await Promise.all(
      subscribers.map((subscriber) =>
        tx.conceptNotification.upsert({
          where: {
            conceptId_subscriberId: {
              conceptId: concept.id,
              subscriberId: subscriber.id,
            },
          },
          update: { summary: concept.summary, status: "PENDING" },
          create: {
            conceptId: concept.id,
            subscriberId: subscriber.id,
            status: "PENDING",
            summary: concept.summary,
          },
        })
      )
    );

    return { updatedConcept, createdNotifications };
  });

  return res.json({
    concept: result.updatedConcept,
    notificationsCreated: result.createdNotifications.length,
  });
});

ugcRouter.get("/inbox/me", requireAgent, async (req, res) => {
  const subscriber = await prisma.ugcSubscriber.findUnique({ where: { agentId: req.agent!.id } });
  if (!subscriber) return res.status(404).json({ error: "No subscriber profile. Create one first." });

  const inbox = await prisma.conceptNotification.findMany({
    where: { subscriberId: subscriber.id },
    include: {
      concept: true,
      charge: true,
      videoJob: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return res.json({ inbox });
});

ugcRouter.post("/notifications/:id/respond", requireAgent, async (req, res) => {
  const parsed = respondToConceptSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const subscriber = await prisma.ugcSubscriber.findUnique({ where: { agentId: req.agent!.id } });
  if (!subscriber) return res.status(404).json({ error: "No subscriber profile." });

  const notification = await prisma.conceptNotification.findUnique({
    where: { id: req.params.id },
    include: { concept: true },
  });

  if (!notification || notification.subscriberId !== subscriber.id) {
    return res.status(404).json({ error: "Notification not found" });
  }
  if (notification.status !== "PENDING") {
    return res.status(409).json({ error: `Notification already handled (${notification.status})` });
  }

  if (parsed.data.decision === "DECLINE") {
    const declined = await prisma.conceptNotification.update({
      where: { id: notification.id },
      data: {
        status: "DECLINED",
        declinedAt: new Date(),
      },
    });
    return res.json({ notification: declined });
  }

  try {
    const chargeResult = await ugcBillingProvider.charge({
      amountUsd: subscriber.pricePerVideoUsd,
      customerRef: subscriber.id,
      conceptId: notification.conceptId,
    });

    const provider = chooseRecommendedProvider("AVATAR_REPURPOSE", true);
    const videoResult = await ugcVideoProvider.generate({
      provider,
      input: {
        useCase: "AVATAR_REPURPOSE",
        script: notification.concept.script,
        metadata: {
          conceptTitle: notification.concept.title,
          subscriberId: subscriber.id,
        },
      },
    });

    const [updatedNotification, charge, job] = await prisma.$transaction([
      prisma.conceptNotification.update({
        where: { id: notification.id },
        data: {
          status: "COMPLETED",
          approvedAt: new Date(),
          completedAt: new Date(),
        },
      }),
      prisma.billingCharge.upsert({
        where: { notificationId: notification.id },
        update: {
          provider: "MOCK",
          status: "SUCCEEDED",
          amountUsd: subscriber.pricePerVideoUsd,
          externalRef: chargeResult.externalRef,
          errorMessage: null,
        },
        create: {
          notificationId: notification.id,
          provider: "MOCK",
          status: "SUCCEEDED",
          amountUsd: subscriber.pricePerVideoUsd,
          externalRef: chargeResult.externalRef,
        },
      }),
      prisma.videoJob.upsert({
        where: { notificationId: notification.id },
        update: {
          requesterAgentId: req.agent!.id,
          useCase: "AVATAR_REPURPOSE",
          provider,
          status: "COMPLETED",
          inputJson: {
            script: notification.concept.script,
            metadata: { conceptId: notification.conceptId, subscriberId: subscriber.id },
          },
          externalJobId: videoResult.externalJobId,
          outputUrl: videoResult.outputUrl,
          completedAt: new Date(),
          errorMessage: null,
        },
        create: {
          notificationId: notification.id,
          requesterAgentId: req.agent!.id,
          useCase: "AVATAR_REPURPOSE",
          provider,
          status: "COMPLETED",
          inputJson: {
            script: notification.concept.script,
            metadata: { conceptId: notification.conceptId, subscriberId: subscriber.id },
          },
          externalJobId: videoResult.externalJobId,
          outputUrl: videoResult.outputUrl,
          completedAt: new Date(),
        },
      }),
    ]);

    return res.json({ notification: updatedNotification, charge, job });
  } catch (error: any) {
    const failedNotification = await prisma.conceptNotification.update({
      where: { id: notification.id },
      data: { status: "FAILED", approvedAt: new Date() },
    });

    await prisma.billingCharge.upsert({
      where: { notificationId: notification.id },
      update: {
        provider: "MOCK",
        status: "FAILED",
        amountUsd: subscriber.pricePerVideoUsd,
        errorMessage: String(error?.message || "Unknown billing/video error"),
      },
      create: {
        notificationId: notification.id,
        provider: "MOCK",
        status: "FAILED",
        amountUsd: subscriber.pricePerVideoUsd,
        errorMessage: String(error?.message || "Unknown billing/video error"),
      },
    });

    return res.status(500).json({
      error: "Failed to charge and generate video",
      notification: failedNotification,
    });
  }
});

ugcRouter.post("/diy/listing-tour", requireAgent, async (req, res) => {
  const parsed = diyListingTourSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const provider = parsed.data.provider || chooseRecommendedProvider("LISTING_TOUR", false);
  const result = await ugcVideoProvider.generate({
    provider,
    input: {
      useCase: "LISTING_TOUR",
      script: parsed.data.script,
      photoUrls: parsed.data.photoUrls,
    },
  });

  const job = await prisma.videoJob.create({
    data: {
      requesterAgentId: req.agent!.id,
      useCase: "LISTING_TOUR",
      provider,
      status: "COMPLETED",
      inputJson: {
        script: parsed.data.script,
        photoUrls: parsed.data.photoUrls,
      },
      externalJobId: result.externalJobId,
      outputUrl: result.outputUrl,
      completedAt: new Date(),
    },
  });

  return res.status(201).json({ job });
});

ugcRouter.post("/diy/take-explainer", requireAgent, async (req, res) => {
  const parsed = diyTakeExplainerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const useCase = parsed.data.provider === "HEYGEN" ? "AVATAR_REPURPOSE" : "TAKE_EXPLAINER";
  const provider = parsed.data.provider || chooseRecommendedProvider("TAKE_EXPLAINER", false);

  const result = await ugcVideoProvider.generate({
    provider,
    input: {
      useCase,
      script: parsed.data.context
        ? `${parsed.data.take}\n\nContext:\n${parsed.data.context}`
        : parsed.data.take,
    },
  });

  const job = await prisma.videoJob.create({
    data: {
      requesterAgentId: req.agent!.id,
      useCase,
      provider,
      status: "COMPLETED",
      inputJson: {
        take: parsed.data.take,
        context: parsed.data.context,
      },
      externalJobId: result.externalJobId,
      outputUrl: result.outputUrl,
      completedAt: new Date(),
    },
  });

  return res.status(201).json({ job });
});

ugcRouter.get("/jobs/:id", requireAgent, async (req, res) => {
  const job = await prisma.videoJob.findUnique({ where: { id: req.params.id } });
  if (!job) return res.status(404).json({ error: "Not found" });
  if (job.requesterAgentId !== req.agent!.id) return res.status(403).json({ error: "Forbidden" });

  return res.json({ job });
});

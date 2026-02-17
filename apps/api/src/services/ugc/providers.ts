import { randomUUID } from "crypto";

export type UgcVideoUseCase = "LISTING_TOUR" | "TAKE_EXPLAINER" | "AVATAR_REPURPOSE";
export type UgcVideoProvider = "MOCK" | "KLING" | "SEEDANCE" | "HEYGEN";

export type VideoGenerationInput = {
  useCase: UgcVideoUseCase;
  script: string;
  photoUrls?: string[];
  metadata?: Record<string, unknown>;
};

export type VideoGenerationResult = {
  externalJobId: string;
  outputUrl: string;
};

export interface BillingProvider {
  charge(opts: { amountUsd: number; customerRef: string; conceptId: string }): Promise<{ externalRef: string }>;
}

export interface VideoProvider {
  generate(opts: { provider: UgcVideoProvider; input: VideoGenerationInput }): Promise<VideoGenerationResult>;
}

class MockBillingProvider implements BillingProvider {
  async charge(opts: { amountUsd: number; customerRef: string; conceptId: string }) {
    return {
      externalRef: `mock_charge_${opts.customerRef}_${opts.conceptId}_${opts.amountUsd}`,
    };
  }
}

class MockVideoProvider implements VideoProvider {
  async generate(opts: { provider: UgcVideoProvider; input: VideoGenerationInput }): Promise<VideoGenerationResult> {
    const externalJobId = `mock_video_${opts.provider.toLowerCase()}_${randomUUID()}`;
    const outputUrl = `https://cdn.example.com/videos/${externalJobId}.mp4`;
    return { externalJobId, outputUrl };
  }
}

export function chooseRecommendedProvider(useCase: UgcVideoUseCase, needsAvatarClone: boolean): UgcVideoProvider {
  if (needsAvatarClone || useCase === "AVATAR_REPURPOSE") return "HEYGEN";
  if (useCase === "LISTING_TOUR") return "KLING";
  return "SEEDANCE";
}

export const ugcBillingProvider: BillingProvider = new MockBillingProvider();
export const ugcVideoProvider: VideoProvider = new MockVideoProvider();

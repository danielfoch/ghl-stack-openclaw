import crypto from "node:crypto";
import {
  ActionEngine,
  AppStore,
  createLogger,
  loadConfig,
  type ActionRequest,
  type AppConfig
} from "@fub/core";
import { FollowUpBossAdapter, MockFubAdapter } from "@fub/adapters-fub";
import { HttpIdxAdapter, MockIdxAdapter } from "@fub/adapters-idx";
import { SendHubAdapter, MockSendHubAdapter } from "@fub/adapters-sendhub";
import { createEmailAdapter, MockEmailAdapter } from "@fub/adapters-email";
import { ElevenLabsVoiceAdapter, MockOutboundOnlyTransport, MockVoiceAdapter } from "@fub/adapters-elevenlabs";

export function createEngine(env: NodeJS.ProcessEnv = process.env): { engine: ActionEngine; config: AppConfig; store: AppStore } {
  const config = loadConfig(env);
  const logger = createLogger(config.LOG_LEVEL);
  const store = new AppStore(config.APP_DB_PATH);
  const mockMode = config.APP_ENV === "local" || config.NODE_ENV === "test";

  return {
    config,
    store,
    engine: new ActionEngine({
      config,
      store,
      fub: mockMode ? new MockFubAdapter() : new FollowUpBossAdapter({ baseUrl: config.FUB_BASE_URL, apiKey: config.FUB_API_KEY, sourceTag: config.FUB_SOURCE_TAG }),
      idx: mockMode || config.IDX_PROVIDER === "mock" ? new MockIdxAdapter() : new HttpIdxAdapter({ baseUrl: config.IDX_BASE_URL ?? "", apiKey: config.IDX_API_KEY ?? "" }),
      sms: mockMode ? new MockSendHubAdapter() : new SendHubAdapter({ baseUrl: config.SENDHUB_BASE_URL, apiKey: config.SENDHUB_API_KEY }),
      email: mockMode ? new MockEmailAdapter() : createEmailAdapter(config),
      voice: config.APP_ENABLE_ELEVENLABS ? new ElevenLabsVoiceAdapter({ apiKey: config.ELEVENLABS_API_KEY ?? "", baseUrl: config.ELEVENLABS_BASE_URL ?? "https://api.elevenlabs.io" }) : new MockVoiceAdapter(),
      outboundOnly: new MockOutboundOnlyTransport(),
      logger
    })
  };
}

export function toActionRequest(input: ActionRequest["input"], opts?: Partial<ActionRequest>): ActionRequest {
  return {
    idempotencyKey: opts?.idempotencyKey ?? crypto.randomUUID(),
    permissionScope: opts?.permissionScope ?? "webhook:execute",
    role: opts?.role ?? "assistant",
    dryRun: opts?.dryRun ?? false,
    confirm: opts?.confirm ?? true,
    verbose: opts?.verbose ?? false,
    input,
    audit: {
      source: "OpenClawScreenless",
      actor: "webhook",
      correlationId: crypto.randomUUID(),
      requestedAt: new Date().toISOString()
    }
  };
}

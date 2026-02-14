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
import { MockSlybroadcastAdapter, SlybroadcastApiAdapter } from "@fub/adapters-slybroadcast";

export function createEngine(env: NodeJS.ProcessEnv = process.env): { engine: ActionEngine; config: AppConfig } {
  const config = loadConfig(env);
  const logger = createLogger(config.LOG_LEVEL);
  const store = new AppStore(config.APP_DB_PATH);

  const mockMode = config.APP_ENV === "local" || config.NODE_ENV === "test";

  const fub = mockMode
    ? new MockFubAdapter()
    : new FollowUpBossAdapter({
        baseUrl: config.FUB_BASE_URL,
        apiKey: config.FUB_API_KEY,
        sourceTag: config.FUB_SOURCE_TAG
      });

  const idx = mockMode || config.IDX_PROVIDER === "mock"
    ? new MockIdxAdapter()
    : new HttpIdxAdapter({
        baseUrl: config.IDX_BASE_URL ?? "",
        apiKey: config.IDX_API_KEY ?? ""
      });

  const sms = mockMode
    ? new MockSendHubAdapter()
    : new SendHubAdapter({
        baseUrl: config.SENDHUB_BASE_URL,
        apiKey: config.SENDHUB_API_KEY
      });

  const email = mockMode ? new MockEmailAdapter() : createEmailAdapter(config);
  const voice = config.APP_ENABLE_ELEVENLABS
    ? new ElevenLabsVoiceAdapter({
        apiKey: config.ELEVENLABS_API_KEY ?? "",
        baseUrl: config.ELEVENLABS_BASE_URL ?? "https://api.elevenlabs.io"
      })
    : new MockVoiceAdapter();

  const outboundOnly = new MockOutboundOnlyTransport();
  const slybroadcast = config.APP_ENABLE_SLYBROADCAST && config.SLYBROADCAST_EMAIL && config.SLYBROADCAST_PASSWORD
    ? new SlybroadcastApiAdapter({
        baseUrl: config.SLYBROADCAST_BASE_URL,
        email: config.SLYBROADCAST_EMAIL,
        password: config.SLYBROADCAST_PASSWORD,
        defaultCallerId: config.SLYBROADCAST_DEFAULT_CALLER_ID
      })
    : new MockSlybroadcastAdapter();

  const engine = new ActionEngine({
    config,
    store,
    fub,
    idx,
    sms,
    slybroadcast,
    email,
    voice,
    outboundOnly,
    logger
  });

  return { engine, config };
}

export function makeRequest(partial: Omit<ActionRequest, "audit" | "idempotencyKey"> & { idempotencyKey?: string }): ActionRequest {
  return {
    idempotencyKey: partial.idempotencyKey ?? crypto.randomUUID(),
    permissionScope: partial.permissionScope,
    role: partial.role,
    dryRun: partial.dryRun,
    confirm: partial.confirm,
    verbose: partial.verbose,
    input: partial.input,
    audit: {
      source: "OpenClawScreenless",
      actor: "cli",
      correlationId: crypto.randomUUID(),
      requestedAt: new Date().toISOString()
    }
  };
}

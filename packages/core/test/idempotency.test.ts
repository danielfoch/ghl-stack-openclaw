import { describe, expect, it } from "vitest";
import { ActionEngine } from "../src/actions/engine.js";
import { AppStore } from "../src/db/store.js";
import type { AppConfig } from "../src/config.js";
import type { EmailAdapter, FubAdapter, IdxAdapter, OutboundOnlyTransport, SmsAdapter, VoiceAdapter } from "../src/types/adapters.js";

const config: AppConfig = {
  NODE_ENV: "test",
  LOG_LEVEL: "silent",
  APP_ENV: "local",
  APP_REGION_ALLOWLIST: "+1",
  APP_ALLOWED_INBOUND_EMAILS: "",
  APP_ALLOWED_INBOUND_PHONES: "",
  APP_WEBHOOK_SHARED_SECRET: "12345678",
  APP_ENCRYPTION_KEY: "12345678901234567890123456789012",
  APP_ENABLE_ELEVENLABS: false,
  APP_ALLOW_NON_US_CA: false,
  APP_DB_PATH: ":memory:",
  FUB_BASE_URL: "https://example.com",
  FUB_API_KEY: "12345678",
  FUB_SOURCE_TAG: "OpenClawScreenless",
  IDX_PROVIDER: "mock",
  IDX_BASE_URL: "https://idx.example.com",
  IDX_API_KEY: "x",
  SENDHUB_BASE_URL: "https://sendhub.example.com",
  SENDHUB_API_KEY: "12345678",
  SENDHUB_WEBHOOK_SECRET: "12345678",
  EMAIL_PROVIDER: "smtp",
  SMTP_HOST: "localhost",
  SMTP_PORT: 1025,
  SMTP_SECURE: false,
  SMTP_USER: "",
  SMTP_PASS: "",
  SMTP_FROM: "assistant@example.com",
  SENDGRID_API_KEY: "",
  MAILGUN_API_KEY: "",
  MAILGUN_DOMAIN: "",
  GMAIL_CLIENT_ID: "",
  GMAIL_CLIENT_SECRET: "",
  GMAIL_REDIRECT_URI: "https://example.com",
  GMAIL_REFRESH_TOKEN: "",
  GOG_CLI_PATH: "gog",
  ELEVENLABS_API_KEY: "",
  ELEVENLABS_BASE_URL: "https://api.elevenlabs.io"
};

describe("idempotency", () => {
  it("replays same response for same idempotency key", async () => {
    const fub: FubAdapter = {
      getPersonById: async () => null,
      searchPeople: async () => [{ id: 1, name: "John" }],
      findPersonByExternalRef: async () => null,
      upsertPerson: async () => ({ id: 9, name: "Test" }),
      addTag: async () => undefined,
      removeTag: async () => undefined,
      createNote: async () => ({ id: "note-1" }),
      createTask: async () => ({ id: "task-1" }),
      completeTask: async () => undefined,
      logCall: async () => ({ id: "call-1" }),
      logEmail: async () => ({ id: "email-1" }),
      logText: async () => ({ id: "text-1" })
    };

    const idx: IdxAdapter = {
      searchListings: async () => [],
      getListingByMlsId: async () => null,
      getListingByAddress: async () => null,
      getAgentListings: async () => [],
      enrichContactContext: async () => ({})
    };

    const sms: SmsAdapter = { sendSMS: async (message) => ({ providerMessageId: "sms-1", provider: "mock", sentAt: new Date().toISOString(), to: message.to }) };
    const email: EmailAdapter = { sendEmail: async (message) => ({ providerMessageId: "email-1", provider: "mock", sentAt: new Date().toISOString(), to: message.to }) };
    const voice: VoiceAdapter = { sendVoiceMessage: async (message) => ({ providerMessageId: "voice-1", provider: "mock", sentAt: new Date().toISOString(), to: message.to }) };
    const outboundOnly: OutboundOnlyTransport = { send: async (_channel, message) => ({ providerMessageId: "out-1", provider: "mock", sentAt: new Date().toISOString(), to: message.to }) };

    const store = new AppStore(":memory:");
    const engine = new ActionEngine({
      config,
      store,
      fub,
      idx,
      sms,
      email,
      voice,
      outboundOnly,
      logger: { info: () => undefined, error: () => undefined }
    });

    const request = {
      idempotencyKey: "idem-12345",
      permissionScope: "person:read",
      dryRun: false,
      confirm: true,
      verbose: true,
      role: "assistant" as const,
      audit: {
        source: "OpenClawScreenless",
        actor: "test",
        correlationId: "corr-1",
        requestedAt: new Date().toISOString()
      },
      input: { action: "person.find" as const, query: "john" }
    };

    const first = await engine.run(request);
    const second = await engine.run(request);

    expect(first).toEqual(second);
  });
});

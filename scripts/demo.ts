import crypto from "node:crypto";
import { ActionEngine, AppStore, type ActionRequest } from "../packages/core/src/index.js";
import { MockFubAdapter } from "../packages/adapters-fub/src/index.js";
import { MockIdxAdapter } from "../packages/adapters-idx/src/index.js";
import { MockSendHubAdapter } from "../packages/adapters-sendhub/src/index.js";
import { MockEmailAdapter } from "../packages/adapters-email/src/index.js";
import { MockOutboundOnlyTransport, MockVoiceAdapter } from "../packages/adapters-elevenlabs/src/index.js";

const engine = new ActionEngine({
  config: {
    NODE_ENV: "test",
    LOG_LEVEL: "info",
    APP_ENV: "local",
    APP_REGION_ALLOWLIST: "+1",
    APP_ALLOWED_INBOUND_EMAILS: "realtor@example.com",
    APP_ALLOWED_INBOUND_PHONES: "+14165551212",
    APP_WEBHOOK_SHARED_SECRET: "12345678",
    APP_ENCRYPTION_KEY: "12345678901234567890123456789012",
    APP_ENABLE_ELEVENLABS: false,
    APP_ALLOW_NON_US_CA: false,
    APP_DB_PATH: ":memory:",
    FUB_BASE_URL: "https://api.followupboss.com/v1",
    FUB_API_KEY: "12345678",
    FUB_SOURCE_TAG: "OpenClawScreenless",
    IDX_PROVIDER: "mock",
    IDX_BASE_URL: "https://idx.example.com",
    IDX_API_KEY: "x",
    SENDHUB_BASE_URL: "https://api.sendhub.com/v1",
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
  },
  store: new AppStore(":memory:"),
  fub: new MockFubAdapter(),
  idx: new MockIdxAdapter(),
  sms: new MockSendHubAdapter(),
  email: new MockEmailAdapter(),
  voice: new MockVoiceAdapter(),
  outboundOnly: new MockOutboundOnlyTransport(),
  logger: { info: () => undefined, error: () => undefined }
});

async function run(input: ActionRequest["input"], execute = true) {
  return engine.run({
    idempotencyKey: crypto.randomUUID(),
    permissionScope: "demo",
    role: "assistant",
    dryRun: !execute,
    confirm: execute,
    verbose: true,
    input,
    audit: {
      source: "OpenClawScreenless",
      actor: "demo",
      correlationId: crypto.randomUUID(),
      requestedAt: new Date().toISOString()
    }
  });
}

async function main() {
  const workflow1Find = await run({ action: "person.find", query: "John Smith" });
  const person = (workflow1Find.data as Array<{ id: number }>)[0];

  const workflow1Sms = await run({
    action: "message.send",
    channel: "sms",
    to: "+14165550001",
    body: "We got the docs. Can we do a call tomorrow at 3 PM?",
    person: { personId: person.id },
    logToFub: true
  });

  const workflow1Task = await run({
    action: "task.create",
    person: { personId: person.id },
    title: "Call John re docs",
    dueAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString()
  });

  const workflow2 = await run({ action: "listing.get", address: "123 Main St" });

  const workflow3Find = await run({ action: "person.find", query: "Sarah" });
  const sarah = (workflow3Find.data as Array<{ id: number }>)[0];
  const workflow3Tag = await run({ action: "person.tag.add", person: { personId: sarah.id }, tag: "HotLead" });
  const workflow3Task = await run({
    action: "task.create",
    person: { personId: sarah.id },
    title: "Follow up with Sarah",
    dueAt: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString()
  });

  console.log(JSON.stringify({
    workflow1: { find: workflow1Find, sms: workflow1Sms, task: workflow1Task },
    workflow2,
    workflow3: { find: workflow3Find, tag: workflow3Tag, task: workflow3Task }
  }, null, 2));
}

main();

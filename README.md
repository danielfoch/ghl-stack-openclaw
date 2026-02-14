# FUB Screenless MCP/CLI

MVP-to-production monorepo for hands-free realtor CRM operations using Follow Up Boss (read + write/log only), IDX context, outbound messaging, strict inbound command extraction, and auditable execution.

## Monorepo Layout

- `packages/core`: action model, schemas, orchestration engine, safety policy, idempotency, instruction parsing, SQLite persistence.
- `packages/adapters-fub`: Follow Up Boss API client + mock adapter.
- `packages/adapters-idx`: pluggable IDX adapter interface + mock + HTTP adapter.
- `packages/adapters-sendhub`: SendHub SMS sender + webhook verification + mock.
- `packages/adapters-email`: SMTP/SendGrid/Mailgun/Gmail/GOG email adapters + mock.
- `packages/adapters-elevenlabs`: optional voice adapter + outbound-only transport adapter boundary.
- `packages/mcp-server`: MCP server exposing action and workflow tools.
- `packages/cli`: operator/OpenClaw shell CLI.
- `packages/webhooks`: inbound instruction gateway (email/SMS/voice).
- `scripts/demo.ts`: end-to-end mock demo for required workflows.

## Security Design

- Inbound execution only from authenticated channels: email/SMS/voice webhook endpoints.
- Outbound-only channels (`imessage`, `whatsapp`) are send-only transport adapters and never used for inbound commands.
- Command extraction executes only:
  - `BEGIN_FUB_CMD ... END_FUB_CMD` JSON envelope, or
  - `/fub ...` slash commands.
- Everything else in inbound text is ignored for execution.
- Actions use allowlisted schemas, role checks, and permission scopes.
- `dry_run=true` is default in MCP tool API; writes require `confirm=true` and `dry_run=false`.
- Idempotency keys persisted in SQLite; replay returns cached result.
- Webhook replay protection via provider event dedupe table.
- Webhook rate limiting (sliding window).
- Outbound safety policy blocks likely secret exfiltration, command directives, non-allowed region sends, and mass sends by default.
- Outbound logs include content hash and encrypted body.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure env:

```bash
cp .env.example .env
```

3. Update provider credentials and allowlists in `.env`.

## Build & Test

```bash
npm run build
npm run test
```

## Run MCP Server

```bash
npm run dev:mcp
```

MCP tools:
- `fub_action`
- `workflow_text_and_task`
- `workflow_listing_status`
- `workflow_hotlead_task`

## Run CLI

Build first:

```bash
npm run build
```

Examples:

```bash
node packages/cli/dist/index.js who "john smith" --pretty
node packages/cli/dist/index.js note --person "+14165550001" --text "Left voicemail" --confirm --pretty
node packages/cli/dist/index.js task create --person "john@example.com" --title "Follow up" --due "2026-02-15" --confirm --pretty
node packages/cli/dist/index.js sms send --to "+14165550001" --body "We got the docs" --person "john@example.com" --confirm --pretty
node packages/cli/dist/index.js idx search --city Toronto --minBeds 2 --maxPrice 900000 --pretty
node packages/cli/dist/index.js plan --from-message ./inbound.txt --dry-run --pretty
```

## Webhooks (Inbound Instructions)

Start server:

```bash
npm run dev:webhooks
```

Endpoints:
- `POST /inbound/sendhub` (SMS)
- `POST /inbound/email`
- `POST /inbound/voice`

Expected controls:
- Shared secret header: `x-webhook-secret`
- SendHub signature header: `x-sendhub-signature`
- Event id header for replay defense: `x-event-id`

## Adapter Configuration

- FUB: `FUB_BASE_URL`, `FUB_API_KEY`, `FUB_SOURCE_TAG`
- IDX: `IDX_PROVIDER` (`mock` or custom HTTP), `IDX_BASE_URL`, `IDX_API_KEY`
- SendHub: `SENDHUB_BASE_URL`, `SENDHUB_API_KEY`, `SENDHUB_WEBHOOK_SECRET`
- Email: `EMAIL_PROVIDER` in `smtp|sendgrid|mailgun|gmail|gog`
- ElevenLabs optional: `APP_ENABLE_ELEVENLABS=true` + `ELEVENLABS_API_KEY`

## Command Envelope Examples

JSON envelope:

```text
BEGIN_FUB_CMD
{"idempotencyKey":"abc12345","action":"task.create","input":{"person":{"name":"John Smith"},"title":"Call John","dueAt":"2026-02-15T15:00:00Z"}}
END_FUB_CMD
```

Slash command:

```text
/fub task create "Call John re: offer" due:tomorrow person:"John Smith"
```

## Required Workflow Demo

Runs the three required flows using mocks:

```bash
npm run demo
```

It executes:
1. Text John + create tomorrow task.
2. Query listing status for `123 Main St` from IDX mock.
3. Add `HotLead` tag to Sarah + follow-up task in 2 days.

## Notes

- FUB adapter is intentionally wrapped behind a stable interface to support future OAuth and endpoint changes.
- IDX adapter is vendor-pluggable.
- iMessage/wacli flows are supported as outbound-only transport boundaries.
- Logging back into FUB is automatic after successful outbound send when a person can be resolved.

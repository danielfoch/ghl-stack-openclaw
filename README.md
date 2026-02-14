# FUB Screenless MCP/CLI

MVP-to-production monorepo for hands-free realtor CRM operations using Follow Up Boss (read + write/log only), IDX context, outbound messaging, strict inbound command extraction, and auditable execution.

## Monorepo Layout

- `packages/core`: action model, schemas, orchestration engine, safety policy, idempotency, instruction parsing, SQLite persistence.
- `packages/adapters-fub`: Follow Up Boss API client + mock adapter.
- `packages/adapters-idx`: pluggable IDX adapter interface + mock + HTTP adapter.
- `packages/adapters-sendhub`: SendHub SMS sender + webhook verification + mock.
- `packages/adapters-email`: SMTP/SendGrid/Mailgun/Gmail/GOG email adapters + mock.
- `packages/adapters-kvcore`: KVcore Public API v2 adapter + optional Twilio call fallback.
- `packages/adapters-elevenlabs`: optional voice adapter + outbound-only transport adapter boundary.
- `packages/adapters-slybroadcast`: Slybroadcast voicemail drop adapter + mock.
- `packages/mcp-server`: MCP server exposing action and workflow tools.
- `packages/cli`: operator/OpenClaw shell CLI.
- `packages/kvcore-mcp-server`: MCP server for KVcore contact/calls/email/text operations.
- `packages/kvcore-cli`: KVcore CLI for direct CRM operations.
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
- `slybroadcast_drop_voicemail`
- `slybroadcast_get_audio_list`
- `slybroadcast_get_campaign_status`
- `workflow_text_and_task`
- `workflow_listing_status`
- `workflow_hotlead_task`

KVcore MCP server:

```bash
npm run dev:kvcore-mcp
```

KVcore MCP tools include:
- `kvcore_capabilities`
- `kvcore_contact_search`
- `kvcore_contact_get`
- `kvcore_contact_create`
- `kvcore_contact_update`
- `kvcore_contact_tag_add`
- `kvcore_contact_tag_remove`
- `kvcore_note_add`
- `kvcore_call_log`
- `kvcore_call_schedule`
- `kvcore_email_send`
- `kvcore_text_send`
- `kvcore_user_tasks`
- `kvcore_user_calls`
- `kvcore_campaigns_refresh`
- `kvcore_request`
- `twilio_call_create`

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
node packages/cli/dist/index.js voicemail drop --to "+14165550001,+14165550002" --audio-url "https://example.com/audio.mp3" --campaign-name "Open House Follow-up" --confirm --pretty
node packages/cli/dist/index.js voicemail drop --to "+14165550001" --elevenlabs-text "Hi, this is a quick update about your showing." --confirm --pretty
node packages/cli/dist/index.js voicemail audio-list --confirm --pretty
node packages/cli/dist/index.js voicemail campaign-status --campaign-id 123456 --confirm --pretty
```

KVcore CLI:

```bash
node packages/kvcore-cli/dist/index.js contact search --query "john smith" --pretty
node packages/kvcore-cli/dist/index.js email:send --contact-id 123 --subject "Quick update" --body "Following up..." --pretty
node packages/kvcore-cli/dist/index.js text:send --contact-id 123 --body "Can we connect today?" --pretty
node packages/kvcore-cli/dist/index.js call:schedule --json '{"contact_id":123,"user_id":456,"scheduled_at":"2026-02-15 10:00:00"}' --pretty
node packages/kvcore-cli/dist/index.js user tasks --user-id 456 --pretty
node packages/kvcore-cli/dist/index.js call:twilio --to "+14165550001" --twiml "<Response><Say>Hello from your assistant.</Say></Response>" --pretty
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
- Slybroadcast optional: `APP_ENABLE_SLYBROADCAST=true` + `SLYBROADCAST_EMAIL` + `SLYBROADCAST_PASSWORD`
- ElevenLabs for voicemail audio generation: `ELEVENLABS_TTS_VOICE_ID` and `SLYBROADCAST_PUBLIC_AUDIO_BASE_URL` (public URL where generated MP3 files are reachable by Slybroadcast)
- KVcore: `KVCORE_BASE_URL`, `KVCORE_API_TOKEN`, `KVCORE_TIMEOUT_MS`
- Twilio fallback (optional): `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`

## KVcore Scope Notes

KVcore Public API v2 supports contact operations, notes, call logging, send email/text to contact, schedule call, and read-only user tasks/calls.

Public API v2 does not currently expose generic workflow automation CRUD or task creation/completion endpoints. Use:
- `kvcore_request` for newly released endpoints not wrapped yet.
- `twilio_call_create` for direct outbound calls when KVcore calling features are not sufficient.

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

## SkySlope Deal Manager (New)

A new package is available at `packages/skyslope-deal-manager` for transaction/deal office workflows:

- CLI runtime: `npm run dev:skyslope-cli -- <command>`
- MCP server runtime: `npm run dev:skyslope-mcp`
- Build package: `npm run build:skyslope`

See `packages/skyslope-deal-manager/README.md` for commands and env variables.

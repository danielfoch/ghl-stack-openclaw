# Realtor OpenClaw Bridge (NexOne/Faltour/Lone Wolf)

MCP server + CLI bridge for syncing OpenClaw realtor entities/events with NexOne, Faltour, and Lone Wolf.

## What is implemented

- Unified service abstraction for three targets: `nexone`, `faltour`, `lonewolf`.
- MCP tools for health, pull, push, fanout, and event-log retrieval.
- CLI commands for operator workflows.
- SQLite event log + cursor persistence for resumable pulls.

## Notes on API coverage

- Lone Wolf: implemented against public API host and endpoint style from the published Transact OpenAPI (`https://apidocs.lwolf.com/doc/transact-api.json`).
- NexOne/Faltour: no stable public OpenAPI was discoverable from the provided public pages. This package uses configurable JSON HTTP adapter paths so you can point to the exact endpoints your account exposes.

## Environment variables

```bash
OPENCLAW_BRIDGE_DB_PATH=./openclaw-bridge.db

LONEWOLF_BASE_URL=https://api.pre.lwolf.com
LONEWOLF_BEARER_TOKEN=
LONEWOLF_SUBSCRIPTION_KEY=
LONEWOLF_USER_ID=
LONEWOLF_TIMEOUT_MS=30000

NEXONE_BASE_URL=
NEXONE_API_KEY=
NEXONE_PULL_PATH=/api/mls/listings
NEXONE_PUSH_PATH=/api/openclaw/events

FALTOUR_BASE_URL=
FALTOUR_API_KEY=
FALTOUR_PULL_PATH=/api/mls/listings
FALTOUR_PUSH_PATH=/api/openclaw/events
```

## CLI usage

```bash
npm --workspace @fub/realtor-openclaw-bridge run dev:cli -- health --provider lonewolf

npm --workspace @fub/realtor-openclaw-bridge run dev:cli -- pull \
  --provider lonewolf \
  --resource offers \
  --user-id "YOUR_USER_ID"

npm --workspace @fub/realtor-openclaw-bridge run dev:cli -- push \
  --provider nexone \
  --entity-type listing \
  --payload-json '{"listingId":"123","status":"active"}'

npm --workspace @fub/realtor-openclaw-bridge run dev:cli -- fanout \
  --providers "nexone,faltour,lonewolf" \
  --entity-type contact \
  --payload-json '{"contactId":"abc","email":"lead@example.com"}'

npm --workspace @fub/realtor-openclaw-bridge run dev:cli -- events --limit 20
```

## MCP runtime

```bash
npm --workspace @fub/realtor-openclaw-bridge run dev:mcp
```

Exposed tools:
- `openclaw_bridge_health`
- `openclaw_bridge_pull`
- `openclaw_bridge_push`
- `openclaw_bridge_fanout`
- `openclaw_bridge_recent_events`

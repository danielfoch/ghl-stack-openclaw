# CREA DDF MCP + CLI

Production-focused MCP server and CLI for CREA/REALTOR.ca DDF (RESO Web API / OData).

## Binaries

- `crea-ddf-mcp` (MCP stdio server)
- `crea-ddf` (CLI)

## Environment

Required:

- `DDF_BASE_URL`
- `DDF_AUTH_URL`
- `DDF_TOKEN_GRANT` (`client_credentials` or `password`)

For `client_credentials` grant:

- `DDF_CLIENT_ID`
- `DDF_CLIENT_SECRET`

For `password` grant:

- `DDF_USERNAME`
- `DDF_PASSWORD`

Optional:

- `DDF_SCOPE`
- `DDF_PROPERTY_KEY_STYLE` (`quoted` default)
- `DDF_DEFAULT_TOP` (`25`)
- `DDF_MAX_TOP` (`200`)
- `DDF_HTTP_TIMEOUT_MS` (`30000`)
- `DDF_HTTP_RETRIES` (`2`)
- `DDF_HTTP_CONCURRENCY` (`6`)
- `DDF_HTTP_RPS` (`8`)
- `DDF_HTTP_BURST` (`16`)
- `DDF_USER_AGENT`
- `DDF_MEDIA_ENTITY` (`Media`)
- `DDF_MEDIA_RECORD_KEY_FIELD` (`ResourceRecordKey`)
- `DDF_MEDIA_ORDER_FIELD` (`Order`)

## Claude MCP config

Add to Claude desktop MCP settings:

```json
{
  "mcpServers": {
    "crea-ddf": {
      "command": "node",
      "args": [
        "/ABSOLUTE/PATH/TO/packages/crea-ddf-mcp/dist/mcp-server.js"
      ],
      "env": {
        "DDF_BASE_URL": "https://...",
        "DDF_AUTH_URL": "https://...",
        "DDF_TOKEN_GRANT": "client_credentials",
        "DDF_CLIENT_ID": "...",
        "DDF_CLIENT_SECRET": "..."
      }
    }
  }
}
```

## Build and run

```bash
npm --workspace @fub/crea-ddf-mcp run build
npm --workspace @fub/crea-ddf-mcp run dev:mcp
npm --workspace @fub/crea-ddf-mcp run dev:cli -- search-properties --filters-json '{"city":"Toronto"}'
```

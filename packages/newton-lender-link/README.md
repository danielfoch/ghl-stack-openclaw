# newton-lender-link

CLI + MCP server for Newton Link lender-side API endpoints.

Source docs used:

- https://developer.newton.ca/link/api/
- https://newton.ca/lender-api/

## Supported endpoints

- `GET /v1/lender-details`
- `POST /v1/applications`
- `POST /v1/validations/applications`
- `POST /v1/application/documents`
- `GET /v1/pending-applications`
- `POST /v1/application-decisions/search`
- `POST /v1/application-decisions/acknowledgement`
- `POST /v1/application/updatestatus`
- `POST /v1/application/updatecompliancestatus`
- `POST /v1/credit-bureau/equifax`
- `POST /v1/credit-bureau/transunion`
- `POST /v1/life-insurance`
- `POST /v1/life-insurance-status`
- `POST /v1/life-insurance-status/acknowledgement`
- `POST /v1/valuations`

## Build

```bash
npm --workspace @fub/newton-lender-link run build
```

## Environment

Required:

- `NEWTON_LINK_CLIENT_ID`
- `NEWTON_LINK_CLIENT_SECRET`
- `NEWTON_LINK_UNIT_ID`
- `NEWTON_LINK_POS_SYSTEM_ID`

Optional:

- `NEWTON_LINK_BASE_URL` (default `https://api-link.newton.ca`)
- `NEWTON_LINK_TOKEN_URL` (default `https://api-link.newton.ca/identity/connect/token`)
- `NEWTON_LINK_SCOPE` (default `Link.Pos.Api`)
- `NEWTON_LINK_TIMEOUT_MS` (default `30000`)

## CLI quick start

Get lender/product details:

```bash
npm --workspace @fub/newton-lender-link run dev:cli -- lender-details
```

Submit application from JSON file:

```bash
npm --workspace @fub/newton-lender-link run dev:cli -- submit-application \
  --json-file ./payloads/newton-submit-application.json
```

Validate application:

```bash
npm --workspace @fub/newton-lender-link run dev:cli -- validate-application \
  --json-file ./payloads/newton-validate-application.json
```

Property valuation:

```bash
npm --workspace @fub/newton-lender-link run dev:cli -- property-valuation \
  --json-file ./payloads/newton-valuation.json
```

## MCP server

```bash
npm --workspace @fub/newton-lender-link run dev:mcp
```

Tool names are prefixed with `newton_link_...` and map one-to-one to the endpoints.

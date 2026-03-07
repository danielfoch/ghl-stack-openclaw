# Velocity Mortgage API CLI + MCP

TypeScript CLI and MCP server for Newton Velocity Mortgage API v1.

Source docs: https://developer.newton.ca/velocity/v1/index.html

## Implemented endpoint coverage

- `POST /v1/contacts/contact`
- `GET /v1/contacts/contact/sample`
- `POST /v1/deals/deal`
- `GET /v1/deals/deal/sample`
- `GET /v1/deals`
- `POST /v1/deals/search`

## Environment variables

```bash
VELOCITY_BASE_URL=https://api-velocity.newton.ca/api/forms
VELOCITY_API_KEY=
VELOCITY_TIMEOUT_MS=30000
VELOCITY_API_KEY_QUERY_PARAM=apiKey
```

`VELOCITY_API_KEY_QUERY_PARAM` defaults to `apiKey`. If your tenant expects lowercase `apikey`, set it explicitly.

## CLI usage

```bash
npm --workspace @fub/velocity-mortgage run dev:cli -- contact-sample

npm --workspace @fub/velocity-mortgage run dev:cli -- deal-sample

npm --workspace @fub/velocity-mortgage run dev:cli -- contact-create \
  --body-file ./contact.json

npm --workspace @fub/velocity-mortgage run dev:cli -- deal-create \
  --body-file ./deal.json

npm --workspace @fub/velocity-mortgage run dev:cli -- deals \
  --loan-code VXXXX-12345

npm --workspace @fub/velocity-mortgage run dev:cli -- deals-search \
  --body-json '{"statuses":[2],"dateType":1,"startDate":"2026-02-01T00:00:00Z","endDate":"2026-02-19T23:59:59Z"}'
```

## MCP runtime

```bash
npm --workspace @fub/velocity-mortgage run dev:mcp
```

Exposed tools:

- `velocity_contact_create`
- `velocity_contact_sample`
- `velocity_deal_create`
- `velocity_deal_sample`
- `velocity_deals_get`
- `velocity_deals_search`
- `velocity_raw_request`

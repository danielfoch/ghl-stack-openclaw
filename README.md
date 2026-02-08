# CREA DDF MCP (REALTOR.ca DDF)

Minimal MCP server that exposes a compliance-safe subset of a DDF RESO Web API / OData feed.

## Tools

- `ddf.search_properties`: Structured filters -> compiled OData `$filter` with allowlisted fields.
- `ddf.get_property`: Fetch one property by `ListingKey` (or your configured key) with allowlisted fields.
- `ddf.get_property_media`: Fetch media records for a property (endpoint depends on your DDF deployment; configurable).
- `ddf.get_metadata`: Fetch `/$metadata` (raw; cached) to help clients understand fields and enums.

## Setup

1. Install deps

```bash
npm i
```

2. Configure env vars (see `.env.example`)

3. Run

```bash
npm run dev
```

## Docker

```bash
docker build -t crea-ddf-mcp .
docker run --rm -i --env-file .env crea-ddf-mcp
```

## Notes

- This repo deliberately does not allow arbitrary `$filter`, arbitrary `$select`, or arbitrary URL paths.
- You will likely need to adjust:
  - the exact auth grant for your DDF environment
  - the media endpoint (some deployments expose `Media`, others use `PropertyMedia`, others use an `$expand`): use `DDF_MEDIA_ENTITY` + `DDF_MEDIA_RECORD_KEY_FIELD`
  - the property key style (quoted string vs unquoted numeric)

# SkySlope MCP/CLI Deal Manager

Transaction, paperwork, and compliance-check manager for real-estate deal offices using SkySlope + local deal intelligence DB.

## Features

- SkySlope API transaction sync (OAuth client credentials).
- CLI + MCP server for Claude/OpenClaw workflows.
- Naming normalization/validation (`123MAINST_APS` style).
- Document ingestion pipeline with extraction checks:
  - initials/signatures presence
  - buyer/seller, realtor, lawyer/escrow info
  - closing date
  - conditions/contingencies and clauses
- Local SQLite deal/document store for LLM retrieval.
- Plugin interfaces and implementations for:
  - OpenAI-assisted PDF split (`OPENAI_API_KEY`)
  - Gemini nano-pdf authoring (`GEMINI_API_KEY`)
  - `langextract` HTTP structured extraction endpoint

## Env

Set in `.env` (or shell env):

- `SKY_SLOPE_BASE_URL`
- `SKY_SLOPE_CLIENT_ID`
- `SKY_SLOPE_CLIENT_SECRET`
- `SKY_SLOPE_SCOPE` (optional)
- `SKY_SLOPE_TRANSACTIONS_PATH` (default `/api/transactions/{transactionId}`)
- `SKY_SLOPE_FILES_PATH` (default `/api/transactions/{transactionId}/files`)
- `SKY_SLOPE_FILE_CONTENT_PATH` (default `/api/files/{fileId}/download`)
- `DEAL_DB_PATH` (default `./skyslope-deals.db`)
- `OPENAI_API_KEY`, `OPENAI_MODEL`
- `GEMINI_API_KEY`, `GEMINI_MODEL`
- `LANGEXTRACT_ENDPOINT`, `LANGEXTRACT_API_KEY`

## CLI examples

```bash
npm --workspace @fub/skyslope-deal-manager run dev:cli -- sync-transaction --transaction-id 12345
npm --workspace @fub/skyslope-deal-manager run dev:cli -- ingest-text --deal-id 12345 --file ./docs/aps.txt --category APS
npm --workspace @fub/skyslope-deal-manager run dev:cli -- ingest-pdf --deal-id 12345 --file ./docs/aps.pdf --category APS
npm --workspace @fub/skyslope-deal-manager run dev:cli -- validate-name --name 123MAINST_APS
npm --workspace @fub/skyslope-deal-manager run dev:cli -- suggest-name --address "123 Main St" --type APS
npm --workspace @fub/skyslope-deal-manager run dev:cli -- deal --id 12345
npm --workspace @fub/skyslope-deal-manager run dev:cli -- plugin:author-doc --title "Amendment" --instructions "Draft amendment to closing date"
```

## MCP server

```bash
npm --workspace @fub/skyslope-deal-manager run dev:mcp
```

Exposed tools:
- `skyslope_sync_transaction`
- `skyslope_ingest_document_text`
- `skyslope_ingest_document_pdf`
- `skyslope_validate_deal_name`
- `skyslope_suggest_deal_name`
- `skyslope_query_local_deals`
- `skyslope_get_deal_bundle`

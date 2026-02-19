# Filogix Task Playbook

Use this mapping when translating user requests into API actions.

## Common Task Shapes

### Intake / Create Application

- Typical methods: `POST`
- Inputs: borrower data, loan details, consent/metadata
- Guardrails: validate required fields, use idempotency key

### Fetch / Review Application

- Typical methods: `GET`
- Inputs: application identifier, optional expansion query params
- Guardrails: no write flag needed; safe for broad retrieval

### Update / Correct Data

- Typical methods: `PATCH` or `PUT`
- Inputs: partial or full update payload
- Guardrails: require explicit approved fields and `--allow-write`

### Submit / Advance Stage

- Typical methods: `POST` or `PATCH`
- Inputs: status target and optional transition metadata
- Guardrails: pre-check current state; enforce idempotency

### Pull Documents / Conditions / Notes

- Typical methods: `GET`
- Inputs: file IDs, entity IDs, filters
- Guardrails: save binary/text outputs with deterministic filenames

## Execution Template

1. Query existing state (`GET`).
2. Validate requested change against current state.
3. Perform write (`POST|PATCH|PUT|DELETE`) with `--allow-write`.
4. Re-read (`GET`) to verify final state.
5. Return concise result summary plus response artifacts path.

## Minimum Result Format

- Task requested
- Endpoints used
- Entity IDs touched
- Before/after status
- Any partial failures
- Manual follow-up required (if any)

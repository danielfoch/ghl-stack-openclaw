---
name: filogix-expert-api
description: Execute Filogix Expert work through API calls with auditable, safety-gated workflows. Use when a user asks an AI agent to perform Filogix actions programmatically (application intake, updates, document/status retrieval, submissions, pipeline checks, partner sync, or bulk operations), and when the task can be mapped to Filogix Expert API endpoints.
---

# Filogix Expert API

Use this skill to convert human Filogix Expert operations into deterministic API workflows with:

- endpoint capability mapping from an OpenAPI spec
- guarded read/write execution with explicit write approval
- request/response logging for auditability and repeatability

If the user asks to "do everything a human can do", treat that as:

- enumerate all API-supported capabilities
- identify UI-only operations not exposed by API
- automate every exposed capability end-to-end

## Workflow

### 1. Confirm API basis and credentials

- Require `base_url` and at least one auth mode:
- `FILOGIX_EXPERT_TOKEN` (Bearer token), or
- `FILOGIX_EXPERT_API_KEY` (+ header name if non-standard).
- Require OpenAPI file (`json` preferred) for full capability mapping.

### 2. Build capability matrix from OpenAPI

Run:

```bash
python3 skills/filogix-expert-api/scripts/build_capability_matrix.py \
  --spec /path/to/filogix-openapi.json \
  --out output/filogix/capability-matrix.md
```

This file is the source of truth for what is automatable via API.

### 3. Translate a human task into API calls

For each user request:

1. Find matching endpoint(s) in `capability-matrix.md`.
2. Build required payload shape from the operation schema.
3. Execute reads first, then writes.
4. Use idempotency headers when supported.
5. Capture outputs in `output/filogix/`.

### 4. Execute with safety gates

Use `filogix_client.py` for all calls. Writes are blocked unless explicitly allowed.

Read example:

```bash
python3 skills/filogix-expert-api/scripts/filogix_client.py \
  --base-url "https://api.example.filogix.com" \
  --method GET \
  --path "/v1/applications/12345" \
  --auth-mode bearer \
  --output output/filogix/application-12345.json
```

Write example:

```bash
python3 skills/filogix-expert-api/scripts/filogix_client.py \
  --base-url "https://api.example.filogix.com" \
  --method PATCH \
  --path "/v1/applications/12345" \
  --auth-mode bearer \
  --body '{"status":"submitted"}' \
  --allow-write \
  --idempotency-key "app-12345-submit-20260219"
```

### 5. Report coverage and gaps

- List completed actions with request IDs and endpoint paths.
- Explicitly mark UI-only tasks not represented in API spec.
- For uncovered capabilities, propose fallback (manual step or integration request).

## Scripts

- `scripts/build_capability_matrix.py`
- Parse OpenAPI (`json` or `yaml`) and output capability matrix Markdown.

- `scripts/filogix_client.py`
- Execute authenticated Filogix API calls with dry-run support and write gating.

## References

- `references/filogix-api-onboarding.md`
- `references/filogix-task-playbook.md`

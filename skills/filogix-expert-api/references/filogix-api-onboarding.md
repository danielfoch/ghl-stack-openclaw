# Filogix API Onboarding

## Required Inputs

- `base_url`: Filogix Expert API host URL.
- Auth details:
- Bearer mode: `FILOGIX_EXPERT_TOKEN`
- API key mode: `FILOGIX_EXPERT_API_KEY` (+ custom header name if needed)
- OpenAPI spec file for capability inventory.

## One-Time Setup

1. Export credentials in the shell session.
2. Verify read access with a harmless endpoint (health/profile/list).
3. Generate `output/filogix/capability-matrix.md` from the OpenAPI spec.
4. For each high-value workflow, document:
- endpoint(s)
- required request fields
- idempotency support
- expected success/error codes

## Safety Defaults

- Use `--dry-run` before first execution of each new endpoint pattern.
- Never execute write methods without explicit user intent.
- Include idempotency keys for any create/submit-like operation.
- Persist raw responses to `output/filogix/` for auditability.

## Coverage Definition

"Everything a human can do" should be evaluated as:

1. API-exposed and automatable now.
2. API-exposed but blocked by missing credentials/roles.
3. Not API-exposed (UI-only/manual).

Report all three categories explicitly.

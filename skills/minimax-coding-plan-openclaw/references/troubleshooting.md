# MiniMax Coding Plan Troubleshooting (OpenClaw)

## 1) `HTTP 500 api_error: insufficient balance (1008)`

This typically means OpenClaw is not effectively running through a valid Coding Plan entitlement/key path.

Checks:

- Verify the active environment key is the intended MiniMax Coding Plan key.
- Verify OpenClaw is calling `https://api.minimax.io/v1`.
- Verify account/project billing and plan status in MiniMax console.
- Restart worker/cron processes after updating secrets.

## 2) `400 No tool call found for function call output with call_id ...`

This appears when the runtime attempts to send tool output for a tool call ID that was never emitted in the model turn (or was lost by retry/fallback path changes).

Common causes:

- Provider/model fallback switched to a model that does not support tool calling.
- Tool-call phase failed upstream, but the runner still tried to submit tool output.
- Cross-turn call IDs were reused incorrectly after an error.

Fix pattern:

1. Enforce `supports_tools=true` in model selection for tool-enabled jobs.
2. Abort tool-output submission if no valid tool-call object exists in the immediate prior model response.
3. On provider error/retry, discard stale call IDs and request a fresh model turn.
4. Keep a per-turn correlation ID in logs (`job_id`, `turn_id`, `provider_request_id`).

## 3) Recommended Job Routing Guardrail

Before dispatching a job with tools:

- Confirm selected model supports tool calling.
- Confirm provider route is healthy.
- If either check fails, pick a backup model that also supports tools.
- If no safe fallback exists, fail fast with clear operator alert.

## 4) Minimal Validation Sequence After Fix

1. Run one non-tool cron job.
2. Run one tool-enabled cron job.
3. Confirm both complete without provider 5xx/4xx.
4. Re-enable normal schedule.

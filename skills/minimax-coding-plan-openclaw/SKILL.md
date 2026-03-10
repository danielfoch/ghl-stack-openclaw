---
name: minimax-coding-plan-openclaw
description: Configure OpenClaw to use the MiniMax M2.5 Coding Plan route (not standard API billing) with tool-use-safe model settings, then validate runtime health and fix common call_id/tool-call errors.
---

# MiniMax Coding Plan for OpenClaw

Use this skill when OpenClaw should run on MiniMax M2.5 via the Coding Plan path, especially when jobs fail with provider balance or tool-calling mismatches.

## What This Skill Solves

- Move OpenClaw from normal API-credit routing to MiniMax Coding Plan routing.
- Keep tool use enabled on models that actually support tool calls.
- Troubleshoot:
  - `HTTP 500 api_error: insufficient balance (1008)`
  - `400 No tool call found for function call output with call_id ...`

## Required Secrets

Set these in your OpenClaw runtime environment (never commit in repo files):

- `MINIMAX_API_KEY` (Coding Plan key)

Optional but recommended:

- `OPENCLAW_LLM_PRIMARY_MODEL` (set to `MiniMax-M2.5`)
- `OPENCLAW_LLM_ENABLE_TOOLS` (`true` for tool workflows)

## Setup Workflow

### 1. Use Coding Plan credentials (not regular API-only balance)

Ensure the key comes from MiniMax Coding Plan provisioning. If the platform returns `1008`, treat that as account/billing/path mismatch first.

### 2. Point OpenClaw provider to MiniMax OpenAI-compatible endpoint

Use MiniMax OpenAI-compatible base URL:

- `https://api.minimax.io/v1`

Set model to:

- `MiniMax-M2.5`

### 3. Keep tool support aligned with model

If a scheduled job uses tool calls, do not route that job through models/providers that do not support tool calling.

### 4. Validate with one tool-enabled job

Run one known tool-using cron job manually and confirm:

- No `1008` responses
- No orphaned `call_id` tool-output errors
- Tool phase and final assistant phase both complete

## Quick Operator Checklist

1. Confirm active key source is Coding Plan key.
2. Confirm endpoint is `https://api.minimax.io/v1`.
3. Confirm model is `MiniMax-M2.5`.
4. Confirm tool-using jobs are not routed to free/non-tool models in any cascade fallback.
5. Re-run failing jobs once after config update.

## Safety Rules

- Never paste raw API keys into logs, chat transcripts, git commits, or skill files.
- If a key has been exposed in chat, rotate it immediately and update runtime secrets.
- For cron cascades, enforce capability checks before fallback model selection.

## References

- `references/troubleshooting.md`

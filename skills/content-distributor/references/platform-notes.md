# Platform Notes

Use this file as operational guardrails when wiring each channel webhook worker.

## LinkedIn

- Prefer first-party API posting through a member-authorized app.
- Keep post text concise; if long-form context is needed, link out.

## Threads

- Use Meta API flow tied to the connected account.
- Image + short caption is the default format.

## Facebook Personal Page

- Personal timeline posting via API can be restricted by Meta policy and app permissions.
- Keep a browser automation fallback (Playwright) if direct API is unavailable.

## Instagram

- Posting APIs are typically available for professional accounts.
- Validate image aspect ratio before dispatch.

## YouTube Feed/Community

- API coverage for community/feed posting is limited.
- Keep browser automation fallback ready and check account eligibility before publish.

## Substack Notes

- Substack supports notes in-product; API support may vary.
- Use browser automation fallback when direct API is not available.

## TikTok Image Post

- Content posting APIs may require specific account/app approval.
- Keep image-safe fallback path in automation.

## Worker Contract

Each platform worker should:

1. Validate incoming HMAC signature when `X-Content-Distributor-Signature` exists.
2. Enforce platform constraints (length, media shape, required fields).
3. Return JSON: `{ "ok": boolean, "external_id": "...", "error": "..." }`.
4. Implement retry with idempotency on `request_id + channel`.

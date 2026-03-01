---
name: content-distributor
description: Distribute one image plus source text from OpenClaw to multiple social channels with platform-aware caption variants and a single dispatch step. Use when a user wants to turn a screenshot/photo + short message into cross-posts for LinkedIn, Threads, Facebook personal page, Instagram, YouTube feed/community post, Substack note/feed post, and TikTok image post.
---

# Content Distributor

Use this skill to replace manual copy/paste posting with one intake payload and one dispatch command.

## Workflow

### 1. Collect one source payload from OpenClaw

Require:

- `image_url` or local image path
- `text` (source caption/body)

Optional:

- `title`
- `channels` (defaults to all supported channels)
- `tags`
- `link`

If OpenClaw receives MMS or screenshot uploads, pass the resolved media URL/path and user text directly to the script.

### 2. Build channel-specific variants + dispatch

Run:

```bash
python3 skills/content-distributor/scripts/distribute_content.py \
  --image "https://example.com/screenshot.jpg" \
  --text "Your source post text here" \
  --channels linkedin,threads,facebook,instagram,youtube,substack,tiktok \
  --output-dir output/content-distributor \
  --execute
```

Without `--execute`, the script runs in planning mode and only writes payload files.

The script:

- Normalizes whitespace and removes risky overlength captions
- Produces per-platform text variants
- Sends one JSON payload per channel to that channel's webhook endpoint
- Writes an audit file with per-channel delivery result

### 3. Connect each webhook to posting actions

Set one inbound webhook per platform in your automation layer (n8n, Make, Zapier, OpenClaw bridge, or internal workers):

- LinkedIn post worker
- Threads post worker
- Facebook personal posting worker
- Instagram image worker
- YouTube community/feed worker
- Substack note worker
- TikTok photo post worker

Each worker receives the same canonical payload schema from this skill and owns platform auth + retries.

## Required Environment

Set only the channels you actively use:

- `CONTENT_DISTRIBUTOR_WEBHOOK_LINKEDIN`
- `CONTENT_DISTRIBUTOR_WEBHOOK_THREADS`
- `CONTENT_DISTRIBUTOR_WEBHOOK_FACEBOOK`
- `CONTENT_DISTRIBUTOR_WEBHOOK_INSTAGRAM`
- `CONTENT_DISTRIBUTOR_WEBHOOK_YOUTUBE`
- `CONTENT_DISTRIBUTOR_WEBHOOK_SUBSTACK`
- `CONTENT_DISTRIBUTOR_WEBHOOK_TIKTOK`

Optional:

- `CONTENT_DISTRIBUTOR_SHARED_SECRET` (HMAC signature header for webhook verification)
- `CONTENT_DISTRIBUTOR_TIMEOUT_SECONDS` (default `20`)

## Canonical Payload Schema

Every webhook receives:

- `request_id`
- `timestamp_utc`
- `channel`
- `source.text`
- `source.title`
- `source.image`
- `source.link`
- `source.tags`
- `variant.text`
- `variant.hashtags`
- `variant.max_length`

## Safety Rules

- Never post without explicit `--execute`.
- If a channel webhook is missing, skip that channel and log it.
- Keep the source meaning intact across all variants; no fabricated claims.
- Keep per-platform tags concise and avoid repetitive hashtag stuffing.

## References

- `references/platform-notes.md`

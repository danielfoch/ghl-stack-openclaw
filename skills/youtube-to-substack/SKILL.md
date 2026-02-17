---
name: youtube-to-substack
description: Turn newly published YouTube videos into concise, headline-first Substack newsletter drafts for danielfoch.substack.com with embedded video blocks. Use when a user wants to monitor a YouTube channel for fresh uploads, transcribe the latest video, rewrite it in a direct analytical voice, and publish or queue a post for Substack.
---

# YouTube to Substack

Use this skill to convert each new YouTube upload into a ready-to-paste Substack draft in a short-and-sweet writing style.

## Workflow

### 1. Get New Video Metadata (ClawHub skill first)

When a YouTube scraping/monitoring skill is available in ClawHub, use that skill first to pull:

- `video_id`
- `video_url`
- `title`
- `published_at`
- `description`

If no ClawHub scraper skill is available, run the bundled fallback script (Step 2) with `--channel-id` or `--rss-url`.

### 2. Build Transcript + Substack Draft

Run:

```bash
python3 scripts/youtube_to_substack.py \
  --brand-name "Daniel Foch" \
  --substack-publication "danielfoch.substack.com" \
  --style-sample-file references/style-sample.md \
  --output-dir output/youtube-to-substack
```

Note: `--channel-id` defaults to Daniel Foch's channel (`UCeULGvCIbLn4eMpg-uGYkzQ`).

Or if you already have a specific video URL:

```bash
python3 scripts/youtube_to_substack.py \
  --video-url "https://www.youtube.com/watch?v=<VIDEO_ID>" \
  --brand-name "Daniel Foch" \
  --substack-publication "danielfoch.substack.com" \
  --style-sample-file references/style-sample.md \
  --output-dir output/youtube-to-substack
```

The script will:

- Detect the newest upload via YouTube RSS (or use provided video URL)
- Skip already-processed videos unless `--force` is set
- Pull captions via `yt-dlp` when available
- Fallback to OpenAI transcription (`gpt-4o-mini-transcribe`) when captions are unavailable
- Generate a concise Substack draft with:
  - Eye-catching heading
  - Short body copy in user style
  - YouTube embed block
  - Call-to-action for Substack readers
- Hold draft and write a notification file if the YouTube embed line is missing or mismatched

### 3. Publish in Substack

1. Open Substack post editor.
2. Paste the generated `substack_*.md` output.
3. Ensure the YouTube URL remains on its own line so Substack auto-embeds it.
4. Add tags and send/schedule.

## Required Environment

Set what you need based on your path:

- `OPENAI_API_KEY` (required for AI rewriting and transcription fallback)
- `YT2SUB_OPENAI_MODEL` (optional, default: `gpt-4.1-mini`)

Optional:

- `YT2SUB_CTA` (custom CTA line)
- `YT2SUB_SUBSTACK_PUBLICATION` (default `danielfoch.substack.com`)
- `YT2SUB_CHANNEL_ID` (default `UCeULGvCIbLn4eMpg-uGYkzQ`)

## Output Files

The script writes into `--output-dir`:

- `substack_<video_id>.md` (newsletter draft)
- `transcript_<video_id>.txt` (clean transcript)
- `video_<video_id>.json` (metadata)
- `.seen_videos.json` (dedupe state)
- `notify_<video_id>.json` (present only when embed checks fail)

## Style Guidance

Keep copy:

- Short and skimmable
- Concrete and punchy
- One clear hook in the headline
- One clear CTA to subscribe/read/reply

See `references/substack-format.md` and `references/style-sample.md`.

## Safety Rules

- Never invent claims not present in the transcript or description.
- If transcription quality is low, state uncertainty explicitly.
- Keep embedded URL tied to the same source video used for transcript.
- Preserve user voice from the style sample; do not default to generic marketing fluff.

## References

- `references/substack-format.md`
- `references/style-sample.md`

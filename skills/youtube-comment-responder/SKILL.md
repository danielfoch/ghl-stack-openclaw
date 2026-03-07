---
name: youtube-comment-responder
description: Respond to YouTube comments from CLI by listing top-level comments and posting replies using YouTube Data API v3.
---

# YouTube Comment Responder

Use this when the user needs to review or respond to comments on a YouTube video.

## Required Environment

- `YOUTUBE_API_KEY` for reading/listing comments.
- `YOUTUBE_OAUTH_TOKEN` for posting replies.

## Script

```bash
python3 scripts/youtube_comment_responder.py <command> [args...]
```

Commands:

- `list --video-id <id> [--max-results N] [--order time|relevance]`
- `reply --comment-id <id> --text "..." [--dry-run]`
- `auto-respond --video-id <id> --template "Thanks {author}" [--limit N] [--only-unreplied] [--dry-run]`

Template placeholders:

- `{author}`: commenter display name
- `{comment}`: original comment text

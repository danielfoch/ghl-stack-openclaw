#!/usr/bin/env python3
"""Create platform variants for an image post and dispatch to per-channel webhooks."""

from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List
from uuid import uuid4

SUPPORTED_CHANNELS = [
    "linkedin",
    "threads",
    "facebook",
    "instagram",
    "youtube",
    "substack",
    "tiktok",
]

CHANNEL_MAX_LENGTH = {
    "linkedin": 3000,
    "threads": 500,
    "facebook": 63206,
    "instagram": 2200,
    "youtube": 5000,
    "substack": 500,
    "tiktok": 2200,
}

CHANNEL_HASHTAGS = {
    "linkedin": ["#leadership", "#insights", "#buildinpublic"],
    "threads": ["#creators", "#buildinpublic"],
    "facebook": ["#update"],
    "instagram": ["#contentcreator", "#socialmedia"],
    "youtube": ["#community", "#update"],
    "substack": ["#notes"],
    "tiktok": ["#photomode", "#creator"],
}


@dataclass
class DispatchResult:
    channel: str
    ok: bool
    status_code: int
    error: str = ""
    response_body: str = ""


def normalize_text(text: str) -> str:
    text = re.sub(r"\s+", " ", text or "").strip()
    if not text:
        raise ValueError("Text cannot be empty")
    return text


def trim_to_limit(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    if limit <= 3:
        return text[:limit]
    return text[: limit - 3].rstrip() + "..."


def parse_channels(raw: str) -> List[str]:
    if not raw:
        return SUPPORTED_CHANNELS.copy()
    channels = [c.strip().lower() for c in raw.split(",") if c.strip()]
    unknown = [c for c in channels if c not in SUPPORTED_CHANNELS]
    if unknown:
        raise ValueError(f"Unsupported channels: {', '.join(unknown)}")
    deduped: List[str] = []
    for channel in channels:
        if channel not in deduped:
            deduped.append(channel)
    return deduped


def build_variant(channel: str, text: str) -> Dict[str, object]:
    tags = CHANNEL_HASHTAGS[channel]
    hashtag_str = " ".join(tags)
    limit = CHANNEL_MAX_LENGTH[channel]
    base = text

    if channel in {"threads", "substack"}:
        base = trim_to_limit(base, int(limit * 0.85))
    elif channel in {"linkedin", "instagram", "tiktok"}:
        base = trim_to_limit(base, int(limit * 0.9))

    composed = f"{base}\n\n{hashtag_str}" if hashtag_str else base
    composed = trim_to_limit(composed, limit)

    return {
        "text": composed,
        "hashtags": tags,
        "max_length": limit,
    }


def webhook_env_var(channel: str) -> str:
    return f"CONTENT_DISTRIBUTOR_WEBHOOK_{channel.upper()}"


def maybe_sign(secret: str, payload_bytes: bytes) -> str:
    digest = hmac.new(secret.encode("utf-8"), payload_bytes, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


def post_webhook(url: str, payload: Dict[str, object], timeout_seconds: int, shared_secret: str) -> DispatchResult:
    payload_bytes = json.dumps(payload, ensure_ascii=True).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
    }
    if shared_secret:
        headers["X-Content-Distributor-Signature"] = maybe_sign(shared_secret, payload_bytes)

    req = urllib.request.Request(url=url, data=payload_bytes, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout_seconds) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            status = getattr(resp, "status", 200)
            return DispatchResult(channel=str(payload["channel"]), ok=200 <= status < 300, status_code=status, response_body=body)
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace") if hasattr(exc, "read") else ""
        return DispatchResult(
            channel=str(payload["channel"]),
            ok=False,
            status_code=exc.code,
            error=f"HTTPError: {exc}",
            response_body=body,
        )
    except urllib.error.URLError as exc:
        return DispatchResult(
            channel=str(payload["channel"]),
            ok=False,
            status_code=0,
            error=f"URLError: {exc}",
        )


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Distribute one image+text post to channel webhook workers.")
    p.add_argument("--image", required=True, help="Image URL or local image path")
    p.add_argument("--text", required=True, help="Source caption/body text")
    p.add_argument("--title", default="", help="Optional title/headline")
    p.add_argument("--link", default="", help="Optional destination URL")
    p.add_argument("--tags", default="", help="Optional comma-separated topical tags")
    p.add_argument(
        "--channels",
        default=",".join(SUPPORTED_CHANNELS),
        help="Comma-separated channel list",
    )
    p.add_argument("--output-dir", default="output/content-distributor", help="Directory for outputs")
    p.add_argument("--execute", action="store_true", help="Actually call channel webhooks")
    p.add_argument("--request-id", default="", help="Optional idempotency key")
    return p.parse_args()


def main() -> int:
    args = parse_args()

    request_id = args.request_id.strip() or str(uuid4())
    source_text = normalize_text(args.text)
    channels = parse_channels(args.channels)
    tags = [t.strip() for t in args.tags.split(",") if t.strip()]
    timeout_seconds = int(os.getenv("CONTENT_DISTRIBUTOR_TIMEOUT_SECONDS", "20"))
    shared_secret = os.getenv("CONTENT_DISTRIBUTOR_SHARED_SECRET", "")

    if not urllib.parse.urlparse(args.image).scheme and not Path(args.image).exists():
        raise FileNotFoundError(f"Image path does not exist: {args.image}")

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    created_at = datetime.now(timezone.utc).isoformat()
    plan: List[Dict[str, object]] = []
    results: List[Dict[str, object]] = []

    for channel in channels:
        variant = build_variant(channel, source_text)
        payload: Dict[str, object] = {
            "request_id": request_id,
            "timestamp_utc": created_at,
            "channel": channel,
            "source": {
                "title": args.title.strip(),
                "text": source_text,
                "image": args.image,
                "link": args.link.strip(),
                "tags": tags,
            },
            "variant": variant,
        }

        plan.append(payload)

        if not args.execute:
            results.append(
                {
                    "channel": channel,
                    "ok": True,
                    "status_code": 0,
                    "mode": "planned",
                    "error": "",
                }
            )
            continue

        webhook = os.getenv(webhook_env_var(channel), "").strip()
        if not webhook:
            results.append(
                {
                    "channel": channel,
                    "ok": False,
                    "status_code": 0,
                    "mode": "skipped",
                    "error": f"Missing webhook env var: {webhook_env_var(channel)}",
                }
            )
            continue

        dispatch = post_webhook(webhook, payload, timeout_seconds=timeout_seconds, shared_secret=shared_secret)
        results.append(
            {
                "channel": dispatch.channel,
                "ok": dispatch.ok,
                "status_code": dispatch.status_code,
                "mode": "executed",
                "error": dispatch.error,
                "response_body": dispatch.response_body,
            }
        )

    plan_path = output_dir / f"plan_{request_id}.json"
    audit_path = output_dir / f"audit_{request_id}.json"
    plan_path.write_text(json.dumps(plan, indent=2), encoding="utf-8")
    audit_path.write_text(json.dumps(results, indent=2), encoding="utf-8")

    ok_count = sum(1 for r in results if r.get("ok"))
    print(f"request_id={request_id}")
    print(f"channels={len(channels)} ok={ok_count} failed={len(channels) - ok_count}")
    print(f"plan={plan_path}")
    print(f"audit={audit_path}")

    return 0 if ok_count == len(channels) else 2


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        raise

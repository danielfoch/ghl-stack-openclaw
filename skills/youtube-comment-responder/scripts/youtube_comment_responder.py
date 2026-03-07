#!/usr/bin/env python3
"""YouTube Comment Responder CLI.

Supports listing top-level comments and posting replies through the YouTube Data API v3.

Environment variables:
  YOUTUBE_API_KEY       Required for read/list operations.
  YOUTUBE_OAUTH_TOKEN   Required for reply operations (OAuth Bearer token).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List

BASE_URL = "https://www.googleapis.com/youtube/v3"


def _json_request(method: str, url: str, headers: Dict[str, str] | None = None, body: Dict[str, Any] | None = None) -> Dict[str, Any]:
    encoded = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=encoded, method=method)
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    if body is not None:
        req.add_header("Content-Type", "application/json")

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        detail = ""
        try:
            detail = e.read().decode("utf-8")
        except Exception:
            pass
        return {"error": {"status": e.code, "detail": detail or str(e)}}
    except urllib.error.URLError as e:
        return {"error": {"status": "connection_failed", "detail": str(e.reason)}}


def _require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise ValueError(f"{name} is required")
    return value


def _extract_comment(item: Dict[str, Any]) -> Dict[str, Any]:
    top = item.get("snippet", {}).get("topLevelComment", {})
    snippet = top.get("snippet", {})
    comment_id = top.get("id", "")
    text = snippet.get("textDisplay") or snippet.get("textOriginal") or ""
    author = snippet.get("authorDisplayName", "")
    published = snippet.get("publishedAt", "")
    reply_count = int(item.get("snippet", {}).get("totalReplyCount", 0))
    return {
        "comment_id": comment_id,
        "author": author,
        "published_at": published,
        "reply_count": reply_count,
        "text": text,
    }


def list_comments(video_id: str, max_results: int, order: str) -> Dict[str, Any]:
    api_key = _require_env("YOUTUBE_API_KEY")
    params = {
        "part": "snippet",
        "videoId": video_id,
        "maxResults": str(max_results),
        "order": order,
        "textFormat": "plainText",
        "key": api_key,
    }
    url = f"{BASE_URL}/commentThreads?{urllib.parse.urlencode(params)}"
    data = _json_request("GET", url)
    if "error" in data:
        return data

    items = data.get("items", [])
    comments = [_extract_comment(item) for item in items]
    return {
        "status": "ok",
        "video_id": video_id,
        "count": len(comments),
        "comments": comments,
        "next_page_token": data.get("nextPageToken"),
    }


def post_reply(parent_comment_id: str, text: str, dry_run: bool) -> Dict[str, Any]:
    payload = {
        "snippet": {
            "parentId": parent_comment_id,
            "textOriginal": text,
        }
    }

    if dry_run:
        return {
            "status": "dry_run",
            "parent_comment_id": parent_comment_id,
            "reply_preview": text,
        }

    token = _require_env("YOUTUBE_OAUTH_TOKEN")
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
    }
    url = f"{BASE_URL}/comments?part=snippet"
    result = _json_request("POST", url, headers=headers, body=payload)
    if "error" in result:
        return result

    reply_id = result.get("id", "")
    return {
        "status": "ok",
        "parent_comment_id": parent_comment_id,
        "reply_id": reply_id,
        "reply_text": text,
    }


def auto_respond(video_id: str, message_template: str, limit: int, only_unreplied: bool, dry_run: bool, order: str) -> Dict[str, Any]:
    listed = list_comments(video_id=video_id, max_results=max(1, min(limit, 100)), order=order)
    if "error" in listed:
        return listed

    sent: List[Dict[str, Any]] = []
    skipped: List[Dict[str, Any]] = []

    for c in listed.get("comments", []):
        if only_unreplied and c.get("reply_count", 0) > 0:
            skipped.append({"comment_id": c.get("comment_id"), "reason": "already_has_replies"})
            continue

        reply = message_template.format(author=c.get("author", "there"), comment=c.get("text", ""))
        result = post_reply(parent_comment_id=c.get("comment_id", ""), text=reply, dry_run=dry_run)
        sent.append(result)

    return {
        "status": "dry_run" if dry_run else "ok",
        "video_id": video_id,
        "attempted": len(sent),
        "skipped": skipped,
        "results": sent,
    }


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="YouTube comment responder CLI")
    sub = p.add_subparsers(dest="command", required=True)

    list_p = sub.add_parser("list", help="List top-level comments for a video")
    list_p.add_argument("--video-id", required=True)
    list_p.add_argument("--max-results", type=int, default=20)
    list_p.add_argument("--order", choices=["time", "relevance"], default="time")

    reply_p = sub.add_parser("reply", help="Reply to a specific top-level comment")
    reply_p.add_argument("--comment-id", required=True)
    reply_p.add_argument("--text", required=True)
    reply_p.add_argument("--dry-run", action="store_true", default=False)

    auto_p = sub.add_parser("auto-respond", help="Reply to multiple comments using a template")
    auto_p.add_argument("--video-id", required=True)
    auto_p.add_argument(
        "--template",
        required=True,
        help="Reply template. Supports {author} and {comment} placeholders.",
    )
    auto_p.add_argument("--limit", type=int, default=10)
    auto_p.add_argument("--order", choices=["time", "relevance"], default="time")
    auto_p.add_argument("--only-unreplied", action="store_true", default=False)
    auto_p.add_argument("--dry-run", action="store_true", default=False)

    return p


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    try:
        if args.command == "list":
            result = list_comments(video_id=args.video_id, max_results=args.max_results, order=args.order)
        elif args.command == "reply":
            result = post_reply(parent_comment_id=args.comment_id, text=args.text, dry_run=args.dry_run)
        else:
            result = auto_respond(
                video_id=args.video_id,
                message_template=args.template,
                limit=args.limit,
                only_unreplied=args.only_unreplied,
                dry_run=args.dry_run,
                order=args.order,
            )
    except ValueError as e:
        print(json.dumps({"error": {"status": "validation_failed", "detail": str(e)}}, indent=2))
        return 1

    print(json.dumps(result, indent=2))
    if "error" in result:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

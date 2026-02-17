#!/usr/bin/env python3
"""Build a Substack-ready draft from the latest YouTube upload."""

from __future__ import annotations

import argparse
import datetime as dt
import html
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, Dict, List, Optional

RSS_TEMPLATE = "https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"
OPENAI_API_BASE = "https://api.openai.com/v1"
DEFAULT_YOUTUBE_CHANNEL_ID = os.getenv("YT2SUB_CHANNEL_ID", "UCeULGvCIbLn4eMpg-uGYkzQ")
DEFAULT_MODEL = os.getenv("YT2SUB_OPENAI_MODEL", "gpt-4.1-mini")
DEFAULT_CTA = os.getenv(
    "YT2SUB_CTA",
    "If this was useful, subscribe at danielfoch.substack.com for deeper analysis.",
)
DEFAULT_SUBSTACK_PUBLICATION = os.getenv("YT2SUB_SUBSTACK_PUBLICATION", "danielfoch.substack.com")
YOUTUBE_STANDALONE_RE = re.compile(
    r"^\s*https?://(?:www\.)?(?:youtube\.com/watch\?v=[A-Za-z0-9_-]{6,}[^\s]*|youtu\.be/[A-Za-z0-9_-]{6,}[^\s]*)\s*$",
    re.IGNORECASE,
)


def run(cmd: List[str], check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, text=True, capture_output=True, check=check)


def fetch_text(url: str) -> str:
    with urllib.request.urlopen(url, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="replace")


def parse_video_id(video_url: str) -> Optional[str]:
    parsed = urllib.parse.urlparse(video_url)
    if parsed.netloc.endswith("youtu.be"):
        return parsed.path.strip("/") or None
    if parsed.query:
        q = urllib.parse.parse_qs(parsed.query)
        if "v" in q and q["v"]:
            return q["v"][0]
    match = re.search(r"/shorts/([A-Za-z0-9_-]{6,})", video_url)
    if match:
        return match.group(1)
    return None


def has_proper_youtube_embed_line(post_md: str, expected_video_id: str) -> tuple[bool, str]:
    for line in post_md.splitlines():
        if not YOUTUBE_STANDALONE_RE.match(line):
            continue
        vid = parse_video_id(line.strip())
        if not vid:
            continue
        if vid != expected_video_id:
            return (
                False,
                f"Standalone YouTube URL found, but video_id mismatch (expected {expected_video_id}, got {vid})",
            )
        return True, "Standalone YouTube URL present and matches source video"
    return False, "No standalone YouTube URL line found for Substack embed"


def latest_video_from_rss(rss_url: str) -> Dict[str, str]:
    raw = fetch_text(rss_url)
    root = ET.fromstring(raw)
    ns = {
        "atom": "http://www.w3.org/2005/Atom",
        "yt": "http://www.youtube.com/xml/schemas/2015",
        "media": "http://search.yahoo.com/mrss/",
    }
    entry = root.find("atom:entry", ns)
    if entry is None:
        raise RuntimeError("No videos found in RSS feed")

    video_id = entry.findtext("yt:videoId", default="", namespaces=ns)
    title = entry.findtext("atom:title", default="Untitled", namespaces=ns)
    published = entry.findtext("atom:published", default="", namespaces=ns)
    author = entry.findtext("atom:author/atom:name", default="", namespaces=ns)
    desc = entry.findtext("media:group/media:description", default="", namespaces=ns)

    if not video_id:
        raise RuntimeError("RSS video entry missing videoId")

    return {
        "video_id": video_id,
        "video_url": f"https://www.youtube.com/watch?v={video_id}",
        "title": title,
        "published_at": published,
        "author": author,
        "description": desc,
        "source": "rss",
    }


def normalize_text(text: str) -> str:
    text = html.unescape(text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def parse_vtt(vtt_path: Path) -> str:
    lines = vtt_path.read_text(encoding="utf-8", errors="replace").splitlines()
    keep: List[str] = []
    for line in lines:
        s = line.strip()
        if not s:
            continue
        if s.startswith("WEBVTT"):
            continue
        if "-->" in s:
            continue
        if re.fullmatch(r"\d+", s):
            continue
        s = re.sub(r"<\d{2}:\d{2}:\d{2}\.\d{3}>", "", s)
        s = re.sub(r"<c[^>]*>", "", s).replace("</c>", "")
        keep.append(normalize_text(s))

    cleaned: List[str] = []
    prev = ""
    for chunk in keep:
        if chunk and chunk != prev:
            cleaned.append(chunk)
            prev = chunk
    return "\n".join(cleaned)


def extract_captions_with_ytdlp(video_url: str, tmpdir: Path) -> Optional[str]:
    if shutil.which("yt-dlp") is None:
        return None

    output_tpl = str(tmpdir / "%(id)s")
    cmd = [
        "yt-dlp",
        "--skip-download",
        "--write-auto-subs",
        "--write-subs",
        "--sub-langs",
        "en.*",
        "--sub-format",
        "vtt",
        "-o",
        output_tpl,
        video_url,
    ]
    proc = run(cmd, check=False)
    if proc.returncode != 0:
        return None

    vtts = sorted(tmpdir.glob("*.vtt"))
    for vtt in vtts:
        txt = parse_vtt(vtt)
        if len(txt) > 100:
            return txt
    return None


def download_audio_with_ytdlp(video_url: str, tmpdir: Path) -> Optional[Path]:
    if shutil.which("yt-dlp") is None:
        return None
    output_tpl = str(tmpdir / "%(id)s.%(ext)s")
    cmd = [
        "yt-dlp",
        "-f",
        "bestaudio",
        "-x",
        "--audio-format",
        "mp3",
        "-o",
        output_tpl,
        video_url,
    ]
    proc = run(cmd, check=False)
    if proc.returncode != 0:
        return None
    mp3s = sorted(tmpdir.glob("*.mp3"))
    return mp3s[0] if mp3s else None


def openai_transcribe(audio_path: Path, api_key: str) -> str:
    if shutil.which("curl") is None:
        raise RuntimeError("curl is required for OpenAI transcription fallback")

    cmd = [
        "curl",
        "-sS",
        f"{OPENAI_API_BASE}/audio/transcriptions",
        "-H",
        f"Authorization: Bearer {api_key}",
        "-F",
        "model=gpt-4o-mini-transcribe",
        "-F",
        f"file=@{audio_path}",
    ]
    proc = run(cmd, check=False)
    if proc.returncode != 0:
        raise RuntimeError(f"OpenAI transcription failed: {proc.stderr.strip()}")
    try:
        payload = json.loads(proc.stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Invalid transcription JSON response: {exc}") from exc

    text = payload.get("text", "").strip()
    if not text:
        raise RuntimeError("Transcription response did not include text")
    return text


def call_openai_responses(prompt: str, api_key: str, model: str) -> str:
    if shutil.which("curl") is None:
        raise RuntimeError("curl is required for OpenAI draft generation")

    body = {
        "model": model,
        "input": prompt,
        "temperature": 0.5,
    }
    cmd = [
        "curl",
        "-sS",
        f"{OPENAI_API_BASE}/responses",
        "-H",
        "Content-Type: application/json",
        "-H",
        f"Authorization: Bearer {api_key}",
        "-d",
        json.dumps(body),
    ]
    proc = run(cmd, check=False)
    if proc.returncode != 0:
        raise RuntimeError(f"OpenAI responses call failed: {proc.stderr.strip()}")

    try:
        payload = json.loads(proc.stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Invalid responses JSON payload: {exc}") from exc

    text = payload.get("output_text", "").strip()
    if text:
        return text

    out = payload.get("output") or []
    chunks: List[str] = []
    for item in out:
        for content in item.get("content", []):
            if content.get("type") == "output_text":
                chunks.append(content.get("text", ""))
    merged = "\n".join(c.strip() for c in chunks if c.strip()).strip()
    if not merged:
        raise RuntimeError("Responses payload did not include output text")
    return merged


def build_fallback_post(meta: Dict[str, Any], transcript: str, brand: str) -> str:
    lines = [l.strip() for l in transcript.splitlines() if l.strip()]
    summary = " ".join(lines[:3])
    if len(summary) > 420:
        summary = summary[:417].rstrip() + "..."

    heading = f"# {meta['title']}: The Fast Breakdown"
    bullets = lines[3:9]
    takeaways: List[str] = []
    for b in bullets:
        if len(takeaways) == 3:
            break
        t = b[:140].rstrip(" .")
        if t:
            takeaways.append(f"- {t}")
    while len(takeaways) < 3:
        takeaways.append("- Key lesson from the video")

    return "\n\n".join(
        [
            heading,
            summary or (meta.get("description") or "New video summary."),
            "Here are the main points in under a minute:",
            "\n".join(takeaways),
            meta["video_url"],
            f"{DEFAULT_CTA} — {brand}",
        ]
    )


def build_ai_prompt(
    meta: Dict[str, Any], transcript: str, brand: str, style_sample: str, cta: str, substack_publication: str
) -> str:
    today = dt.datetime.now(dt.timezone.utc).date().isoformat()
    transcript_chunk = transcript[:12000]
    desc = meta.get("description", "")[:2000]

    return f"""
You are writing a Substack newsletter draft in Daniel Foch's writing voice.

Date: {today}
Brand: {brand}
Target Substack publication: {substack_publication}
Video title: {meta['title']}
Video URL: {meta['video_url']}
Video publish timestamp: {meta.get('published_at', '')}
Video description: {desc}

Voice sample from previous posts:
{style_sample}

Transcript excerpt:
{transcript_chunk}

Requirements:
1) Return markdown only.
2) Keep it short and sweet (about 120-260 words).
3) Start with a highly eye-catching headline (single # heading).
4) Add exactly two short intro paragraphs.
5) Add exactly three bullet takeaways.
6) Put the YouTube URL on its own line for Substack auto-embed.
7) End with one CTA sentence. Use this CTA unless there is a better stylistic fit: {cta}
8) Keep tone direct and concrete. No fluff.
9) Do not invent facts.
10) Keep the voice analytical and evidence-first: make the thesis clear in the opening lines, use short paragraphs, and avoid hype language.
""".strip()


def load_style_sample(path: Optional[Path]) -> str:
    if path and path.exists():
        return path.read_text(encoding="utf-8", errors="replace").strip()
    return "Short, direct, clear, and punchy writing with a practical tone."


def load_seen(path: Path) -> Dict[str, Any]:
    if path.exists():
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                return data
        except json.JSONDecodeError:
            pass
    return {"seen_video_ids": []}


def save_seen(path: Path, seen: Dict[str, Any]) -> None:
    path.write_text(json.dumps(seen, indent=2), encoding="utf-8")


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def choose_video(args: argparse.Namespace) -> Dict[str, str]:
    if args.video_url:
        video_id = parse_video_id(args.video_url)
        if not video_id:
            raise RuntimeError("Could not parse video ID from --video-url")
        return {
            "video_id": video_id,
            "video_url": args.video_url,
            "title": f"YouTube Video {video_id}",
            "published_at": "",
            "author": "",
            "description": "",
            "source": "video_url",
        }

    if args.rss_url:
        return latest_video_from_rss(args.rss_url)

    return latest_video_from_rss(RSS_TEMPLATE.format(channel_id=args.channel_id))


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--video-url", help="Specific YouTube video URL")
    p.add_argument(
        "--channel-id",
        default=DEFAULT_YOUTUBE_CHANNEL_ID,
        help="YouTube channel ID (UC...) for RSS (default: Daniel Foch)",
    )
    p.add_argument("--rss-url", help="Explicit YouTube RSS feed URL")
    p.add_argument("--brand-name", default="Your Newsletter", help="Brand or author name")
    p.add_argument(
        "--substack-publication",
        default=DEFAULT_SUBSTACK_PUBLICATION,
        help="Target Substack publication domain (e.g. danielfoch.substack.com)",
    )
    p.add_argument("--style-sample-file", help="Path to markdown/text with writing samples")
    p.add_argument("--output-dir", default="output/youtube-to-substack", help="Output directory")
    p.add_argument("--state-file", help="State file path for dedupe")
    p.add_argument("--force", action="store_true", help="Process even if already seen")
    p.add_argument(
        "--skip-ai",
        action="store_true",
        help="Skip OpenAI generation and use deterministic fallback draft",
    )
    p.add_argument(
        "--require-embed",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Require a proper standalone YouTube URL embed line; otherwise hold draft and notify",
    )
    p.add_argument(
        "--notify-file",
        help="Optional explicit path for embed-review notification JSON",
    )
    p.add_argument(
        "--fail-on-missing-embed",
        action="store_true",
        help="Exit non-zero when embed check fails (default is success with draft_needs_embed_review status)",
    )
    return p.parse_args()


def main() -> int:
    args = parse_args()

    out_dir = Path(args.output_dir).resolve()
    ensure_dir(out_dir)

    state_file = Path(args.state_file).resolve() if args.state_file else out_dir / ".seen_videos.json"
    seen = load_seen(state_file)

    meta = choose_video(args)
    video_id = meta["video_id"]
    if video_id in seen.get("seen_video_ids", []) and not args.force:
        print(f"No-op: video {video_id} already processed. Use --force to regenerate.")
        return 0

    style_sample = load_style_sample(Path(args.style_sample_file) if args.style_sample_file else None)

    transcript = ""
    with tempfile.TemporaryDirectory(prefix="yt2sub-") as td:
        tmpdir = Path(td)
        transcript = extract_captions_with_ytdlp(meta["video_url"], tmpdir) or ""

        if not transcript:
            api_key = os.getenv("OPENAI_API_KEY", "")
            if api_key:
                audio = download_audio_with_ytdlp(meta["video_url"], tmpdir)
                if audio:
                    transcript = openai_transcribe(audio, api_key)

    if not transcript:
        transcript = normalize_text(meta.get("description", ""))

    if not transcript:
        raise RuntimeError(
            "Could not build transcript. Install yt-dlp and/or set OPENAI_API_KEY for transcription fallback."
        )

    transcript_path = out_dir / f"transcript_{video_id}.txt"
    transcript_path.write_text(transcript, encoding="utf-8")

    metadata_path = out_dir / f"video_{video_id}.json"
    metadata_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")

    api_key = os.getenv("OPENAI_API_KEY", "")
    if args.skip_ai or not api_key:
        post_md = build_fallback_post(meta, transcript, args.brand_name)
    else:
        prompt = build_ai_prompt(
            meta,
            transcript,
            args.brand_name,
            style_sample,
            DEFAULT_CTA,
            args.substack_publication,
        )
        try:
            post_md = call_openai_responses(prompt, api_key, DEFAULT_MODEL)
        except RuntimeError:
            post_md = build_fallback_post(meta, transcript, args.brand_name)

    post_path = out_dir / f"substack_{video_id}.md"
    post_path.write_text(post_md.strip() + "\n", encoding="utf-8")

    embed_ok, embed_reason = has_proper_youtube_embed_line(post_md, video_id)
    status = "ok"
    publish_allowed = True
    notify_path: Optional[Path] = None
    if args.require_embed and not embed_ok:
        status = "draft_needs_embed_review"
        publish_allowed = False
        notify_path = (
            Path(args.notify_file).resolve()
            if args.notify_file
            else out_dir / f"notify_{video_id}.json"
        )
        notify_payload = {
            "status": status,
            "video_id": video_id,
            "video_url": meta["video_url"],
            "publication": args.substack_publication,
            "reason": embed_reason,
            "action": "Leave as draft and review embed before publishing",
            "draft": str(post_path),
        }
        notify_path.write_text(json.dumps(notify_payload, indent=2), encoding="utf-8")
        print(
            f"NOTIFY: embed check failed for {video_id}. Draft held for review at {post_path}.",
            file=sys.stderr,
        )

    seen_ids = seen.setdefault("seen_video_ids", [])
    if video_id not in seen_ids:
        seen_ids.append(video_id)
    save_seen(state_file, seen)

    print(
        json.dumps(
            {
                "status": status,
                "video_id": video_id,
                "video_url": meta["video_url"],
                "publication": args.substack_publication,
                "embed_ok": embed_ok,
                "embed_reason": embed_reason,
                "publish_allowed": publish_allowed,
                "draft": str(post_path),
                "transcript": str(transcript_path),
                "metadata": str(metadata_path),
                "notify": str(notify_path) if notify_path else None,
            },
            indent=2,
        )
    )
    if status != "ok" and args.fail_on_missing_embed:
        return 2
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # pylint: disable=broad-except
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)

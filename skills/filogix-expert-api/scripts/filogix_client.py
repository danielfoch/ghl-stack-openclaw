#!/usr/bin/env python3
"""Execute guarded Filogix Expert API requests with auth and audit output."""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def parse_key_value(items: list[str], separator: str) -> dict[str, str]:
    output: dict[str, str] = {}
    for raw in items:
        if separator not in raw:
            raise ValueError(f"Invalid pair '{raw}'. Expected format key{separator}value")
        key, value = raw.split(separator, 1)
        key = key.strip()
        value = value.strip()
        if not key:
            raise ValueError(f"Missing key in pair '{raw}'")
        output[key] = value
    return output


def build_headers(args: argparse.Namespace) -> dict[str, str]:
    headers = parse_key_value(args.header or [], ":")

    if args.auth_mode == "bearer":
        token = os.getenv(args.token_env)
        if not token:
            raise RuntimeError(f"Missing bearer token env var: {args.token_env}")
        headers["Authorization"] = f"Bearer {token}"
    elif args.auth_mode == "apikey":
        api_key = os.getenv(args.apikey_env)
        if not api_key:
            raise RuntimeError(f"Missing API key env var: {args.apikey_env}")
        headers[args.apikey_header] = api_key

    if args.idempotency_key:
        headers["Idempotency-Key"] = args.idempotency_key

    return headers


def build_body(args: argparse.Namespace) -> bytes | None:
    if args.body and args.body_file:
        raise RuntimeError("Use either --body or --body-file, not both.")
    if args.body_file:
        raw = Path(args.body_file).expanduser().read_text(encoding="utf-8")
        return raw.encode("utf-8")
    if args.body:
        return args.body.encode("utf-8")
    return None


def build_url(base_url: str, path: str, query: dict[str, str]) -> str:
    if not base_url.startswith(("http://", "https://")):
        raise RuntimeError("--base-url must start with http:// or https://")
    base = base_url.rstrip("/")
    normalized_path = "/" + path.lstrip("/")
    url = f"{base}{normalized_path}"
    if query:
        url = f"{url}?{urllib.parse.urlencode(query)}"
    return url


def safe_print_response(body: bytes) -> None:
    try:
        parsed = json.loads(body.decode("utf-8"))
        print(json.dumps(parsed, indent=2, ensure_ascii=True))
    except Exception:
        print(body.decode("utf-8", errors="replace"))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", required=True, help="Filogix Expert API base URL.")
    parser.add_argument("--method", required=True, help="HTTP method (GET, POST, etc.).")
    parser.add_argument("--path", required=True, help="Endpoint path, e.g. /v1/applications.")
    parser.add_argument("--query", action="append", default=[], help="Query key/value as key=value.")
    parser.add_argument("--header", action="append", default=[], help="Header key/value as key:value.")
    parser.add_argument("--body", help="Inline request body string.")
    parser.add_argument("--body-file", help="Path to request body file.")
    parser.add_argument(
        "--auth-mode",
        choices=["none", "bearer", "apikey"],
        default="bearer",
        help="Authentication mode.",
    )
    parser.add_argument("--token-env", default="FILOGIX_EXPERT_TOKEN", help="Bearer token env var.")
    parser.add_argument("--apikey-env", default="FILOGIX_EXPERT_API_KEY", help="API key env var.")
    parser.add_argument("--apikey-header", default="x-api-key", help="Header name for API key.")
    parser.add_argument("--allow-write", action="store_true", help="Required for write methods.")
    parser.add_argument("--dry-run", action="store_true", help="Print request and exit.")
    parser.add_argument("--timeout", type=float, default=30.0, help="Request timeout in seconds.")
    parser.add_argument("--idempotency-key", help="Optional idempotency key header value.")
    parser.add_argument("--output", help="Optional file path for response body.")
    args = parser.parse_args()

    method = args.method.upper().strip()
    if method in WRITE_METHODS and not args.allow_write:
        raise RuntimeError(f"{method} is write-capable. Add --allow-write to proceed.")

    query = parse_key_value(args.query or [], "=")
    headers = build_headers(args)
    body = build_body(args)
    url = build_url(args.base_url, args.path, query)

    if body is not None and "Content-Type" not in headers:
        headers["Content-Type"] = "application/json"

    print(f"Method: {method}")
    print(f"URL: {url}")
    print(f"Headers: {json.dumps(headers, indent=2, ensure_ascii=True)}")
    if body is not None:
        print("Body preview:")
        print(body.decode("utf-8", errors="replace"))

    if args.dry_run:
        print("Dry run complete. Request not sent.")
        return 0

    request = urllib.request.Request(url=url, method=method, data=body, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=args.timeout) as response:
            status = response.status
            response_body = response.read()
    except urllib.error.HTTPError as exc:
        err = exc.read()
        print(f"HTTP error: {exc.code}", file=sys.stderr)
        safe_print_response(err)
        return 1
    except urllib.error.URLError as exc:
        print(f"URL error: {exc.reason}", file=sys.stderr)
        return 1

    print(f"Status: {status}")
    safe_print_response(response_body)

    if args.output:
        output_path = Path(args.output).expanduser().resolve()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(response_body)
        print(f"Saved response: {output_path}")

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        raise SystemExit(2)

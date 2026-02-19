#!/usr/bin/env python3
"""Build a Markdown capability matrix from a Filogix Expert OpenAPI spec."""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path
from typing import Any


HTTP_METHODS = {"get", "post", "put", "patch", "delete", "options", "head"}


def load_spec(path: Path) -> dict[str, Any]:
    text = path.read_text(encoding="utf-8")
    if path.suffix.lower() == ".json":
        return json.loads(text)
    try:
        import yaml  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "YAML spec detected but PyYAML is not installed. "
            "Install PyYAML or provide a JSON spec."
        ) from exc
    return yaml.safe_load(text)


def classify_method(method: str) -> str:
    return "write" if method.lower() in {"post", "put", "patch", "delete"} else "read"


def normalize_tags(operation: dict[str, Any]) -> list[str]:
    tags = operation.get("tags") or ["untagged"]
    return [str(tag).strip() or "untagged" for tag in tags]


def build_rows(spec: dict[str, Any]) -> dict[str, list[dict[str, str]]]:
    rows: dict[str, list[dict[str, str]]] = defaultdict(list)
    for path, methods in (spec.get("paths") or {}).items():
        if not isinstance(methods, dict):
            continue
        for method, operation in methods.items():
            method_l = method.lower()
            if method_l not in HTTP_METHODS or not isinstance(operation, dict):
                continue
            summary = str(operation.get("summary") or operation.get("operationId") or "")
            risk = classify_method(method_l)
            for tag in normalize_tags(operation):
                rows[tag].append(
                    {
                        "method": method_l.upper(),
                        "path": str(path),
                        "risk": risk,
                        "summary": summary if summary else "-",
                    }
                )
    return rows


def render_markdown(spec: dict[str, Any], rows: dict[str, list[dict[str, str]]]) -> str:
    title = str(spec.get("info", {}).get("title") or "Filogix Expert API")
    version = str(spec.get("info", {}).get("version") or "unknown")

    lines = [
        f"# Capability Matrix: {title}",
        "",
        f"- API version: `{version}`",
        "- Risk labels: `read` = safe fetch, `write` = state-changing",
        "",
    ]

    if not rows:
        lines.extend(["No endpoints discovered in `paths`.", ""])
        return "\n".join(lines)

    for tag in sorted(rows):
        lines.extend([f"## {tag}", "", "| Method | Path | Risk | Summary |", "|---|---|---|---|"])
        for row in sorted(rows[tag], key=lambda x: (x["path"], x["method"])):
            lines.append(
                f"| `{row['method']}` | `{row['path']}` | `{row['risk']}` | {row['summary']} |"
            )
        lines.append("")

    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--spec", required=True, help="Path to OpenAPI spec (json or yaml).")
    parser.add_argument("--out", required=True, help="Output Markdown file path.")
    args = parser.parse_args()

    spec_path = Path(args.spec).expanduser().resolve()
    out_path = Path(args.out).expanduser().resolve()

    spec = load_spec(spec_path)
    rows = build_rows(spec)
    markdown = render_markdown(spec, rows)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(markdown, encoding="utf-8")
    print(f"Wrote capability matrix: {out_path}")
    print(f"Tags: {len(rows)}")
    print(f"Operations: {sum(len(v) for v in rows.values())}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Compatibility wrapper for users calling this tool as 'gog cli'.

Forwards all arguments to ghl-api.py.
"""

import os
import subprocess
import sys
from pathlib import Path


def main() -> int:
    script = Path(__file__).with_name("ghl-api.py")
    if not script.exists():
        print('{"error":"missing_script","message":"ghl-api.py not found next to gog-cli.py"}')
        return 1

    cmd = [sys.executable, str(script), *sys.argv[1:]]
    env = os.environ.copy()
    return subprocess.call(cmd, env=env)


if __name__ == "__main__":
    raise SystemExit(main())

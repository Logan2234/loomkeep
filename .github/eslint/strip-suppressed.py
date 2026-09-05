#!/usr/bin/env python3
"""Drop SARIF results ESLint already suppressed via an inline eslint-disable
comment. @microsoft/eslint-formatter-sarif includes them anyway (each such
result carries a `suppressions` entry with kind "inSource"), and GitHub's
generic SARIF ingestion doesn't treat that field as "already dismissed" the
way it does for CodeQL's own output -- every eslint-disable'd line in the
repo would otherwise show up as a permanently open code-scanning alert.

Usage: strip-suppressed.py <sarif-file> [<sarif-file> ...] -- edits in place.
"""

import json
import sys


def strip(path: str) -> None:
    with open(path) as f:
        sarif = json.load(f)

    for run in sarif.get("runs", []):
        run["results"] = [
            result
            for result in run.get("results", [])
            if not result.get("suppressions")
        ]

    with open(path, "w") as f:
        json.dump(sarif, f)


if __name__ == "__main__":
    for sarif_path in sys.argv[1:]:
        strip(sarif_path)

#!/usr/bin/env python3
"""Compile signature YAML files in this repo into dist/signatures.json.

This is the file `cwctl update` downloads and internal/intelligence.LoadStore
reads at scan time (see the main ChainWarden repo). Run this after adding
or editing a signature — CI (.github/workflows/validate.yml) runs it on
every PR to catch anything that fails to compile before merge.

Usage:
    python3 scripts/build_bundle.py

Requires: PyYAML (pip install pyyaml)
"""
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    import yaml
except ImportError:
    print("error: PyYAML is required — run: pip install pyyaml", file=sys.stderr)
    sys.exit(1)

REPO_ROOT = Path(__file__).resolve().parent.parent
SIGNATURE_DIRS = ["blocklisted", "typosquatting", "behavioral", "malware", "mcp", "ai-model"]
OUT_PATH = REPO_ROOT / "dist" / "signatures.json"

REQUIRED_FIELDS = ["id", "name", "type", "ecosystem", "severity", "description", "author"]
VALID_TYPES = {
    "blocklisted_package", "typosquatting_target", "behavioral_rule",
    "malware_pattern", "mcp_injection_pattern", "pickle_rule",
}
TYPE_REQUIRES = {
    "blocklisted_package": "package",
    "malware_pattern": "pattern",
    "mcp_injection_pattern": "pattern",
    "behavioral_rule": "rule",
    "pickle_rule": "rule",
    "typosquatting_target": "target",
}


def validate(sig: dict, path: Path) -> list[str]:
    problems = []
    for field in REQUIRED_FIELDS:
        if not sig.get(field):
            problems.append(f"missing: {field}")
    if sig.get("id") and not str(sig["id"]).startswith("CW-"):
        problems.append(f"id {sig['id']!r} must start with 'CW-'")
    sig_type = sig.get("type")
    if sig_type and sig_type not in VALID_TYPES:
        problems.append(f"invalid type {sig_type!r} — must be one of: {', '.join(sorted(VALID_TYPES))}")
    required_field = TYPE_REQUIRES.get(sig_type)
    if required_field and not sig.get(required_field):
        problems.append(f"{sig_type} requires: {required_field}")
    return problems


def to_detection_signature(sig: dict) -> dict:
    """Mirrors internal/intelligence.ToDetectionSignature's field mapping —
    keep these in sync if that function's shape changes."""
    out = {
        "id": sig["id"],
        "type": sig["type"],
        "ecosystem": sig["ecosystem"],
        "severity": sig["severity"],
        "title": sig["name"],
        "description": sig["description"],
        "source": "community",
    }
    for src, dst in [("package", "package"), ("pattern", "pattern"), ("rule", "rule"),
                      ("target", "target"), ("cve", "cve")]:
        if sig.get(src):
            out[dst] = sig[src]
    return out


def main() -> int:
    failed = 0
    compiled = []

    for type_dir in SIGNATURE_DIRS:
        for path in sorted((REPO_ROOT / type_dir).rglob("*.yaml")):
            with open(path, encoding="utf-8") as f:
                sig = yaml.safe_load(f) or {}
            problems = validate(sig, path)
            if problems:
                print(f"✗  {path.relative_to(REPO_ROOT)}", file=sys.stderr)
                for p in problems:
                    print(f"   {p}", file=sys.stderr)
                failed += 1
                continue
            compiled.append(to_detection_signature(sig))

    if failed:
        print(f"\n{failed} signature(s) failed validation — not writing {OUT_PATH}", file=sys.stderr)
        return 1

    if not compiled:
        print(f"error: no valid signatures found under {', '.join(SIGNATURE_DIRS)}", file=sys.stderr)
        return 1

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    store = {
        "version": 1,
        "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
        "signatures": compiled,
    }
    with open(OUT_PATH, "w") as f:
        json.dump(store, f, indent=2)
        f.write("\n")

    print(f"✓  wrote {len(compiled)} signature(s) → {OUT_PATH.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

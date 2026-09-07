# ChainWarden Signatures

> Community detection signatures for supply chain attacks.
> Contributed by the community — protecting everyone.

> **Vendored in-tree.** This corpus lives inside the ChainWarden repository (no git submodule),
> so a plain `git clone` gives you a fully offline-capable scanner. Edit signatures here and the
> [`Validate signatures`](../.github/workflows/signatures.yml) workflow recompiles
> `dist/signatures.json` on merge. `cwctl update` pulls that compiled bundle.

[![Signatures](https://img.shields.io/badge/signatures-24-orange?style=flat-square)](signatures/)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)](CONTRIBUTING.md)

---

## Quickstart — contribute in 10 minutes

```bash
# 1. Create a signature with the interactive wizard
cwctl intel new

# 2. Validate schema + regex
cwctl intel validate ./CW-npm-my-sig.yaml

# 3. Test against a real package
cwctl intel test ./CW-npm-my-sig.yaml \
  --ecosystem=npm --package=evil-pkg --version=1.0.0

# 4. Fork this repo, place file in right folder, open PR
#    PR title: [sig] CW-npm-my-sig — Short description
```

CI auto-validates. Maintainer reviews logic. Merges within 48–72h.

---

## Pull latest signatures

```bash
cwctl intel update
cwctl intel list
```

---

## Repository layout

```
signatures/
├── blocklisted/        Confirmed malicious package versions
│   ├── npm/
│   ├── pypi/
│   ├── go/
│   ├── crates/
│   └── maven/
├── typosquatting/      Popular packages to protect from name-squatting
│   ├── npm/
│   └── pypi/
├── behavioral/         Dangerous install script patterns
│   ├── npm/
│   └── pypi/
├── malware/            Byte/regex patterns in malicious code
├── mcp/                MCP server prompt injection patterns
├── ai-model/           Unsafe AI model configurations
├── scripts/
│   └── build_bundle.py YAML → dist/signatures.json
└── dist/
    └── signatures.json Built bundle — pulled by cwctl intel update
```

---

## Signature types

| Type | Required field | What it catches |
|---|---|---|
| `blocklisted_package` | `package:` | Confirmed malicious versions |
| `typosquatting_target` | `target:` | Popular packages + variant names |
| `behavioral_rule` | `rule:` | Dangerous install script patterns |
| `malware_pattern` | `pattern:` | Regex matching malicious code |
| `mcp_injection_pattern` | `pattern:` | Prompt injection in MCP tools |
| `pickle_rule` | `rule:` | Unsafe AI model configs |

---

## PR title format

```
[sig] CW-<id> — <short description>
```

Example: `[sig] CW-npm-event-stream-backdoor — Backdoor in event-stream@3.3.6`

---

## What we accept

- Malicious packages with evidence (links, CVEs, writeups)
- Typosquatting patterns for packages with significant download counts
- Behavioral patterns based on observed attack techniques
- MCP injection patterns based on real research
- AI model safety rules based on documented vulnerabilities

## What we don't accept

- Exploit code of any kind
- Signatures based on politics with no technical evidence
- Patterns so broad they cause significant false positives
- Signatures without description or references

---

Full authoring guide: [SIGNATURES.md in the main chainwarden repo](https://github.com/deepak-ff/supply_chain/blob/main/SIGNATURES.md)

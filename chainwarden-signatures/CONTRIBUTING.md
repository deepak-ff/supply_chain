# Contributing a Detection Signature

Thanks for helping protect the community. This repo takes signature contributions from anyone — no Go knowledge required.

## The flow

1. **Author it.** Easiest path: `cwctl intel new` (interactive wizard, from the main [chainwarden](https://github.com/deepak-ff/supply_chain) CLI). Or hand-write a YAML file — see [Signature format](#signature-format) below.
2. **Validate it.** `cwctl intel validate ./CW-npm-my-sig.yaml` — checks required fields, ID prefix, valid type/ecosystem, and (for `malware_pattern`) that the pattern is valid regex.
3. **Test it against a real package.** `cwctl intel test ./CW-npm-my-sig.yaml --ecosystem=npm --package=some-pkg --version=1.0.0`
4. **Place the file** in the right subdirectory (see [Repository layout](README.md#repository-layout) in the README — matches the signature's `type:`).
5. **Rebuild the bundle locally** so your PR's diff includes the compiled output: `pip install pyyaml && python3 scripts/build_bundle.py`
6. **Open a PR.** Title format: `[sig] CW-<id> — <short description>`

CI re-runs the same validation + build on every PR (`.github/workflows/validate.yml`) — if it's red, `python3 scripts/build_bundle.py` will print exactly which file and field failed.

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

## Signature format

Every signature is a YAML file with these fields:

```yaml
id: CW-<ecosystem>-<short-slug>       # must start with "CW-"
name: Human-readable title
type: blocklisted_package             # one of the 6 types below
ecosystem: npm                        # npm | pypi | go | rubygems | crates | maven | huggingface | mcp | "*"
severity: CRITICAL                    # CRITICAL | HIGH | MEDIUM | LOW

# exactly one of these, depending on `type` — see table below
package: exact-package-name
target: popular-package-being-squatted
pattern: 'regex-pattern-here'
rule: |
  freeform rule text for behavioral_rule / pickle_rule

description: |
  What this catches and why it matters. Include enough detail that a
  reviewer can verify the claim without prior knowledge of the incident.

references:
  - https://link-to-advisory-or-writeup

author: your-github-username
tags: [optional, freeform, tags]
```

| Type | Required field | What it catches |
|---|---|---|
| `blocklisted_package` | `package:` | Confirmed malicious versions (exact name match) |
| `typosquatting_target` | `target:` | Popular packages worth protecting from name-squatting |
| `behavioral_rule` | `rule:` | Dangerous install script patterns |
| `malware_pattern` | `pattern:` | Regex matching malicious code (must be valid regex) |
| `mcp_injection_pattern` | `pattern:` | Prompt injection in MCP tool descriptions |
| `pickle_rule` | `rule:` | Unsafe AI model configs / pickle-without-safetensors |

Full authoring guide with more detail and edge cases: [SIGNATURES.md in the main chainwarden repo](https://github.com/deepak-ff/supply_chain/blob/main/SIGNATURES.md).

## Review process

A maintainer reviews the logic (not a rubber stamp — false-positive-prone patterns get pushed back on). Typical turnaround: 48–72h. Once merged to `main`, CI rebuilds and commits `dist/signatures.json` automatically — anyone running `cwctl update` picks it up on the next run.

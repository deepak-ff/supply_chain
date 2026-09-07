# ChainWarden — Executive Summary

## The Problem

Modern software depends on thousands of open-source packages. A single compromised dependency — like the XZ Utils backdoor (2024), event-stream (2018), or polyfill.io (2024) — can give attackers access to every system that uses it. Most organizations discover these threats days or weeks after exposure.

Existing tools address parts of the problem: one scans for known CVEs, another checks for malware patterns, a third handles compliance. Teams end up stitching together multiple scanners, each with its own output format, alert stream, and blind spots.

## What ChainWarden Does

ChainWarden is a single tool that scans every dependency in a software project — across nine package ecosystems — using eight detection engines simultaneously:

- **Known vulnerabilities** (CVE databases)
- **Behavioral analysis** (malicious install scripts, environment harvesting)
- **Malware pattern matching** (obfuscated code, credential theft)
- **AI model safety** (unsafe machine learning weights)
- **MCP server auditing** (prompt injection in AI tool descriptions)
- **Deep CVE scanning** (Grype, optional)
- **Container scanning** (Trivy, optional)
- **Static analysis** (Semgrep, optional)

One scan. All engines. Results in seconds.

**Plus a second line of defence no signature can give you.** The Dynamic Trust Score keeps a
behavioural baseline for every package you depend on — install hooks, outbound calls, obfuscation,
maintainer churn, artifact size — and flags the release that stops behaving like its own history.
That is the window in which registry-hijack campaigns operate, before any signature exists.

```
cwctl trust from-scan scan.json --package npm:express --fail-on red
```

## How It Works

```
Install:  curl -sSfL https://raw.githubusercontent.com/deepak-ff/supply_chain/main/install.sh | bash
Scan:     cwctl scan .
```

No account required. No configuration needed. Works offline. The CLI scans locally — no source code leaves the developer's machine.

For teams, ChainWarden includes a web dashboard (28 pages), a REST API (42 endpoints), policy-as-code enforcement, Slack/Discord alerts, SBOM generation, and Sigstore artifact signing. The entire platform — API, dashboard, database — starts with a single `docker compose up -d`.

## Key Differentiators

| | ChainWarden | Typical Scanner |
|---|---|---|
| Engines | 8 concurrent | 1 |
| Ecosystems | 9 (npm, PyPI, Go, Maven, Ruby, Rust, HuggingFace, MCP, Docker) | 1-3 |
| AI triage | Built-in (AI-powered advisories + auto-patch) | Manual |
| Detection signatures | Community-contributed, Nuclei-style | Vendor-only |
| Deployment | Local-first, self-hostable, airgap-compatible | Cloud-dependent |
| Cost | Open-core (CLI free forever, Apache 2.0) | Per-seat SaaS |

## Business Model

**Open-core**: the scanning engine, CLI, community signatures, and self-hosted dashboard are free and open-source (Apache 2.0). Revenue comes from:

- **Pro licenses** — AI-powered CLI features (advisory, auto-patch, monitoring)
- **Cloud hosting** — managed ChainWarden with team management and SLA
- **Enterprise** — SSO/RBAC, priority support, custom integrations

## Traction

- 8 concurrent scan engines, 24 community detection signatures
- 9 ecosystem support (including emerging AI/ML supply chain: HuggingFace, MCP)
- Full dashboard with 28 functional pages
- CI/CD integration (GitHub Actions, GitLab CI)
- SLSA Level 3 provenance and Sigstore signing

## Links

- **Repository**: [github.com/deepak-ff/supply_chain](https://github.com/deepak-ff/supply_chain)
- **GitHub**: [github.com/deepak-ff/supply_chain](https://github.com/deepak-ff/supply_chain)
- **Contact**: security@chainwarden.dev

# Dynamic Trust Score (DTS)

> Package: [`internal/trust`](../internal/trust) · CLI: `cwctl trust` · API: `/api/v1/trust`
> · Dashboard: **Monitor → Trust Score**

## Why it exists

Every engine in ChainWarden except this one is *retrospective*: OSV knows about CVEs that have been
published, the behavioural and malware engines match signatures somebody has already written, Grype
and Trivy match vulnerability databases. All of them answer:

> Has anyone seen **this artifact** do something bad?

That leaves a window. In the npm hijack campaigns of 2021–2025 the median time between a malicious
version being published and a signature existing for it was measured in **hours to days** — and the
damage is done at `npm install` time, inside that window.

The trust engine asks a different question, one that needs no prior knowledge of the attack:

> Is this release still behaving like **itself**?

A package is not evaluated against the world; it is evaluated against its own past.

## The model

### 1. Observations

An `Observation` is a dated behavioural fingerprint of one release:

| Metric | Weight | Directional | Signal |
|---|--:|:--:|---|
| `network_calls` | 18 | yes | Outbound network primitives in package code |
| `install_hooks` | 16 | yes | `preinstall` / `postinstall` / `prepare` lifecycle scripts |
| `obfuscation_score` | 14 | yes | Density of encoded / minified / eval'd payloads (0–100) |
| `process_spawns` | 12 | yes | `exec` / `spawn` / `system` calls |
| `filesystem_writes` | 10 | yes | Writes outside the package root |
| `new_maintainers` | 9 | yes | Publishers first seen on this release |
| `critical_findings` | 8 | yes | Critical findings from the last scan |
| `high_findings` | 5 | yes | High findings from the last scan |
| `artifact_kb` | 4 | no | Published artifact size |
| `dependency_count` | 2 | no | Direct runtime dependencies |
| `release_gap_days` | 2 | no | Days since the previous release |

Weights sum to 100 — the maximum a single metric can subtract from the trust score.

**Directional** metrics are only penalised when they move in the risk-increasing direction. Removing
a `postinstall` hook is an improvement, and improvements never cost trust. Non-directional metrics
(size, dependency count, cadence) are suspicious in either direction: an artifact that suddenly
*shrinks*, or a release published minutes after the previous one, are both classic hijack tells.

### 2. Baseline

`BuildBaseline` computes mean, population standard deviation, min and max per metric over the
observations that **precede** the release being scored. A compromised release can therefore never
poison the baseline it is measured against.

Below `MinObservations` (3) the package is reported as `LEARNING` and is never penalised — the
engine refuses to make claims it cannot support statistically.

### 3. Evaluation

For each metric:

```
z = (observed − mean) / stddev
```

Deviations with `|z| < 2` are ignored as noise. Above that, severity and the fraction of the
metric's weight budget that is deducted are:

| `|z|` | Severity | Deduction |
|---|---|---|
| ≥ 6 | CRITICAL | 100 % of weight |
| ≥ 4 | HIGH | 75 % |
| ≥ 3 | MEDIUM | 50 % |
| ≥ 2 | LOW | 25 % |

**Zero-variance metrics.** If a metric has been perfectly constant (`stddev == 0`), dividing by it
is undefined — but the *event itself* is meaningful: a package that has had zero install hooks for
forty releases and now has two has done something unprecedented. In that case the delta is scaled
against the mean and floored at `z = 3`, so first-ever behaviour always registers at least MEDIUM.
A per-metric `Floor` suppresses trivial absolute movement (e.g. ±32 KiB of artifact size).

```
score = clamp(100 − Σ deductions, 0, 100)
```

| Score | State |
|---|---|
| 80–100 | `GREEN` |
| 50–79 | `AMBER` |
| 0–49 | `RED` |
| any, < 3 samples | `LEARNING` |

## Storage

Ledgers are plain JSON, one file per package:

```
~/.chainwarden/trust/<ecosystem>/<slugified-package>.json
```

Override with `--dir` or `$CW_TRUST_DIR`. Package names are slugified, so scoped npm names
(`@scope/pkg`) and Go module paths cannot escape the store directory. Writes are atomic
(`write` + `rename`) and files are created `0600`.

This is deliberately **not** a database table: `cwctl trust` on a laptop and the dashboard served by
`cwctl serve` read exactly the same file, with no Postgres dependency, and the ledger is trivially
committable to a repo if a team wants trust history under version control.

Re-recording the same version replaces the previous entry, so a CI job that runs on every push does
not inflate the sample count.

## Usage

### CLI

```bash
# Derive an observation from a scan (recommended)
cwctl scan . --format json > scan.json
cwctl trust from-scan scan.json --package npm:express

# Record one by hand / from your own tooling
cwctl trust record npm:left-pad --version 1.3.0 \
  --network 1 --hooks 0 --deps 0 --size-kb 12 --maintainers 1

# Inspect
cwctl trust list                      # worst trust first
cwctl trust list --state red --json
cwctl trust show npm:express

# CI gate — fails the build on behavioural drift, independent of CVEs
cwctl trust from-scan scan.json --package npm:express --fail-on red

# Demonstrate the engine with no data
cwctl trust simulate --scenario hijack
cwctl trust simulate --scenario takeover --save
```

### API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/trust` | Summary for every tracked package + state histogram |
| `GET` | `/api/v1/trust/:ecosystem/:name` | Baseline, score and full observation history |
| `POST` | `/api/v1/trust/observe` | Append an observation (CI, external tooling) |
| `POST` | `/api/v1/trust/simulate` | Score a synthetic scenario, no persistence |

```bash
curl -s localhost:8080/api/v1/trust | jq '.packages[] | select(.state == "RED")'
```

## Simulation scenarios

Because a real baseline takes months to accumulate, the engine ships with reproducible scenarios —
used both for demos and as regression tests in `trust_test.go`:

| Scenario | Pattern | Expected |
|---|---|---|
| `hijack` | Stolen publish token: install hook + outbound calls + obfuscated blob, published minutes after the last release | `RED` |
| `sleeper` | Payload assembled gradually over several releases | deviations surfaced despite the slow ramp |
| `takeover` | New maintainer appears, then an out-of-cadence publish | not `GREEN` |
| `clean` | Ordinary release, slightly larger, one new dependency | `GREEN` |

## Lineage

The Dynamic Trust Score is a direct descendant of **SCBTSS**, the Flask prototype preserved in
[`legacy/scbtss-prototype/`](../legacy/scbtss-prototype/). That prototype monitored running vendor
software and scored network/process behaviour against learned baselines. ChainWarden keeps the idea
— statistical baselines, weighted deductions, a traffic-light trust state — and moves it upstream,
from *running processes* to *published packages*, where supply chain compromise actually enters.

## Limitations

- Trust is only as good as the observations fed to it. `from-scan` derives counters heuristically
  from finding text; richer counters (real AST-level network/exec extraction) improve precision.
- The baseline is per-package, so a package's *first* release can never be scored. Pair the trust
  engine with signature scanning — they cover each other's blind spots by design.
- Metrics are unweighted across time (no decay). A package that legitimately changed shape a year
  ago carries that variance in its baseline, which makes it slightly harder to alarm on. An EWMA
  variant is the obvious next iteration.

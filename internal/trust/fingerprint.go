package trust

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
)

// FingerprintVersion prefixes the hashed payload AND the returned identifier.
// Bumping it (e.g. when the metric model gains or reorders a field) makes
// every existing fingerprint invalid instead of silently colliding with the
// new scheme, so stale behavioural locks are surfaced as drift rather than
// as false matches.
const FingerprintVersion = "cw1"

// Fingerprint returns a stable behavioural fingerprint for the metrics:
//
//	"cw1:" + first 32 hex chars of sha256("cw1|<field>=<%.4f>|" ... )
//
// for every metric in the model's fixed order. Two releases with identical
// behaviour always produce the same fingerprint, and any behavioural change
// — even one too small to move the trust score — changes it. That is the
// property the behavioural lockfile (chainwarden.lock) relies on.
func (m Metrics) Fingerprint() string {
	h := sha256.New()
	for i, met := range model {
		if i == 0 {
			fmt.Fprintf(h, "%s|%s=%.4f", FingerprintVersion, met.Field, met.Get(m))
			continue
		}
		fmt.Fprintf(h, "|%s=%.4f", met.Field, met.Get(m))
	}
	return FingerprintVersion + ":" + hex.EncodeToString(h.Sum(nil))[:32]
}

// Fingerprint delegates to Metrics.Fingerprint so callers can fingerprint an
// Observation directly without unwrapping its metrics.
func (o Observation) Fingerprint() string {
	return o.Metrics.Fingerprint()
}

// MetricDelta is one metric that changed between two releases.
type MetricDelta struct {
	Metric  string  `json:"metric"`
	Label   string  `json:"label"`
	From    float64 `json:"from"`
	To      float64 `json:"to"`
	Delta   float64 `json:"delta"`
	Riskier bool    `json:"riskier"`
	// Weighted is the metric's share of the 100-point trust budget (18 for
	// outbound network calls, 4 for artifact size, …). Consumers can order
	// changed metrics by how much trust the metric is able to move.
	Weighted float64 `json:"weighted"`
}

// Diff compares two metric sets in the model's fixed order and returns one
// MetricDelta per metric that changed. Equal metrics are skipped entirely.
//
// Riskier reports whether the change moves the metric towards risk:
//   - for directional metrics (network calls, install hooks, …) only an
//     increase is risk-increasing, so Riskier == delta > 0;
//   - for non-directional metrics (size, dependency count, cadence) movement
//     in EITHER direction is a classic hijack tell, so Riskier is always true
//     for any change.
func Diff(from, to Metrics) []MetricDelta {
	var out []MetricDelta
	for _, m := range model {
		fromV := m.Get(from)
		toV := m.Get(to)
		if fromV == toV {
			continue
		}
		delta := toV - fromV
		riskier := !m.Directional || delta > 0
		out = append(out, MetricDelta{
			Metric:   m.Field,
			Label:    m.Label,
			From:     round2(fromV),
			To:       round2(toV),
			Delta:    round2(delta),
			Riskier:  riskier,
			Weighted: m.Weight,
		})
	}
	return out
}

// DiffObservations diffs the metrics of two observations. `a` is the older /
// "from" observation and `b` the newer / "to" observation; the resulting
// deltas are in the same order and carry the same semantics as Diff.
func DiffObservations(a, b Observation) []MetricDelta {
	return Diff(a.Metrics, b.Metrics)
}

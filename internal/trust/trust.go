// Package trust implements ChainWarden's Dynamic Trust Score (DTS) — a
// longitudinal, per-package trust model.
//
// Every other engine in ChainWarden answers "is THIS release bad?" by matching
// a release against signatures and CVE data. The trust engine answers a
// different question: "is this release behaving like ITSELF?".
//
// It keeps a per-package ledger of behavioural observations (install hooks,
// outbound network primitives, filesystem writes outside the package root,
// process spawns, obfuscation density, maintainer churn, artifact size,
// dependency count and the finding mix from previous scans). From the ledger
// it derives a statistical baseline (mean + population standard deviation per
// metric) and scores each new release by how far it deviates from that
// baseline, in the risk-increasing direction only.
//
// The result is a 0–100 trust score plus a state (LEARNING / GREEN / AMBER /
// RED). A package with a long, boring history that suddenly gains a
// postinstall hook and three outbound HTTP calls collapses from 100 to RED
// even when no signature matches it — which is exactly the window in which
// real registry-hijack campaigns operate.
package trust

import (
	"fmt"
	"math"
	"sort"
	"strings"
	"time"
)

// MinObservations is the number of historical observations required before a
// baseline is considered statistically meaningful. Below this the package is
// reported as LEARNING and is never penalised.
const MinObservations = 3

// Trust states.
const (
	StateLearning = "LEARNING"
	StateGreen    = "GREEN"
	StateAmber    = "AMBER"
	StateRed      = "RED"
)

// State thresholds, applied to the 0–100 score.
const (
	GreenThreshold = 80
	AmberThreshold = 50
)

// Metrics is a behavioural fingerprint of a single package release.
//
// All fields are deliberately plain counters so they can be produced by the
// local scanner, by `cwctl trust record` in a CI job, or by an external tool
// posting to /api/v1/trust/observe.
type Metrics struct {
	InstallHooks     int     `json:"install_hooks"`     // preinstall/postinstall/prepare style lifecycle scripts
	NetworkCalls     int     `json:"network_calls"`     // outbound network primitives found in package code
	FilesystemWrites int     `json:"filesystem_writes"` // writes outside the package directory
	ProcessSpawns    int     `json:"process_spawns"`    // exec/spawn/system calls
	ObfuscationScore int     `json:"obfuscation_score"` // 0–100 density of encoded/minified payloads
	MaintainerCount  int     `json:"maintainer_count"`  // publishers with release rights
	NewMaintainers   int     `json:"new_maintainers"`   // publishers first seen on this release
	ArtifactKB       int     `json:"artifact_kb"`       // published tarball size in KiB
	DependencyCount  int     `json:"dependency_count"`  // direct runtime dependencies
	CriticalFindings int     `json:"critical_findings"` // from the last scan of this release
	HighFindings     int     `json:"high_findings"`     //
	ReleaseGapDays   float64 `json:"release_gap_days"`  // days since the previous release
}

// Observation is one dated behavioural sample for a package release.
type Observation struct {
	Ecosystem  string    `json:"ecosystem"`
	Package    string    `json:"package"`
	Version    string    `json:"version"`
	ObservedAt time.Time `json:"observed_at"`
	Source     string    `json:"source"` // "scan", "ci", "manual", "simulate"
	Metrics    Metrics   `json:"metrics"`
}

// Key returns the canonical "<ecosystem>:<package>" identifier.
func (o Observation) Key() string {
	return Key(o.Ecosystem, o.Package)
}

// Key builds the canonical ledger key for a package.
func Key(ecosystem, name string) string {
	return strings.ToLower(strings.TrimSpace(ecosystem)) + ":" + strings.TrimSpace(name)
}

// metric describes one dimension of the behavioural model: how to read it,
// how much of the score it can consume, and whether a drop is suspicious.
type metric struct {
	Field string
	Label string
	// Weight is the share of the 100-point budget this metric can deduct.
	Weight float64
	// Directional metrics are only penalised when the value INCREASES past
	// the baseline (more network calls is bad, fewer is not). Non-directional
	// metrics are penalised for movement in either direction.
	Directional bool
	// Floor is the minimum absolute change required before a deviation is
	// reported at all. It suppresses noise on metrics whose baseline standard
	// deviation is close to zero.
	Floor float64
	Get   func(Metrics) float64
}

// model is the ordered metric set. Weights sum to 100.
var model = []metric{
	{"network_calls", "Outbound network calls", 18, true, 1, func(m Metrics) float64 { return float64(m.NetworkCalls) }},
	{"install_hooks", "Install lifecycle hooks", 16, true, 1, func(m Metrics) float64 { return float64(m.InstallHooks) }},
	{"obfuscation_score", "Obfuscation density", 14, true, 5, func(m Metrics) float64 { return float64(m.ObfuscationScore) }},
	{"process_spawns", "Process spawns", 12, true, 1, func(m Metrics) float64 { return float64(m.ProcessSpawns) }},
	{"filesystem_writes", "Writes outside package root", 10, true, 1, func(m Metrics) float64 { return float64(m.FilesystemWrites) }},
	{"new_maintainers", "Newly added maintainers", 9, true, 1, func(m Metrics) float64 { return float64(m.NewMaintainers) }},
	{"critical_findings", "Critical findings", 8, true, 1, func(m Metrics) float64 { return float64(m.CriticalFindings) }},
	{"high_findings", "High findings", 5, true, 1, func(m Metrics) float64 { return float64(m.HighFindings) }},
	{"artifact_kb", "Artifact size (KiB)", 4, false, 32, func(m Metrics) float64 { return float64(m.ArtifactKB) }},
	{"dependency_count", "Direct dependencies", 2, false, 1, func(m Metrics) float64 { return float64(m.DependencyCount) }},
	{"release_gap_days", "Release cadence (days)", 2, false, 1, func(m Metrics) float64 { return m.ReleaseGapDays }},
}

// Stat is the learned baseline for a single metric.
type Stat struct {
	Metric string  `json:"metric"`
	Label  string  `json:"label"`
	Mean   float64 `json:"mean"`
	StdDev float64 `json:"stddev"`
	Min    float64 `json:"min"`
	Max    float64 `json:"max"`
}

// Baseline is the statistical profile learned from a package's history.
type Baseline struct {
	Ecosystem    string    `json:"ecosystem"`
	Package      string    `json:"package"`
	Samples      int       `json:"samples"`
	FirstSeen    time.Time `json:"first_seen"`
	LastSeen     time.Time `json:"last_seen"`
	Stats        []Stat    `json:"stats"`
	statsByField map[string]Stat
}

// Ready reports whether the baseline has enough samples to score against.
func (b Baseline) Ready() bool { return b.Samples >= MinObservations }

// Stat returns the learned statistics for a metric field.
func (b Baseline) Stat(field string) (Stat, bool) {
	s, ok := b.statsByField[field]
	return s, ok
}

// Deviation is a single metric that moved away from the baseline.
type Deviation struct {
	Metric    string  `json:"metric"`
	Label     string  `json:"label"`
	Baseline  float64 `json:"baseline"`
	Observed  float64 `json:"observed"`
	Delta     float64 `json:"delta"`
	ZScore    float64 `json:"z_score"`
	Severity  string  `json:"severity"` // LOW | MEDIUM | HIGH | CRITICAL
	Deduction int     `json:"deduction"`
	Reason    string  `json:"reason"`
}

// Score is the outcome of evaluating an observation against a baseline.
type Score struct {
	Ecosystem   string      `json:"ecosystem"`
	Package     string      `json:"package"`
	Version     string      `json:"version"`
	Score       int         `json:"score"` // 0–100, higher is more trustworthy
	State       string      `json:"state"`
	Samples     int         `json:"samples"`
	EvaluatedAt time.Time   `json:"evaluated_at"`
	Deviations  []Deviation `json:"deviations"`
	Summary     string      `json:"summary"`
}

// BuildBaseline derives a baseline from historical observations. Callers pass
// the observations that PRECEDE the release being scored; BuildBaseline never
// looks at the release itself, so a compromised version cannot poison the
// baseline it is measured against.
func BuildBaseline(history []Observation) Baseline {
	b := Baseline{statsByField: map[string]Stat{}}
	if len(history) == 0 {
		return b
	}

	sorted := make([]Observation, len(history))
	copy(sorted, history)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i].ObservedAt.Before(sorted[j].ObservedAt) })

	b.Ecosystem = sorted[0].Ecosystem
	b.Package = sorted[0].Package
	b.Samples = len(sorted)
	b.FirstSeen = sorted[0].ObservedAt
	b.LastSeen = sorted[len(sorted)-1].ObservedAt

	for _, m := range model {
		values := make([]float64, 0, len(sorted))
		for _, obs := range sorted {
			values = append(values, m.Get(obs.Metrics))
		}
		st := Stat{
			Metric: m.Field,
			Label:  m.Label,
			Mean:   mean(values),
			StdDev: stddev(values),
			Min:    minOf(values),
			Max:    maxOf(values),
		}
		b.Stats = append(b.Stats, st)
		b.statsByField[m.Field] = st
	}
	return b
}

// Evaluate scores an observation against a baseline.
func Evaluate(b Baseline, obs Observation) Score {
	s := Score{
		Ecosystem:   firstNonEmpty(obs.Ecosystem, b.Ecosystem),
		Package:     firstNonEmpty(obs.Package, b.Package),
		Version:     obs.Version,
		Samples:     b.Samples,
		EvaluatedAt: time.Now().UTC(),
		Deviations:  []Deviation{},
	}

	if !b.Ready() {
		s.Score = 100
		s.State = StateLearning
		s.Summary = fmt.Sprintf("learning — %d/%d observations recorded", b.Samples, MinObservations)
		return s
	}

	total := 0.0
	for _, m := range model {
		st, ok := b.statsByField[m.Field]
		if !ok {
			continue
		}
		observed := m.Get(obs.Metrics)
		delta := observed - st.Mean
		if m.Directional && delta <= 0 {
			continue // movement towards safety is never penalised
		}
		if math.Abs(delta) < m.Floor {
			continue
		}

		z := zScore(observed, st)
		if math.Abs(z) < 2 {
			continue
		}

		severity, factor := severityFor(math.Abs(z))
		deduction := int(math.Round(m.Weight * factor))
		if deduction <= 0 {
			continue
		}
		total += float64(deduction)

		s.Deviations = append(s.Deviations, Deviation{
			Metric:    m.Field,
			Label:     m.Label,
			Baseline:  round2(st.Mean),
			Observed:  round2(observed),
			Delta:     round2(delta),
			ZScore:    round2(z),
			Severity:  severity,
			Deduction: deduction,
			Reason:    reasonFor(m, st, observed, delta),
		})
	}

	sort.SliceStable(s.Deviations, func(i, j int) bool {
		return s.Deviations[i].Deduction > s.Deviations[j].Deduction
	})

	s.Score = clamp(100-int(math.Round(total)), 0, 100)
	s.State = StateFor(s.Score)
	s.Summary = summarize(s)
	return s
}

// StateFor maps a numeric score onto a trust state.
func StateFor(score int) string {
	switch {
	case score >= GreenThreshold:
		return StateGreen
	case score >= AmberThreshold:
		return StateAmber
	default:
		return StateRed
	}
}

// severityFor converts an absolute z-score into a severity label and the
// fraction of the metric's weight budget that is deducted.
func severityFor(z float64) (string, float64) {
	switch {
	case z >= 6:
		return "CRITICAL", 1.0
	case z >= 4:
		return "HIGH", 0.75
	case z >= 3:
		return "MEDIUM", 0.5
	default:
		return "LOW", 0.25
	}
}

// zScore measures deviation in standard deviations. When a metric has been
// perfectly stable (stddev 0) any movement is by definition unprecedented, so
// the delta is scaled against the mean instead of dividing by zero.
func zScore(observed float64, st Stat) float64 {
	delta := observed - st.Mean
	if st.StdDev > 0.0001 {
		return delta / st.StdDev
	}
	if math.Abs(delta) < 0.0001 {
		return 0
	}
	base := math.Max(math.Abs(st.Mean), 1)
	// A previously constant metric that moves gets at least MEDIUM weight and
	// scales with the relative size of the jump.
	return math.Copysign(3+math.Min(math.Abs(delta)/base, 5), delta)
}

func reasonFor(m metric, st Stat, observed, delta float64) string {
	direction := "rose"
	if delta < 0 {
		direction = "fell"
	}
	if st.StdDev <= 0.0001 {
		return fmt.Sprintf("%s %s from a previously constant %s to %s — no precedent in the package history",
			m.Label, direction, trim(st.Mean), trim(observed))
	}
	return fmt.Sprintf("%s %s from a baseline of %s (±%s) to %s",
		m.Label, direction, trim(st.Mean), trim(st.StdDev), trim(observed))
}

func summarize(s Score) string {
	if len(s.Deviations) == 0 {
		return "no behavioural drift against the learned baseline"
	}
	labels := make([]string, 0, 3)
	for i, d := range s.Deviations {
		if i == 3 {
			break
		}
		labels = append(labels, strings.ToLower(d.Label))
	}
	more := ""
	if len(s.Deviations) > 3 {
		more = fmt.Sprintf(" (+%d more)", len(s.Deviations)-3)
	}
	return fmt.Sprintf("%d behavioural deviation(s): %s%s", len(s.Deviations), strings.Join(labels, ", "), more)
}

// ---- small numeric helpers -------------------------------------------------

func mean(v []float64) float64 {
	if len(v) == 0 {
		return 0
	}
	sum := 0.0
	for _, x := range v {
		sum += x
	}
	return sum / float64(len(v))
}

func stddev(v []float64) float64 {
	if len(v) < 2 {
		return 0
	}
	m := mean(v)
	sum := 0.0
	for _, x := range v {
		d := x - m
		sum += d * d
	}
	return math.Sqrt(sum / float64(len(v)))
}

func minOf(v []float64) float64 {
	if len(v) == 0 {
		return 0
	}
	out := v[0]
	for _, x := range v {
		if x < out {
			out = x
		}
	}
	return out
}

func maxOf(v []float64) float64 {
	if len(v) == 0 {
		return 0
	}
	out := v[0]
	for _, x := range v {
		if x > out {
			out = x
		}
	}
	return out
}

func clamp(v, lo, hi int) int {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}

func round2(f float64) float64 { return math.Round(f*100) / 100 }

func trim(f float64) string {
	return strings.TrimSuffix(strings.TrimRight(fmt.Sprintf("%.2f", f), "0"), ".")
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}

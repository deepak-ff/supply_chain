package trust

import (
	"strings"
	"testing"
)

func TestMetricsFingerprintStableAndSensitive(t *testing.T) {
	a := Metrics{NetworkCalls: 1, InstallHooks: 0, DependencyCount: 3, ArtifactKB: 200}
	b := Metrics{NetworkCalls: 1, InstallHooks: 0, DependencyCount: 3, ArtifactKB: 200}
	if a.Fingerprint() != b.Fingerprint() {
		t.Fatalf("identical metrics produced different fingerprints: %s vs %s", a.Fingerprint(), b.Fingerprint())
	}
	if got := a.Fingerprint(); !strings.HasPrefix(got, "cw1:") || len(got) != len("cw1:")+32 {
		t.Fatalf("fingerprint %q should be cw1: + 32 hex chars", got)
	}
	c := a
	c.NetworkCalls = 2
	if a.Fingerprint() == c.Fingerprint() {
		t.Fatalf("a +1 network call change must change the fingerprint")
	}
	d := a
	d.MaintainerCount = 99 // not part of the model — must NOT change the fingerprint
	if a.Fingerprint() != d.Fingerprint() {
		t.Fatalf("maintainer_count is not a model metric and must not affect the fingerprint")
	}
}

func TestObservationFingerprintDelegates(t *testing.T) {
	o := Observation{Ecosystem: "npm", Package: "p", Metrics: Metrics{InstallHooks: 1, NetworkCalls: 4}}
	if o.Fingerprint() != o.Metrics.Fingerprint() {
		t.Fatalf("Observation.Fingerprint must delegate to Metrics.Fingerprint")
	}
}

func TestDiffSkipsEqualsAndMarksRiskier(t *testing.T) {
	from := Metrics{NetworkCalls: 1, ArtifactKB: 200, DependencyCount: 3, ReleaseGapDays: 14}
	to := Metrics{NetworkCalls: 9, ArtifactKB: 150, DependencyCount: 3, ReleaseGapDays: 14}

	deltas := Diff(from, to)
	seen := map[string]MetricDelta{}
	for _, d := range deltas {
		seen[d.Metric] = d
	}
	if len(deltas) != 2 {
		t.Fatalf("expected 2 changed metrics, got %+v", deltas)
	}
	// directional metric that increased → riskier
	if d := seen["network_calls"]; !d.Riskier || d.From != 1 || d.To != 9 || d.Delta != 8 {
		t.Fatalf("network_calls delta wrong: %+v", d)
	}
	// non-directional metric that DECREASED → still riskier (either direction is a tell)
	if d := seen["artifact_kb"]; !d.Riskier || d.Delta != -50 {
		t.Fatalf("artifact_kb delta wrong: %+v", d)
	}
	// unchanged metrics skipped entirely
	if _, ok := seen["dependency_count"]; ok {
		t.Fatalf("dependency_count did not change and should be skipped")
	}
	if _, ok := seen["release_gap_days"]; ok {
		t.Fatalf("release_gap_days did not change and should be skipped")
	}
}

func TestDiffDirectionalDecreaseNotRiskier(t *testing.T) {
	from := Metrics{NetworkCalls: 9, InstallHooks: 2}
	to := Metrics{NetworkCalls: 0, InstallHooks: 0}
	for _, d := range Diff(from, to) {
		if d.Riskier {
			t.Fatalf("removing risky behaviour must not be flagged riskier: %+v", d)
		}
	}
}

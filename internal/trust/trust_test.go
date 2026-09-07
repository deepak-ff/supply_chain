package trust

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func steadyHistory(n int) []Observation {
	base := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	out := make([]Observation, 0, n)
	for i := 0; i < n; i++ {
		out = append(out, Observation{
			Ecosystem:  "npm",
			Package:    "steady-lib",
			Version:    "1." + string(rune('0'+i)) + ".0",
			ObservedAt: base.AddDate(0, 0, 14*i),
			Metrics: Metrics{
				NetworkCalls:     1,
				MaintainerCount:  2,
				ArtifactKB:       200 + i,
				DependencyCount:  3,
				ReleaseGapDays:   14,
				ObfuscationScore: 4,
			},
		})
	}
	return out
}

func TestBaselineNotReadyBelowMinObservations(t *testing.T) {
	b := BuildBaseline(steadyHistory(MinObservations - 1))
	if b.Ready() {
		t.Fatalf("baseline with %d samples should not be ready", b.Samples)
	}
	s := Evaluate(b, steadyHistory(1)[0])
	if s.State != StateLearning || s.Score != 100 {
		t.Fatalf("want LEARNING/100, got %s/%d", s.State, s.Score)
	}
}

func TestSteadyReleaseKeepsFullTrust(t *testing.T) {
	history := steadyHistory(6)
	next := history[len(history)-1]
	next.Version = "1.6.0"
	next.ObservedAt = next.ObservedAt.AddDate(0, 0, 14)

	s := Evaluate(BuildBaseline(history), next)
	if s.State != StateGreen {
		t.Fatalf("steady release should stay GREEN, got %s (%d): %+v", s.State, s.Score, s.Deviations)
	}
	if len(s.Deviations) != 0 {
		t.Fatalf("expected no deviations, got %+v", s.Deviations)
	}
}

func TestHijackedReleaseCollapsesTrust(t *testing.T) {
	history := steadyHistory(6)
	bad := history[len(history)-1]
	bad.Version = "1.6.0"
	bad.ObservedAt = bad.ObservedAt.AddDate(0, 0, 14)
	bad.Metrics.InstallHooks = 2
	bad.Metrics.NetworkCalls = 9
	bad.Metrics.ProcessSpawns = 3
	bad.Metrics.ObfuscationScore = 80

	s := Evaluate(BuildBaseline(history), bad)
	if s.State != StateRed {
		t.Fatalf("hijacked release should be RED, got %s (%d)", s.State, s.Score)
	}
	if len(s.Deviations) < 3 {
		t.Fatalf("expected at least 3 deviations, got %d: %+v", len(s.Deviations), s.Deviations)
	}
	seen := map[string]bool{}
	for _, d := range s.Deviations {
		seen[d.Metric] = true
	}
	for _, want := range []string{"install_hooks", "network_calls", "process_spawns"} {
		if !seen[want] {
			t.Errorf("expected a deviation for %s", want)
		}
	}
}

func TestImprovementIsNeverPenalised(t *testing.T) {
	history := steadyHistory(6)
	for i := range history {
		history[i].Metrics.NetworkCalls = 6
		history[i].Metrics.InstallHooks = 2
	}
	better := history[len(history)-1]
	better.Version = "2.0.0"
	better.Metrics.NetworkCalls = 0
	better.Metrics.InstallHooks = 0

	s := Evaluate(BuildBaseline(history), better)
	if s.Score != 100 {
		t.Fatalf("removing risky behaviour must not reduce trust, got %d: %+v", s.Score, s.Deviations)
	}
}

func TestStoreRecordAssessAndList(t *testing.T) {
	dir := t.TempDir()
	store, err := NewStore(dir)
	if err != nil {
		t.Fatalf("NewStore: %v", err)
	}

	for _, obs := range steadyHistory(5) {
		if _, err := store.Record(obs); err != nil {
			t.Fatalf("Record: %v", err)
		}
	}

	bad := steadyHistory(1)[0]
	bad.Version = "9.9.9"
	bad.ObservedAt = time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	bad.Metrics.NetworkCalls = 12
	bad.Metrics.InstallHooks = 3
	bad.Metrics.ObfuscationScore = 90

	score, err := store.Record(bad)
	if err != nil {
		t.Fatalf("Record compromised: %v", err)
	}
	if score.State == StateGreen {
		t.Fatalf("compromised release should not be GREEN: %+v", score)
	}

	if _, err := os.Stat(filepath.Join(dir, "npm", "steady-lib.json")); err != nil {
		t.Fatalf("ledger file not written: %v", err)
	}

	_, assessed, err := store.Assess("npm", "steady-lib")
	if err != nil {
		t.Fatalf("Assess: %v", err)
	}
	if assessed.Score != score.Score {
		t.Fatalf("Assess disagrees with Record: %d vs %d", assessed.Score, score.Score)
	}

	list, err := store.List()
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(list) != 1 || list[0].Package != "steady-lib" {
		t.Fatalf("unexpected listing: %+v", list)
	}
	if list[0].Samples != 6 {
		t.Fatalf("expected 6 samples, got %d", list[0].Samples)
	}
}

func TestRecordReplacesSameVersion(t *testing.T) {
	store, err := NewStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	obs := steadyHistory(1)[0]
	for i := 0; i < 4; i++ {
		if _, err := store.Record(obs); err != nil {
			t.Fatal(err)
		}
	}
	l, err := store.Load("npm", "steady-lib")
	if err != nil {
		t.Fatal(err)
	}
	if len(l.Observations) != 1 {
		t.Fatalf("re-recording one version must not inflate history, got %d entries", len(l.Observations))
	}
}

func TestSlugKeepsScopedNamesInsideStore(t *testing.T) {
	store, err := NewStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	p := store.path("npm", "../../@scope/evil")
	if !filepath.IsLocal(mustRel(t, store.Root(), p)) {
		t.Fatalf("ledger path escaped the store root: %s", p)
	}
}

func mustRel(t *testing.T, base, target string) string {
	t.Helper()
	rel, err := filepath.Rel(base, target)
	if err != nil {
		t.Fatalf("Rel: %v", err)
	}
	return rel
}

func TestSimulateScenarios(t *testing.T) {
	cases := map[SimulationScenario]func(Score) error{
		ScenarioHijack: func(s Score) error {
			if s.State != StateRed {
				return fmt.Errorf("hijack should be RED, got %s (%d)", s.State, s.Score)
			}
			return nil
		},
		ScenarioTakeover: func(s Score) error {
			if s.State == StateGreen {
				return fmt.Errorf("takeover should not be GREEN, got %d", s.Score)
			}
			return nil
		},
		ScenarioCleanBuild: func(s Score) error {
			if s.State != StateGreen {
				return fmt.Errorf("clean build should be GREEN, got %s (%d): %+v", s.State, s.Score, s.Deviations)
			}
			return nil
		},
		ScenarioSleeper: func(s Score) error {
			if len(s.Deviations) == 0 {
				return fmt.Errorf("sleeper should surface at least one deviation")
			}
			return nil
		},
	}

	for scenario, check := range cases {
		sim, err := Simulate("npm", "demo-lib", scenario, 8)
		if err != nil {
			t.Fatalf("Simulate(%s): %v", scenario, err)
		}
		if err := check(sim.Score); err != nil {
			t.Errorf("%s: %v", scenario, err)
		}
	}

	if _, err := Simulate("npm", "demo", SimulationScenario("nope"), 8); err == nil {
		t.Error("unknown scenario should error")
	}
}

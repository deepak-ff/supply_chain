package trust

import (
	"fmt"
	"math"
	"time"
)

// SimulationScenario names a synthetic compromise pattern.
type SimulationScenario string

// Supported simulation scenarios. These mirror the attack classes ChainWarden
// sees most often in the wild: a hijacked publish that adds an install hook
// and phones home, a slow "sleeper" that drifts over several releases, and a
// maintainer-takeover where publishing rights change hands before the payload
// lands.
const (
	ScenarioHijack     SimulationScenario = "hijack"
	ScenarioSleeper    SimulationScenario = "sleeper"
	ScenarioTakeover   SimulationScenario = "takeover"
	ScenarioCleanBuild SimulationScenario = "clean"
)

// Scenarios lists every supported simulation scenario.
func Scenarios() []SimulationScenario {
	return []SimulationScenario{ScenarioHijack, ScenarioSleeper, ScenarioTakeover, ScenarioCleanBuild}
}

// Simulation is the result of running a scenario: the synthetic history that
// was learned from, plus the scored final release.
type Simulation struct {
	Scenario SimulationScenario `json:"scenario"`
	History  []Observation      `json:"history"`
	Release  Observation        `json:"release"`
	Baseline Baseline           `json:"baseline"`
	Score    Score              `json:"score"`
}

// Simulate builds a plausible release history for a package and then applies
// a compromise scenario to the final release, returning the trust evaluation.
//
// It exists so the detection logic can be demonstrated (and regression-tested)
// without waiting months for a real package to drift — the same role the
// attack simulator played in the SCBTSS prototype this engine grew out of.
func Simulate(ecosystem, name string, scenario SimulationScenario, releases int) (Simulation, error) {
	if releases < MinObservations+1 {
		releases = MinObservations + 3
	}
	if ecosystem == "" {
		ecosystem = "npm"
	}
	if name == "" {
		name = "demo-package"
	}

	sim := Simulation{Scenario: scenario}
	start := time.Now().UTC().AddDate(0, 0, -14*releases)

	// A well-behaved library: no install hooks, no process spawns, stable size.
	for i := 0; i < releases-1; i++ {
		jitter := float64(i%3) - 1 // -1, 0, 1
		obs := Observation{
			Ecosystem:  ecosystem,
			Package:    name,
			Version:    fmt.Sprintf("1.%d.0", i),
			ObservedAt: start.AddDate(0, 0, 14*i),
			Source:     "simulate",
			Metrics: Metrics{
				NetworkCalls:     1,
				MaintainerCount:  2,
				ArtifactKB:       int(220 + jitter*8),
				DependencyCount:  4,
				ReleaseGapDays:   14 + jitter,
				ObfuscationScore: int(math.Max(0, 4+jitter)),
			},
		}
		if scenario == ScenarioSleeper && i >= releases-4 {
			// Slow drift: each of the last few releases nudges the profile.
			obs.Metrics.NetworkCalls += i - (releases - 5)
			obs.Metrics.ObfuscationScore += 6 * (i - (releases - 5))
		}
		sim.History = append(sim.History, obs)
	}

	last := sim.History[len(sim.History)-1]
	release := Observation{
		Ecosystem:  ecosystem,
		Package:    name,
		Version:    fmt.Sprintf("1.%d.0", releases-1),
		ObservedAt: last.ObservedAt.AddDate(0, 0, 14),
		Source:     "simulate",
		Metrics:    last.Metrics,
	}

	switch scenario {
	case ScenarioHijack:
		release.Metrics.InstallHooks = 2
		release.Metrics.NetworkCalls = 9
		release.Metrics.ProcessSpawns = 3
		release.Metrics.FilesystemWrites = 4
		release.Metrics.ObfuscationScore = 74
		release.Metrics.ArtifactKB += 180
		release.Metrics.CriticalFindings = 1
		release.Metrics.ReleaseGapDays = 0.4
	case ScenarioSleeper:
		release.Metrics.NetworkCalls += 4
		release.Metrics.ObfuscationScore += 22
		release.Metrics.FilesystemWrites = 2
		release.Metrics.HighFindings = 1
	case ScenarioTakeover:
		release.Metrics.MaintainerCount = 3
		release.Metrics.NewMaintainers = 2
		release.Metrics.InstallHooks = 1
		release.Metrics.NetworkCalls += 3
		release.Metrics.ReleaseGapDays = 0.2
	case ScenarioCleanBuild:
		release.Metrics.ArtifactKB += 6
		release.Metrics.DependencyCount++
	default:
		return Simulation{}, fmt.Errorf("unknown scenario %q (want: hijack, sleeper, takeover, clean)", scenario)
	}

	sim.Release = release
	sim.Baseline = BuildBaseline(sim.History)
	sim.Score = Evaluate(sim.Baseline, release)
	return sim, nil
}

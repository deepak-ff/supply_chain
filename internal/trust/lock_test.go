package trust

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestWriteReadLockRoundTrip(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, DefaultLockFile)
	lock := Lock{
		Version:   LockVersion,
		Tool:      "ChainWarden trust engine",
		Generated: time.Now().UTC(),
		Entries: []LockEntry{
			{Ecosystem: "npm", Package: "b", Version: "1.0.0", Fingerprint: "cw1:abc", Score: 90, State: StateGreen},
			{Ecosystem: "npm", Package: "a", Version: "2.0.0", Fingerprint: "cw1:def", Score: 100, State: StateGreen},
		},
	}
	lock.SortEntries()
	if err := WriteLock(path, lock); err != nil {
		t.Fatalf("WriteLock: %v", err)
	}
	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("stat lock: %v", err)
	}
	if info.Mode().Perm() != 0o644 {
		t.Fatalf("lockfile should be 0644, got %o", info.Mode().Perm())
	}

	got, err := ReadLock(path)
	if err != nil {
		t.Fatalf("ReadLock: %v", err)
	}
	if got.Version != LockVersion || len(got.Entries) != 2 {
		t.Fatalf("unexpected lock: %+v", got)
	}
	if got.Entries[0].Key() != "npm:a" || got.Entries[1].Key() != "npm:b" {
		t.Fatalf("entries not sorted by key: %+v", got.Entries)
	}
}

func TestReadLockMissingFileNamesTrustLock(t *testing.T) {
	_, err := ReadLock(filepath.Join(t.TempDir(), "nope.lock"))
	if err == nil {
		t.Fatal("expected an error for a missing lockfile")
	}
	if !strings.Contains(err.Error(), "cwctl trust lock") {
		t.Fatalf("missing-lock error should hint `cwctl trust lock`, got: %v", err)
	}
}

func TestReadLockRefusesNewerVersion(t *testing.T) {
	path := filepath.Join(t.TempDir(), DefaultLockFile)
	if err := WriteLock(path, Lock{Version: LockVersion + 1, Entries: []LockEntry{}}); err != nil {
		t.Fatal(err)
	}
	if _, err := ReadLock(path); err == nil || !strings.Contains(err.Error(), "newer ChainWarden") {
		t.Fatalf("expected a newer-version refusal, got: %v", err)
	}
}

func newLockTestStore(t *testing.T) *Store {
	t.Helper()
	store, err := NewStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	for _, obs := range steadyHistory(5) {
		if _, err := store.Record(obs); err != nil {
			t.Fatal(err)
		}
	}
	return store
}

func TestBuildLockAndVerifyMatch(t *testing.T) {
	store := newLockTestStore(t)
	lock, err := store.BuildLock()
	if err != nil {
		t.Fatal(err)
	}
	if len(lock.Entries) != 1 {
		t.Fatalf("expected 1 entry, got %d", len(lock.Entries))
	}
	entry := lock.Entries[0]
	if entry.Package != "steady-lib" || entry.Fingerprint == "" {
		t.Fatalf("unexpected entry: %+v", entry)
	}

	report, err := store.Verify(lock)
	if err != nil {
		t.Fatal(err)
	}
	if !report.OK || report.Checked != 1 || report.Matched != 1 || len(report.Drifts) != 0 {
		t.Fatalf("expected clean verify, got %+v", report)
	}
}

func TestVerifyDetectsBehaviourChange(t *testing.T) {
	store := newLockTestStore(t)
	lock, err := store.BuildLock()
	if err != nil {
		t.Fatal(err)
	}

	// A new release that stops behaving like itself.
	bad := steadyHistory(1)[0]
	bad.Version = "9.9.9"
	bad.ObservedAt = time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	bad.Metrics.InstallHooks = 2
	bad.Metrics.NetworkCalls = 12
	if _, err := store.Record(bad); err != nil {
		t.Fatal(err)
	}

	report, err := store.Verify(lock)
	if err != nil {
		t.Fatal(err)
	}
	if report.OK || report.Matched != 0 || len(report.Drifts) != 1 {
		t.Fatalf("expected exactly one drift, got %+v", report)
	}
	d := report.Drifts[0]
	if d.Kind != DriftBehaviourChanged {
		t.Fatalf("expected behaviour-changed, got %s", d.Kind)
	}
	if len(d.Deltas) == 0 {
		t.Fatal("behaviour-changed drift must carry metric deltas")
	}
	found := false
	for _, delta := range d.Deltas {
		if delta.Metric == "install_hooks" && delta.From == 0 && delta.To == 2 && delta.Riskier {
			found = true
		}
	}
	if !found {
		t.Fatalf("expected an install_hooks 0→2 riskier delta, got %+v", d.Deltas)
	}
}

func TestVerifyDetectsAddedAndRemoved(t *testing.T) {
	store := newLockTestStore(t)
	lock, err := store.BuildLock()
	if err != nil {
		t.Fatal(err)
	}

	// Forget the locked package → removed; track a new one → added.
	if err := store.Forget("npm", "steady-lib"); err != nil {
		t.Fatal(err)
	}
	other := steadyHistory(1)[0]
	other.Package = "other-lib"
	other.Version = "0.1.0"
	if _, err := store.Record(other); err != nil {
		t.Fatal(err)
	}

	report, err := store.Verify(lock)
	if err != nil {
		t.Fatal(err)
	}
	kinds := map[DriftKind]bool{}
	for _, d := range report.Drifts {
		kinds[d.Kind] = true
	}
	if !kinds[DriftAdded] || !kinds[DriftRemoved] {
		t.Fatalf("expected added + removed drifts, got %+v", report.Drifts)
	}
}

func TestDiffVersionsDefaultsPreviousVsLatest(t *testing.T) {
	store := newLockTestStore(t)
	diff, err := store.DiffVersions("npm", "steady-lib", "", "")
	if err != nil {
		t.Fatal(err)
	}
	if diff.FromVersion != "1.3.0" || diff.ToVersion != "1.4.0" {
		t.Fatalf("defaults should be previous-vs-latest, got %s -> %s", diff.FromVersion, diff.ToVersion)
	}
	// steadyHistory grows artifact_kb by 1 per release, so 1.3.0 → 1.4.0
	// shows exactly that one (non-directional) change.
	if len(diff.Deltas) != 1 || diff.Deltas[0].Metric != "artifact_kb" ||
		diff.Deltas[0].From != 203 || diff.Deltas[0].To != 204 || !diff.Deltas[0].Riskier {
		t.Fatalf("steady history should only diff artifact_kb 203→204, got %+v", diff.Deltas)
	}
}

func TestDiffVersionsExplicitAndErrors(t *testing.T) {
	store := newLockTestStore(t)
	diff, err := store.DiffVersions("npm", "steady-lib", "1.0.0", "1.4.0")
	if err != nil {
		t.Fatal(err)
	}
	if diff.FromVersion != "1.0.0" || diff.ToVersion != "1.4.0" {
		t.Fatalf("unexpected versions: %+v", diff)
	}

	if _, err := store.DiffVersions("npm", "steady-lib", "9.9.9", ""); !errors.Is(err, ErrVersionNotFound) {
		t.Fatalf("expected ErrVersionNotFound, got %v", err)
	}
	if _, err := store.DiffVersions("npm", "ghost", "", ""); !errors.Is(err, ErrNoObservations) {
		t.Fatalf("expected ErrNoObservations, got %v", err)
	}
}

func TestDiffReportsDirectionality(t *testing.T) {
	deltas := Diff(
		Metrics{NetworkCalls: 1, InstallHooks: 2, ArtifactKB: 200},
		Metrics{NetworkCalls: 5, InstallHooks: 0, ArtifactKB: 200},
	)
	by := map[string]MetricDelta{}
	for _, d := range deltas {
		by[d.Metric] = d
	}
	if len(deltas) != 2 {
		t.Fatalf("unchanged metrics must not appear: %+v", deltas)
	}
	if !by["network_calls"].Riskier {
		t.Error("more network calls must be riskier")
	}
	if by["install_hooks"].Riskier {
		t.Error("removing install hooks must NOT be riskier")
	}
}

// seedStore writes pkgs packages x releases healthy releases each (identical
// behaviour, monotonically increasing timestamps) into a fresh store. releases
// must be >= MinObservations+1 so the latest release of every package is scored
// GREEN rather than LEARNING — that is what lets the cache-invalidation test
// tell a stale (GREEN) summary apart from a fresh (RED) one.
func seedStore(t *testing.T, pkgs, releases int) *Store {
	t.Helper()
	store, err := NewStore(t.TempDir())
	if err != nil {
		t.Fatalf("NewStore: %v", err)
	}
	base := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	for p := 0; p < pkgs; p++ {
		name := fmt.Sprintf("pkg-%03d", p)
		for r := 0; r < releases; r++ {
			obs := Observation{
				Ecosystem:  "npm",
				Package:    name,
				Version:    fmt.Sprintf("1.0.%d", r),
				ObservedAt: base.AddDate(0, 0, 14*r),
				Source:     "seed",
				Metrics: Metrics{
					NetworkCalls:     1,
					MaintainerCount:  2,
					ArtifactKB:       200,
					DependencyCount:  3,
					ReleaseGapDays:   14,
					ObfuscationScore: 4,
				},
			}
			if _, err := store.Record(obs); err != nil {
				t.Fatalf("Record %s@%s: %v", name, obs.Version, err)
			}
		}
	}
	return store
}

func TestListInvalidatesCacheOnWrite(t *testing.T) {
	// 6 releases per package keeps every healthy package GREEN (its latest
	// release is scored against a >= MinObservations baseline), so a hijacked
	// pkg-000 dropping to RED is unmistakable — and a stale cache entry would
	// still report GREEN.
	store := seedStore(t, 5, 6)
	if _, err := store.List(); err != nil {
		t.Fatal(err)
	}
	if _, err := store.Record(Observation{
		Ecosystem: "npm", Package: "pkg-000", Version: "9.0.0",
		ObservedAt: time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC),
		Metrics:    Metrics{NetworkCalls: 9, InstallHooks: 3, ProcessSpawns: 4, ObfuscationScore: 88},
	}); err != nil {
		t.Fatal(err)
	}
	got, err := store.List()
	if err != nil {
		t.Fatal(err)
	}
	if got[0].Package != "pkg-000" || got[0].State == StateGreen {
		t.Fatalf("stale cache served after a write: %+v", got[0])
	}
}

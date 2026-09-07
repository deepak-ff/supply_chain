package trust

import (
	"errors"
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

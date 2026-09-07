package trust

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"
)

// benchmarkLedgerSet writes a store with pkgs packages × releases releases
// each (distinct versions, monotonically increasing timestamps) and returns
// the store. 200 packages × 8 releases matches the documented benchmark
// shape.
func benchmarkLedgerSet(b *testing.B, pkgs, releases int) *Store {
	b.Helper()
	store, err := NewStore(b.TempDir())
	if err != nil {
		b.Fatalf("NewStore: %v", err)
	}
	base := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	for p := 0; p < pkgs; p++ {
		name := fmt.Sprintf("pkg-%04d", p)
		for r := 0; r < releases; r++ {
			obs := Observation{
				Ecosystem:  "npm",
				Package:    name,
				Version:    fmt.Sprintf("1.%d.%d", p, r),
				ObservedAt: base.AddDate(0, 0, 14*r),
				Source:     "bench",
				Metrics: Metrics{
					NetworkCalls:     1,
					MaintainerCount:  2,
					ArtifactKB:       200 + r,
					DependencyCount:  3,
					ReleaseGapDays:   14,
					ObfuscationScore: 4,
				},
			}
			if _, err := store.Record(obs); err != nil {
				b.Fatalf("Record %s@%s: %v", name, obs.Version, err)
			}
		}
	}
	return store
}

// BenchmarkListCold measures a full List() with no summary cache — every
// ledger must be walked, read and scored (with the worker pool).
func BenchmarkListCold(b *testing.B) {
	store := benchmarkLedgerSet(b, 200, 8)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = os.Remove(filepath.Join(store.Root(), indexFileName))
		if _, err := store.List(); err != nil {
			b.Fatalf("List: %v", err)
		}
	}
}

// BenchmarkListWarm measures List() when the .index.json summary cache is
// valid: the ledgers are not read at all, only stat'ed.
func BenchmarkListWarm(b *testing.B) {
	store := benchmarkLedgerSet(b, 200, 8)
	if _, err := store.List(); err != nil { // build the cache once
		b.Fatalf("warm List: %v", err)
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, err := store.List(); err != nil {
			b.Fatalf("List: %v", err)
		}
	}
}

package trust

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// LockVersion is the on-disk version of chainwarden.lock. ReadLock refuses
// files written by a NEWER version so a downgraded tool can never silently
// misread a lockfile it does not understand.
const LockVersion = 1

// DefaultLockFile is the behavioural lockfile name written by
// `cwctl trust lock` and verified by `cwctl trust verify`, the API
// (/api/v1/trust/lock) and CI gates. It is resolved relative to the current
// working directory so a lockfile can be committed next to a manifest.
const DefaultLockFile = "chainwarden.lock"

// Errors returned by lock/diff operations. Callers (CLI, API handlers) can
// use errors.Is to pick an HTTP status or a hint.
var (
	// ErrNoObservations means a package has no recorded history yet.
	ErrNoObservations = errors.New("no trust observations recorded")
	// ErrVersionNotFound means a requested release is not in the ledger.
	ErrVersionNotFound = errors.New("version not found in ledger")
)

// LockEntry pins one package release at the behavioural state that was
// verified when the lockfile was generated.
type LockEntry struct {
	Ecosystem   string    `json:"ecosystem"`
	Package     string    `json:"package"`
	Version     string    `json:"version"`
	Fingerprint string    `json:"fingerprint"`
	Score       int       `json:"score"`
	State       string    `json:"state"`
	Metrics     Metrics   `json:"metrics"`
	LockedAt    time.Time `json:"locked_at"`
}

// Key returns the canonical "<ecosystem>:<package>" identifier.
func (e LockEntry) Key() string { return Key(e.Ecosystem, e.Package) }

// Lock is a behavioural lockfile: the set of packages (and the exact
// behaviour — fingerprint) that was approved at a point in time.
type Lock struct {
	Version   int         `json:"version"`
	Tool      string      `json:"tool"`
	Generated time.Time   `json:"generated"`
	Entries   []LockEntry `json:"entries"`
}

// SortEntries orders the entries by their canonical "<ecosystem>:<package>"
// key so that two lockfiles describing the same set of packages serialise
// byte-for-byte identically and diffs stay deterministic.
func (l *Lock) SortEntries() {
	sort.SliceStable(l.Entries, func(i, j int) bool {
		return l.Entries[i].Key() < l.Entries[j].Key()
	})
}

// DriftKind names the ways a live ledger can diverge from a lockfile.
type DriftKind string

// Supported drift kinds.
const (
	// DriftBehaviourChanged — the release's behavioural fingerprint no
	// longer matches what was locked (with the metric deltas attached).
	DriftBehaviourChanged DriftKind = "behaviour-changed"
	// DriftAdded — a package is tracked now but was absent from the lockfile.
	DriftAdded DriftKind = "added"
	// DriftRemoved — the lockfile pins a package that is no longer tracked.
	DriftRemoved DriftKind = "removed"
	// DriftTrustDropped — behaviour is unchanged but the trust score fell
	// below the locked score (e.g. the baseline shifted as history grew).
	DriftTrustDropped DriftKind = "trust-dropped"
)

// Drift is a single divergence between the lockfile and the live ledger.
type Drift struct {
	Kind            DriftKind     `json:"kind"`
	Ecosystem       string        `json:"ecosystem"`
	Package         string        `json:"package"`
	FromVersion     string        `json:"from_version,omitempty"`
	ToVersion       string        `json:"to_version,omitempty"`
	FromFingerprint string        `json:"from_fingerprint,omitempty"`
	ToFingerprint   string        `json:"to_fingerprint,omitempty"`
	FromScore       int           `json:"from_score,omitempty"`
	ToScore         int           `json:"to_score,omitempty"`
	FromState       string        `json:"from_state,omitempty"`
	ToState         string        `json:"to_state,omitempty"`
	Deltas          []MetricDelta `json:"metric_deltas,omitempty"`
	Message         string        `json:"message,omitempty"`
}

// Key returns the canonical "<ecosystem>:<package>" identifier.
func (d Drift) Key() string { return Key(d.Ecosystem, d.Package) }

// VerifyReport summarises a `Verify` run.
type VerifyReport struct {
	Checked    int       `json:"checked"`
	Matched    int       `json:"matched"`
	Drifts     []Drift   `json:"drifts"`
	OK         bool      `json:"ok"`
	VerifiedAt time.Time `json:"verified_at"`
}

// BuildLock snapshots every tracked package (latest observed release, its
// behavioural fingerprint and its current trust score/state) into a Lock.
// Entries are sorted by key for deterministic serialisation.
func (s *Store) BuildLock() (Lock, error) {
	lock := Lock{
		Version:   LockVersion,
		Tool:      "ChainWarden trust engine",
		Generated: time.Now().UTC(),
		Entries:   []LockEntry{},
	}
	err := filepath.WalkDir(s.root, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			if errors.Is(err, os.ErrNotExist) {
				return nil
			}
			return err
		}
		if d.IsDir() || strings.HasPrefix(d.Name(), ".") || !strings.HasSuffix(path, ".json") {
			return nil
		}
		data, rerr := os.ReadFile(path)
		if rerr != nil {
			return nil // skip unreadable ledgers rather than failing the lock
		}
		var l Ledger
		if jerr := json.Unmarshal(data, &l); jerr != nil || len(l.Observations) == 0 {
			return nil
		}
		sort.SliceStable(l.Observations, func(i, j int) bool {
			return l.Observations[i].ObservedAt.Before(l.Observations[j].ObservedAt)
		})
		latest := l.Observations[len(l.Observations)-1]
		score := Evaluate(BuildBaseline(l.Observations[:len(l.Observations)-1]), latest)
		lock.Entries = append(lock.Entries, LockEntry{
			Ecosystem:   l.Ecosystem,
			Package:     l.Package,
			Version:     latest.Version,
			Fingerprint: latest.Fingerprint(),
			Score:       score.Score,
			State:       score.State,
			Metrics:     latest.Metrics,
			LockedAt:    latest.ObservedAt,
		})
		return nil
	})
	if err != nil {
		return Lock{}, err
	}
	lock.SortEntries()
	return lock, nil
}

// WriteLock writes a lockfile atomically with 0644 permissions. The file is
// world-readable on purpose — it is meant to be committed to a repository
// and shared with CI.
func WriteLock(path string, lock Lock) error {
	data, err := json.MarshalIndent(lock, "", "  ")
	if err != nil {
		return fmt.Errorf("encode behavioural lockfile: %w", err)
	}
	if dir := filepath.Dir(path); dir != "." {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return fmt.Errorf("create lockfile directory: %w", err)
		}
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return fmt.Errorf("write behavioural lockfile: %w", err)
	}
	if err := os.Rename(tmp, path); err != nil {
		return fmt.Errorf("commit behavioural lockfile: %w", err)
	}
	return nil
}

// ReadLock loads a behavioural lockfile.
//
// A missing file returns an error that tells the user to run
// `cwctl trust lock` first; a lockfile written by a newer ChainWarden (higher
// LockVersion) is refused rather than silently misread.
func ReadLock(path string) (Lock, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return Lock{}, fmt.Errorf("no behavioural lockfile at %s — create one with `cwctl trust lock`", path)
		}
		return Lock{}, fmt.Errorf("read behavioural lockfile: %w", err)
	}
	var l Lock
	if err := json.Unmarshal(data, &l); err != nil {
		return Lock{}, fmt.Errorf("parse behavioural lockfile %s: %w", path, err)
	}
	if l.Version > LockVersion {
		return Lock{}, fmt.Errorf("behavioural lockfile %s was written by a newer ChainWarden (lock version %d, this build supports %d) — upgrade cwctl and re-run `cwctl trust lock`", path, l.Version, LockVersion)
	}
	if l.Version == 0 {
		l.Version = LockVersion
	}
	l.SortEntries()
	return l, nil
}

// Verify checks the live ledger against a behavioural lockfile. For every
// package in the lockfile it compares the current latest release's
// fingerprint with the locked one:
//
//   - fingerprint mismatch      → DriftBehaviourChanged, with the full metric
//     Diff between the locked and current release attached;
//   - fingerprint match but the current trust score fell below the locked
//     score → DriftTrustDropped;
//   - exact match              → counted as matched.
//
// Packages tracked now but absent from the lockfile produce DriftAdded;
// packages pinned in the lockfile but no longer tracked produce
// DriftRemoved.
func (s *Store) Verify(lock Lock) (VerifyReport, error) {
	rep := VerifyReport{
		Checked:    len(lock.Entries),
		Matched:    0,
		Drifts:     []Drift{},
		VerifiedAt: time.Now().UTC(),
	}
	current, err := s.BuildLock()
	if err != nil {
		return rep, err
	}

	lockedByKey := make(map[string]LockEntry, len(lock.Entries))
	for _, e := range lock.Entries {
		lockedByKey[strings.ToLower(e.Key())] = e
	}
	currentByKey := make(map[string]LockEntry, len(current.Entries))
	for _, e := range current.Entries {
		currentByKey[strings.ToLower(e.Key())] = e
	}

	seen := make(map[string]bool, len(current.Entries))
	for _, cur := range current.Entries {
		key := strings.ToLower(cur.Key())
		seen[key] = true
		locked, ok := lockedByKey[key]
		if !ok {
			rep.Drifts = append(rep.Drifts, Drift{
				Kind:          DriftAdded,
				Ecosystem:     cur.Ecosystem,
				Package:       cur.Package,
				ToVersion:     cur.Version,
				ToFingerprint: cur.Fingerprint,
				ToScore:       cur.Score,
				ToState:       cur.State,
				Message:       fmt.Sprintf("%s is tracked but was not in the lockfile", cur.Key()),
			})
			continue
		}

		if locked.Fingerprint != cur.Fingerprint {
			rep.Drifts = append(rep.Drifts, Drift{
				Kind:            DriftBehaviourChanged,
				Ecosystem:       cur.Ecosystem,
				Package:         cur.Package,
				FromVersion:     locked.Version,
				ToVersion:       cur.Version,
				FromFingerprint: locked.Fingerprint,
				ToFingerprint:   cur.Fingerprint,
				FromScore:       locked.Score,
				ToScore:         cur.Score,
				FromState:       locked.State,
				ToState:         cur.State,
				Deltas:          DiffObservations(obsOf(locked), obsOf(cur)),
				Message:         fmt.Sprintf("%s stopped behaving like the locked release", cur.Key()),
			})
			continue
		}

		if cur.Score < locked.Score {
			rep.Drifts = append(rep.Drifts, Drift{
				Kind:        DriftTrustDropped,
				Ecosystem:   cur.Ecosystem,
				Package:     cur.Package,
				FromVersion: locked.Version,
				ToVersion:   cur.Version,
				FromScore:   locked.Score,
				ToScore:     cur.Score,
				FromState:   locked.State,
				ToState:     cur.State,
				Message: fmt.Sprintf("%s behaviour is unchanged but trust fell from %d to %d",
					cur.Key(), locked.Score, cur.Score),
			})
			continue
		}
		rep.Matched++
	}

	for _, locked := range lock.Entries {
		if !seen[strings.ToLower(locked.Key())] {
			rep.Drifts = append(rep.Drifts, Drift{
				Kind:            DriftRemoved,
				Ecosystem:       locked.Ecosystem,
				Package:         locked.Package,
				FromVersion:     locked.Version,
				FromFingerprint: locked.Fingerprint,
				FromScore:       locked.Score,
				FromState:       locked.State,
				Message:         fmt.Sprintf("%s is in the lockfile but is no longer tracked", locked.Key()),
			})
		}
	}

	sort.SliceStable(rep.Drifts, func(i, j int) bool { return rep.Drifts[i].Key() < rep.Drifts[j].Key() })
	rep.OK = len(rep.Drifts) == 0
	return rep, nil
}

// obsOf rebuilds an Observation from a LockEntry so Verify can Diff a locked
// metric set against the current one.
func obsOf(e LockEntry) Observation {
	return Observation{Ecosystem: e.Ecosystem, Package: e.Package, Version: e.Version, Metrics: e.Metrics}
}

// VersionDiff describes how one release of a package differs from another.
type VersionDiff struct {
	Ecosystem       string        `json:"ecosystem"`
	Package         string        `json:"package"`
	FromVersion     string        `json:"from_version"`
	ToVersion       string        `json:"to_version"`
	FromFingerprint string        `json:"from_fingerprint"`
	ToFingerprint   string        `json:"to_fingerprint"`
	FromScore       int           `json:"from_score"`
	ToScore         int           `json:"to_score"`
	FromState       string        `json:"from_state"`
	ToState         string        `json:"to_state"`
	Deltas          []MetricDelta `json:"metric_deltas"`
}

// DiffVersions compares two releases of a package held in the ledger. Empty
// from/to versions default to "previous release vs latest release" — the
// useful question for a package that was just updated.
func (s *Store) DiffVersions(ecosystem, name, fromV, toV string) (VersionDiff, error) {
	l, err := s.Load(ecosystem, name)
	if err != nil {
		return VersionDiff{}, err
	}
	if len(l.Observations) == 0 {
		return VersionDiff{}, fmt.Errorf("%w for %s", ErrNoObservations, Key(ecosystem, name))
	}
	if toV == "" {
		toV = l.Observations[len(l.Observations)-1].Version
	}
	toIdx := -1
	for i, o := range l.Observations {
		if o.Version == toV {
			toIdx = i
			break
		}
	}
	if toIdx < 0 {
		return VersionDiff{}, fmt.Errorf("%w: %q for %s", ErrVersionNotFound, toV, Key(ecosystem, name))
	}

	fromIdx := toIdx - 1
	if fromV != "" {
		fromIdx = -1
		for i, o := range l.Observations {
			if o.Version == fromV {
				fromIdx = i
				break
			}
		}
		if fromIdx < 0 {
			return VersionDiff{}, fmt.Errorf("%w: %q for %s", ErrVersionNotFound, fromV, Key(ecosystem, name))
		}
	}
	if fromIdx < 0 {
		return VersionDiff{}, fmt.Errorf("no release before %q for %s — pass an explicit --from", toV, Key(ecosystem, name))
	}
	if fromIdx == toIdx {
		return VersionDiff{}, fmt.Errorf("from and to versions are identical (%q)", toV)
	}

	from := l.Observations[fromIdx]
	to := l.Observations[toIdx]
	fromScore := Evaluate(BuildBaseline(l.Observations[:fromIdx]), from)
	toScore := Evaluate(BuildBaseline(l.Observations[:toIdx]), to)

	return VersionDiff{
		Ecosystem:       l.Ecosystem,
		Package:         l.Package,
		FromVersion:     from.Version,
		ToVersion:       to.Version,
		FromFingerprint: from.Fingerprint(),
		ToFingerprint:   to.Fingerprint(),
		FromScore:       fromScore.Score,
		ToScore:         toScore.Score,
		FromState:       fromScore.State,
		ToState:         toScore.State,
		Deltas:          DiffObservations(from, to),
	}, nil
}

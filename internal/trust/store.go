package trust

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

// LedgerVersion is bumped when the on-disk ledger format changes.
const LedgerVersion = 1

// Ledger is the on-disk history for a single package.
type Ledger struct {
	Version      int           `json:"version"`
	Ecosystem    string        `json:"ecosystem"`
	Package      string        `json:"package"`
	UpdatedAt    time.Time     `json:"updated_at"`
	Observations []Observation `json:"observations"`
}

// Store persists per-package trust ledgers as JSON files under a root
// directory (by default ~/.chainwarden/trust).
type Store struct {
	root    string
	indexMu sync.Mutex // serialises access to the .index.json summary cache
}

// DefaultDir returns the default ledger directory, honouring CW_TRUST_DIR.
func DefaultDir() (string, error) {
	if dir := os.Getenv("CW_TRUST_DIR"); dir != "" {
		return dir, nil
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("resolve home directory: %w", err)
	}
	return filepath.Join(home, ".chainwarden", "trust"), nil
}

// NewStore opens (and lazily creates) a ledger store rooted at dir. An empty
// dir uses DefaultDir.
func NewStore(dir string) (*Store, error) {
	if dir == "" {
		d, err := DefaultDir()
		if err != nil {
			return nil, err
		}
		dir = d
	}
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, fmt.Errorf("create trust store %s: %w", dir, err)
	}
	return &Store{root: dir}, nil
}

// Root returns the directory backing the store.
func (s *Store) Root() string { return s.root }

// path maps a package onto its ledger file. Package names are slugified so
// that scoped npm names ("@scope/pkg") and Go module paths stay flat and
// cannot escape the store directory.
func (s *Store) path(ecosystem, name string) string {
	eco := slug(ecosystem)
	if eco == "" {
		eco = "unknown"
	}
	return filepath.Join(s.root, eco, slug(name)+".json")
}

func slug(v string) string {
	v = strings.ToLower(strings.TrimSpace(v))
	var b strings.Builder
	for _, r := range v {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9', r == '-', r == '.', r == '_':
			b.WriteRune(r)
		default:
			b.WriteByte('_')
		}
	}
	out := strings.Trim(b.String(), "._")
	if out == "" {
		return "unnamed"
	}
	return out
}

// Load returns the ledger for a package. A missing ledger is not an error —
// an empty ledger is returned instead.
func (s *Store) Load(ecosystem, name string) (Ledger, error) {
	l := Ledger{Version: LedgerVersion, Ecosystem: ecosystem, Package: name}
	data, err := os.ReadFile(s.path(ecosystem, name))
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return l, nil
		}
		return l, fmt.Errorf("read trust ledger: %w", err)
	}
	if err := json.Unmarshal(data, &l); err != nil {
		return l, fmt.Errorf("parse trust ledger %s/%s: %w", ecosystem, name, err)
	}
	sort.SliceStable(l.Observations, func(i, j int) bool {
		return l.Observations[i].ObservedAt.Before(l.Observations[j].ObservedAt)
	})
	return l, nil
}

// Save writes a ledger atomically.
func (s *Store) Save(l Ledger) error {
	l.Version = LedgerVersion
	l.UpdatedAt = time.Now().UTC()

	p := s.path(l.Ecosystem, l.Package)
	if err := os.MkdirAll(filepath.Dir(p), 0o700); err != nil {
		return fmt.Errorf("create ledger directory: %w", err)
	}
	data, err := json.MarshalIndent(l, "", "  ")
	if err != nil {
		return fmt.Errorf("encode trust ledger: %w", err)
	}
	tmp := p + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return fmt.Errorf("write trust ledger: %w", err)
	}
	if err := os.Rename(tmp, p); err != nil {
		return fmt.Errorf("commit trust ledger: %w", err)
	}
	s.invalidate(l.Ecosystem, l.Package)
	return nil
}

// Record appends an observation and returns the score for it, evaluated
// against the baseline built from the observations that came BEFORE it.
//
// Re-recording a version that already exists replaces the previous entry so
// repeated CI runs do not inflate the sample count.
func (s *Store) Record(obs Observation) (Score, error) {
	if strings.TrimSpace(obs.Package) == "" {
		return Score{}, errors.New("package name is required")
	}
	if obs.Ecosystem == "" {
		obs.Ecosystem = "npm"
	}
	if obs.ObservedAt.IsZero() {
		obs.ObservedAt = time.Now().UTC()
	}
	if obs.Source == "" {
		obs.Source = "manual"
	}

	l, err := s.Load(obs.Ecosystem, obs.Package)
	if err != nil {
		return Score{}, err
	}
	l.Ecosystem, l.Package = obs.Ecosystem, obs.Package

	history := make([]Observation, 0, len(l.Observations))
	for _, o := range l.Observations {
		if obs.Version != "" && o.Version == obs.Version {
			continue // superseded by this observation
		}
		history = append(history, o)
	}

	score := Evaluate(BuildBaseline(history), obs)

	l.Observations = append(history, obs)
	sort.SliceStable(l.Observations, func(i, j int) bool {
		return l.Observations[i].ObservedAt.Before(l.Observations[j].ObservedAt)
	})
	if err := s.Save(l); err != nil {
		return score, err
	}
	return score, nil
}

// Assess scores the most recent observation of a package against everything
// recorded before it, without mutating the ledger.
func (s *Store) Assess(ecosystem, name string) (Baseline, Score, error) {
	l, err := s.Load(ecosystem, name)
	if err != nil {
		return Baseline{}, Score{}, err
	}
	if len(l.Observations) == 0 {
		return Baseline{}, Score{}, fmt.Errorf("no trust observations recorded for %s", Key(ecosystem, name))
	}
	latest := l.Observations[len(l.Observations)-1]
	base := BuildBaseline(l.Observations[:len(l.Observations)-1])
	return base, Evaluate(base, latest), nil
}

// Summary is a compact per-package view used by `cwctl trust list` and the
// dashboard.
type Summary struct {
	Ecosystem    string    `json:"ecosystem"`
	Package      string    `json:"package"`
	Version      string    `json:"version"`
	Score        int       `json:"score"`
	State        string    `json:"state"`
	Samples      int       `json:"samples"`
	Deviations   int       `json:"deviations"`
	LastObserved time.Time `json:"last_observed"`
	Summary      string    `json:"summary"`
}

// Forget deletes a package ledger.
func (s *Store) Forget(ecosystem, name string) error {
	err := os.Remove(s.path(ecosystem, name))
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	s.invalidate(ecosystem, name)
	return nil
}

package trust

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"sync"
	"time"
)

// indexVersion is the on-disk format version of <root>/.index.json. Bump it
// when the cache layout or the Summary shape changes — a version-mismatched
// cache is simply discarded and rebuilt, never fatal.
const indexVersion = 1

// indexFileName is the summary cache written into the store root. It is a
// dotfile on purpose: the ledger walker skips dotfiles, so the cache can
// never be mistaken for a ledger.
const indexFileName = ".index.json"

// indexFileEntry remembers the provenance (size + mtime) of a ledger file so
// the cached Summary can be trusted only while the file is unchanged.
type indexFileEntry struct {
	Size    int64   `json:"size"`
	ModTime int64   `json:"mtime"` // unix nanoseconds
	Summary Summary `json:"summary"`
}

type indexFile struct {
	Version int                       `json:"version"`
	BuiltAt time.Time                 `json:"built_at"`
	Ledgers map[string]indexFileEntry `json:"ledgers"`
}

// ledgerFile is one candidate ledger discovered by the store walk.
type ledgerFile struct {
	rel  string // slash-separated path relative to the store root
	size int64
	mod  int64
}

// List returns a summary for every tracked package, worst trust score first.
//
// Summaries are cached in <root>/.index.json keyed by each ledger file's
// size+mtime, so a store whose ledgers have not changed is listed without
// re-reading a single ledger. Cache misses are parsed in parallel by a small
// worker pool (capped at min(NumCPU, 8)). A corrupt or version-mismatched
// cache is discarded and rebuilt — listing never fails because of it.
func (s *Store) List() ([]Summary, error) {
	s.indexMu.Lock()
	defer s.indexMu.Unlock()

	ledgers, err := s.ledgerFiles()
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return []Summary{}, nil
		}
		return nil, err
	}

	cache := s.readIndexFile()
	if cache.Ledgers == nil {
		cache.Ledgers = map[string]indexFileEntry{}
	}

	out := make([]Summary, 0, len(ledgers))
	var misses []ledgerFile
	dirty := false
	for _, lf := range ledgers {
		if e, ok := cache.Ledgers[lf.rel]; ok && e.Size == lf.size && e.ModTime == lf.mod {
			out = append(out, e.Summary)
			continue
		}
		misses = append(misses, lf)
	}

	if len(misses) > 0 {
		parsed := s.summarizeLedgers(misses)
		for _, lf := range misses {
			if sum, ok := parsed[lf.rel]; ok {
				out = append(out, sum)
				cache.Ledgers[lf.rel] = indexFileEntry{Size: lf.size, ModTime: lf.mod, Summary: sum}
				dirty = true
			} else {
				delete(cache.Ledgers, lf.rel) // unreadable/empty ledger: drop stale cache entry
				dirty = true
			}
		}
		// Re-check cached entries that were overwritten by a re-parse.
		if dirty {
			cache.BuiltAt = time.Now().UTC()
			s.writeIndexFile(cache)
		}
	}

	sort.SliceStable(out, func(i, j int) bool {
		if out[i].Score != out[j].Score {
			return out[i].Score < out[j].Score
		}
		return out[i].Package < out[j].Package
	})
	return out, nil
}

// ledgerFiles walks the store root collecting candidate ledger files. Dot
// entries (including the .index.json cache) are skipped so the index is never
// read as a ledger. Only *.json files are considered ledgers.
func (s *Store) ledgerFiles() ([]ledgerFile, error) {
	var files []ledgerFile
	err := filepath.WalkDir(s.root, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			if path != s.root && strings.HasPrefix(d.Name(), ".") {
				return filepath.SkipDir
			}
			return nil
		}
		if strings.HasPrefix(d.Name(), ".") || !strings.HasSuffix(path, ".json") {
			return nil
		}
		info, err := d.Info()
		if err != nil {
			return nil // skip ledgers we cannot stat rather than failing the listing
		}
		rel, err := filepath.Rel(s.root, path)
		if err != nil {
			return nil
		}
		files = append(files, ledgerFile{
			rel:  filepath.ToSlash(rel),
			size: info.Size(),
			mod:  info.ModTime().UnixNano(),
		})
		return nil
	})
	return files, err
}

// summarizeLedgers parses the given ledger files in parallel (worker pool
// capped at min(NumCPU, 8)) and returns one Summary per parseable, non-empty
// ledger. Unreadable or corrupt ledgers are skipped — mirroring the previous
// "never fail a listing because one ledger is bad" behaviour.
func (s *Store) summarizeLedgers(files []ledgerFile) map[string]Summary {
	results := make(map[string]Summary, len(files))
	if len(files) == 0 {
		return results
	}

	workers := runtime.NumCPU()
	if workers < 1 {
		workers = 1
	}
	if workers > 8 {
		workers = 8
	}

	jobs := make(chan ledgerFile)
	var wg sync.WaitGroup
	var mu sync.Mutex
	for w := 0; w < workers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for lf := range jobs {
				sum, ok := s.summaryFor(lf)
				if !ok {
					continue
				}
				mu.Lock()
				results[lf.rel] = sum
				mu.Unlock()
			}
		}()
	}
	for _, lf := range files {
		jobs <- lf
	}
	close(jobs)
	wg.Wait()
	return results
}

// summaryFor decodes one ledger and builds its Summary. ok=false means the
// file is unreadable, corrupt, or holds no observations.
func (s *Store) summaryFor(lf ledgerFile) (Summary, bool) {
	data, err := os.ReadFile(filepath.Join(s.root, filepath.FromSlash(lf.rel)))
	if err != nil {
		return Summary{}, false
	}
	var l Ledger
	if err := json.Unmarshal(data, &l); err != nil || len(l.Observations) == 0 {
		return Summary{}, false
	}
	sort.SliceStable(l.Observations, func(i, j int) bool {
		return l.Observations[i].ObservedAt.Before(l.Observations[j].ObservedAt)
	})
	latest := l.Observations[len(l.Observations)-1]
	score := Evaluate(BuildBaseline(l.Observations[:len(l.Observations)-1]), latest)
	return Summary{
		Ecosystem:    l.Ecosystem,
		Package:      l.Package,
		Version:      latest.Version,
		Score:        score.Score,
		State:        score.State,
		Samples:      len(l.Observations),
		Deviations:   len(score.Deviations),
		LastObserved: latest.ObservedAt,
		Summary:      score.Summary,
	}, true
}

func (s *Store) indexPath() string { return filepath.Join(s.root, indexFileName) }

// readIndexFile loads the summary cache. Corrupt or version-mismatched cache
// files are discarded (an empty cache is returned) — never an error.
func (s *Store) readIndexFile() indexFile {
	data, err := os.ReadFile(s.indexPath())
	if err != nil {
		return indexFile{Version: indexVersion, BuiltAt: time.Time{}, Ledgers: map[string]indexFileEntry{}}
	}
	var c indexFile
	if err := json.Unmarshal(data, &c); err != nil || c.Version != indexVersion {
		return indexFile{Version: indexVersion, BuiltAt: time.Time{}, Ledgers: map[string]indexFileEntry{}}
	}
	if c.Ledgers == nil {
		c.Ledgers = map[string]indexFileEntry{}
	}
	return c
}

// writeIndexFile persists the summary cache atomically. A cache with no
// entries is only written when the file already exists (so a fresh store does
// not get a spurious cache file from a single Save).
func (s *Store) writeIndexFile(c indexFile) {
	if len(c.Ledgers) == 0 {
		if _, err := os.Stat(s.indexPath()); err != nil {
			return
		}
	}
	c.Version = indexVersion
	if c.BuiltAt.IsZero() {
		c.BuiltAt = time.Now().UTC()
	}
	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return
	}
	tmp := s.indexPath() + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return
	}
	_ = os.Rename(tmp, s.indexPath())
}

// invalidate drops the cache entry for one package so the next List re-reads
// the ledger. Save() and Forget() call it after mutating a ledger — best
// effort: a cache that cannot be updated simply becomes a cache miss later.
func (s *Store) invalidate(ecosystem, name string) {
	s.indexMu.Lock()
	defer s.indexMu.Unlock()
	if _, err := os.Stat(s.indexPath()); err != nil {
		return
	}
	c := s.readIndexFile()
	rel, err := filepath.Rel(s.root, s.path(ecosystem, name))
	if err != nil {
		return
	}
	key := filepath.ToSlash(rel)
	if _, ok := c.Ledgers[key]; !ok {
		return
	}
	delete(c.Ledgers, key)
	c.BuiltAt = time.Now().UTC()
	s.writeIndexFile(c)
}

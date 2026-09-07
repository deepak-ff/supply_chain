package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/deepak-ff/supply_chain/internal/trust"
	"github.com/deepak-ff/supply_chain/internal/ui"
)

// runTrust implements `cwctl trust` — ChainWarden's Dynamic Trust Score.
//
// Where `cwctl scan` asks "does this release match a known-bad signature?",
// `cwctl trust` asks "does this release still behave like every previous
// release of itself?". It keeps a local behavioural ledger per package and
// scores drift against the learned baseline.
func runTrust(args []string, log *slog.Logger, p *ui.Printer) error {
	if len(args) == 0 {
		printTrustUsage(p)
		return nil
	}

	sub := args[0]
	rest := args[1:]

	switch sub {
	case "record":
		return runTrustRecord(rest, log, p)
	case "from-scan":
		return runTrustFromScan(rest, log, p)
	case "show":
		return runTrustShow(rest, p)
	case "list", "ls":
		return runTrustList(rest, p)
	case "simulate", "demo":
		return runTrustSimulate(rest, p)
	case "forget", "rm":
		return runTrustForget(rest, p)
	case "help", "-h", "--help":
		printTrustUsage(p)
		return nil
	default:
		printTrustUsage(p)
		return fmt.Errorf("trust: unknown subcommand %q", sub)
	}
}

func printTrustUsage(p *ui.Printer) {
	fmt.Fprint(p.Out, `
cwctl trust — Dynamic Trust Score (behavioural drift detection)

  Signature scanning catches malware we have already seen. The trust engine
  catches a package that stops behaving like itself: a new install hook, an
  outbound call it never made, a maintainer who appeared yesterday.

Usage:
  cwctl trust list                          Every tracked package, worst trust first
  cwctl trust show <eco:pkg>                Baseline, deviations and score for one package
  cwctl trust record <eco:pkg> [flags]      Add a behavioural observation
  cwctl trust from-scan <scan.json> [flags] Derive an observation from scan JSON
  cwctl trust simulate [flags]              Score a synthetic compromise scenario
  cwctl trust forget <eco:pkg>              Delete a package ledger

Common flags:
  --version <v>       Release version the observation belongs to
  --json              Machine-readable output
  --fail-on <state>   Exit non-zero when the score lands on amber or red (CI gate)
  --dir <path>        Ledger directory (default: ~/.chainwarden/trust, $CW_TRUST_DIR)

Examples:
  cwctl trust record npm:left-pad --version 1.3.0 --network 1 --deps 0 --size-kb 12
  cwctl trust from-scan scan.json --package npm:express --fail-on red
  cwctl trust simulate --scenario hijack
`)
}

// parseTrustArgs parses a flag set that also takes positional arguments,
// allowing flags on either side of them: Go's flag package stops parsing at
// the first non-flag argument, so `cwctl trust show npm:lodash --json` would
// otherwise silently drop --json.
func parseTrustArgs(fs *flag.FlagSet, args []string) ([]string, error) {
	var positionals []string
	for {
		if err := fs.Parse(args); err != nil {
			return nil, err
		}
		if fs.NArg() == 0 {
			return positionals, nil
		}
		positionals = append(positionals, fs.Arg(0))
		args = fs.Args()[1:]
	}
}

// ---- record ---------------------------------------------------------------

func runTrustRecord(args []string, log *slog.Logger, p *ui.Printer) error {
	fs := flag.NewFlagSet("trust record", flag.ExitOnError)
	dir := fs.String("dir", "", "ledger directory")
	version := fs.String("version", "", "release version")
	source := fs.String("source", "manual", "observation source (scan|ci|manual)")
	jsonOut := fs.Bool("json", false, "output JSON")
	failOn := fs.String("fail-on", "", "exit non-zero when the score is amber or red")

	hooks := fs.Int("hooks", 0, "install lifecycle hooks (preinstall/postinstall/prepare)")
	network := fs.Int("network", 0, "outbound network primitives")
	fsWrites := fs.Int("fs-writes", 0, "writes outside the package root")
	spawns := fs.Int("spawns", 0, "process spawns / exec calls")
	obfuscation := fs.Int("obfuscation", 0, "obfuscation density 0-100")
	maintainers := fs.Int("maintainers", 0, "maintainers with publish rights")
	newMaintainers := fs.Int("new-maintainers", 0, "maintainers first seen on this release")
	sizeKB := fs.Int("size-kb", 0, "published artifact size in KiB")
	deps := fs.Int("deps", 0, "direct runtime dependencies")
	critical := fs.Int("critical", 0, "critical findings from the last scan")
	high := fs.Int("high", 0, "high findings from the last scan")
	gap := fs.Float64("gap-days", 0, "days since the previous release")

	positionals, err := parseTrustArgs(fs, args)
	if err != nil {
		return err
	}
	if len(positionals) < 1 {
		return fmt.Errorf("trust record: expected a package, e.g. `cwctl trust record npm:lodash --version 4.17.21`")
	}

	eco, name := splitPackageRef(positionals[0])
	obs := trust.Observation{
		Ecosystem:  eco,
		Package:    name,
		Version:    *version,
		ObservedAt: time.Now().UTC(),
		Source:     *source,
		Metrics: trust.Metrics{
			InstallHooks:     *hooks,
			NetworkCalls:     *network,
			FilesystemWrites: *fsWrites,
			ProcessSpawns:    *spawns,
			ObfuscationScore: *obfuscation,
			MaintainerCount:  *maintainers,
			NewMaintainers:   *newMaintainers,
			ArtifactKB:       *sizeKB,
			DependencyCount:  *deps,
			CriticalFindings: *critical,
			HighFindings:     *high,
			ReleaseGapDays:   *gap,
		},
	}

	store, err := trust.NewStore(*dir)
	if err != nil {
		return err
	}
	score, err := store.Record(obs)
	if err != nil {
		return err
	}
	log.Debug("trust observation recorded", "package", obs.Key(), "version", obs.Version, "score", score.Score)

	if *jsonOut {
		return writeJSON(score)
	}
	printTrustScore(p, score, nil)
	return trustGate(*failOn, score)
}

// ---- from-scan ------------------------------------------------------------

// scanDocument is a tolerant view of `cwctl scan --format json` output. Only
// the fields the trust engine needs are decoded, so the command keeps working
// if the scan schema gains fields.
type scanDocument struct {
	RootDir string `json:"root_dir"`
	Results []struct {
		Entry struct {
			Ecosystem string `json:"ecosystem"`
			Name      string `json:"name"`
			Version   string `json:"version"`
		} `json:"entry"`
		Findings []scanFinding `json:"findings"`
		Skipped  bool          `json:"skipped"`
	} `json:"results"`
	Findings []scanFinding `json:"findings"`
}

type scanFinding struct {
	ID       string `json:"id"`
	Severity string `json:"severity"`
	Type     string `json:"type"`
	Title    string `json:"title"`
	Source   string `json:"source"`
}

func runTrustFromScan(args []string, log *slog.Logger, p *ui.Printer) error {
	fs := flag.NewFlagSet("trust from-scan", flag.ExitOnError)
	dir := fs.String("dir", "", "ledger directory")
	pkgRef := fs.String("package", "", "package to attribute the observation to (eco:name)")
	version := fs.String("version", "", "release version")
	jsonOut := fs.Bool("json", false, "output JSON")
	failOn := fs.String("fail-on", "", "exit non-zero when the score is amber or red")
	sizeKB := fs.Int("size-kb", 0, "published artifact size in KiB (not derivable from a scan)")
	deps := fs.Int("deps", 0, "direct runtime dependencies (not derivable from a scan)")
	maintainers := fs.Int("maintainers", 0, "maintainers with publish rights")
	newMaintainers := fs.Int("new-maintainers", 0, "maintainers first seen on this release")

	positionals, err := parseTrustArgs(fs, args)
	if err != nil {
		return err
	}
	if len(positionals) < 1 {
		return fmt.Errorf("trust from-scan: expected a scan JSON file (`cwctl scan . --format json > scan.json`)")
	}

	raw, err := os.ReadFile(positionals[0])
	if err != nil {
		return fmt.Errorf("trust from-scan: %w", err)
	}
	var doc scanDocument
	if err := json.Unmarshal(raw, &doc); err != nil {
		return fmt.Errorf("trust from-scan: %s is not ChainWarden scan JSON: %w", positionals[0], err)
	}

	eco, name := splitPackageRef(*pkgRef)
	findings := doc.Findings
	ver := *version

	// Prefer the per-package results block when the caller named a package.
	if name != "" {
		var matched []scanFinding
		found := false
		for _, r := range doc.Results {
			if !strings.EqualFold(r.Entry.Name, name) {
				continue
			}
			if eco != "" && !strings.EqualFold(r.Entry.Ecosystem, eco) {
				continue
			}
			found = true
			matched = append(matched, r.Findings...)
			if ver == "" {
				ver = r.Entry.Version
			}
			if eco == "" {
				eco = r.Entry.Ecosystem
			}
		}
		if found {
			findings = matched
		}
	} else if len(doc.Results) == 1 {
		eco = doc.Results[0].Entry.Ecosystem
		name = doc.Results[0].Entry.Name
		if ver == "" {
			ver = doc.Results[0].Entry.Version
		}
		findings = doc.Results[0].Findings
	}

	if name == "" {
		return fmt.Errorf("trust from-scan: could not infer the package — pass --package eco:name")
	}

	metrics := metricsFromFindings(findings)
	metrics.ArtifactKB = *sizeKB
	metrics.DependencyCount = *deps
	metrics.MaintainerCount = *maintainers
	metrics.NewMaintainers = *newMaintainers

	store, err := trust.NewStore(*dir)
	if err != nil {
		return err
	}

	// A scan cannot observe artifact size, dependency count, maintainer set or
	// release cadence. Rather than record them as zero — which would fabricate
	// a "dropped to 0" deviation on every scan — inherit the last known value
	// for anything the caller did not pass explicitly, and derive the release
	// gap from the previous observation.
	provided := map[string]bool{}
	fs.Visit(func(f *flag.Flag) { provided[f.Name] = true })
	if ledger, lerr := store.Load(eco, name); lerr == nil && len(ledger.Observations) > 0 {
		prev := ledger.Observations[len(ledger.Observations)-1]
		if !provided["size-kb"] {
			metrics.ArtifactKB = prev.Metrics.ArtifactKB
		}
		if !provided["deps"] {
			metrics.DependencyCount = prev.Metrics.DependencyCount
		}
		if !provided["maintainers"] {
			metrics.MaintainerCount = prev.Metrics.MaintainerCount
		}
		if gap := time.Since(prev.ObservedAt).Hours() / 24; gap > 0 {
			metrics.ReleaseGapDays = gap
		}
	}

	score, err := store.Record(trust.Observation{
		Ecosystem:  eco,
		Package:    name,
		Version:    ver,
		ObservedAt: time.Now().UTC(),
		Source:     "scan",
		Metrics:    metrics,
	})
	if err != nil {
		return err
	}
	log.Debug("trust observation derived from scan", "package", trust.Key(eco, name), "findings", len(findings))

	if *jsonOut {
		return writeJSON(score)
	}
	printTrustScore(p, score, nil)
	return trustGate(*failOn, score)
}

// metricsFromFindings turns scan findings into behavioural counters. The
// mapping is deliberately coarse: the trust engine cares about how the shape
// of a package's behaviour MOVES, not about the absolute accuracy of any one
// counter.
func metricsFromFindings(findings []scanFinding) trust.Metrics {
	var m trust.Metrics
	for _, f := range findings {
		switch strings.ToUpper(f.Severity) {
		case "CRITICAL":
			m.CriticalFindings++
		case "HIGH":
			m.HighFindings++
		}

		hay := strings.ToLower(f.ID + " " + f.Title + " " + f.Type + " " + f.Source)
		switch {
		case containsAny(hay, "postinstall", "preinstall", "install-script", "install script", "lifecycle", "prepare-script"):
			m.InstallHooks++
		case containsAny(hay, "exfil", "webhook", "c2", "reverse-shell", "network", "http", "phone-home", "dns"):
			m.NetworkCalls++
		case containsAny(hay, "spawn", "exec", "subprocess", "os.system", "child_process"):
			m.ProcessSpawns++
		case containsAny(hay, "persistence", "dotfile", "write", "ssh-key", "npmrc", "config-hijack"):
			m.FilesystemWrites++
		case containsAny(hay, "obfusc", "base64", "eval", "encoded", "minified", "steganograph"):
			m.ObfuscationScore += 12
		}
	}
	if m.ObfuscationScore > 100 {
		m.ObfuscationScore = 100
	}
	return m
}

func containsAny(haystack string, needles ...string) bool {
	for _, n := range needles {
		if strings.Contains(haystack, n) {
			return true
		}
	}
	return false
}

// ---- show / list / forget --------------------------------------------------

func runTrustShow(args []string, p *ui.Printer) error {
	fs := flag.NewFlagSet("trust show", flag.ExitOnError)
	dir := fs.String("dir", "", "ledger directory")
	jsonOut := fs.Bool("json", false, "output JSON")
	failOn := fs.String("fail-on", "", "exit non-zero when the score is amber or red")
	positionals, err := parseTrustArgs(fs, args)
	if err != nil {
		return err
	}
	if len(positionals) < 1 {
		return fmt.Errorf("trust show: expected a package, e.g. `cwctl trust show npm:lodash`")
	}

	store, err := trust.NewStore(*dir)
	if err != nil {
		return err
	}
	eco, name := splitPackageRef(positionals[0])
	baseline, score, err := store.Assess(eco, name)
	if err != nil {
		return err
	}

	if *jsonOut {
		return writeJSON(map[string]any{"baseline": baseline, "score": score})
	}
	printTrustScore(p, score, &baseline)
	return trustGate(*failOn, score)
}

func runTrustList(args []string, p *ui.Printer) error {
	fs := flag.NewFlagSet("trust list", flag.ExitOnError)
	dir := fs.String("dir", "", "ledger directory")
	jsonOut := fs.Bool("json", false, "output JSON")
	state := fs.String("state", "", "only show packages in this state (green|amber|red|learning)")
	if _, err := parseTrustArgs(fs, args); err != nil {
		return err
	}

	store, err := trust.NewStore(*dir)
	if err != nil {
		return err
	}
	items, err := store.List()
	if err != nil {
		return err
	}
	if *state != "" {
		want := strings.ToUpper(*state)
		filtered := items[:0:0]
		for _, it := range items {
			if it.State == want {
				filtered = append(filtered, it)
			}
		}
		items = filtered
	}

	if *jsonOut {
		return writeJSON(map[string]any{"store": store.Root(), "packages": items})
	}

	if len(items) == 0 {
		p.Warn("no trust observations yet — try: cwctl trust simulate --scenario hijack")
		return nil
	}

	fmt.Fprintf(p.Out, "\nDynamic Trust Scores  (%s)\n", store.Root())
	fmt.Fprintf(p.Out, "%s\n", strings.Repeat("─", 78))
	fmt.Fprintf(p.Out, "  %-30s %-10s %6s  %-9s %5s  %s\n", "PACKAGE", "VERSION", "SCORE", "STATE", "OBS", "DRIFT")
	for _, it := range items {
		fmt.Fprintf(p.Out, "  %-30s %-10s %6d  %-9s %5d  %d\n",
			truncate(trust.Key(it.Ecosystem, it.Package), 30),
			truncate(it.Version, 10),
			it.Score, it.State, it.Samples, it.Deviations)
	}
	fmt.Fprintf(p.Out, "%s\n", strings.Repeat("─", 78))
	fmt.Fprintf(p.Out, "  %d package(s) tracked\n\n", len(items))
	return nil
}

func runTrustForget(args []string, p *ui.Printer) error {
	fs := flag.NewFlagSet("trust forget", flag.ExitOnError)
	dir := fs.String("dir", "", "ledger directory")
	positionals, err := parseTrustArgs(fs, args)
	if err != nil {
		return err
	}
	if len(positionals) < 1 {
		return fmt.Errorf("trust forget: expected a package, e.g. `cwctl trust forget npm:lodash`")
	}
	store, err := trust.NewStore(*dir)
	if err != nil {
		return err
	}
	eco, name := splitPackageRef(positionals[0])
	if err := store.Forget(eco, name); err != nil {
		return err
	}
	p.Success("forgot trust ledger for %s", trust.Key(eco, name))
	return nil
}

// ---- simulate --------------------------------------------------------------

func runTrustSimulate(args []string, p *ui.Printer) error {
	fs := flag.NewFlagSet("trust simulate", flag.ExitOnError)
	scenario := fs.String("scenario", "hijack", "hijack | sleeper | takeover | clean")
	pkgRef := fs.String("package", "npm:demo-lib", "package name to simulate")
	releases := fs.Int("releases", 8, "number of releases in the synthetic history")
	save := fs.Bool("save", false, "persist the simulated history to the ledger")
	dir := fs.String("dir", "", "ledger directory")
	jsonOut := fs.Bool("json", false, "output JSON")
	if _, err := parseTrustArgs(fs, args); err != nil {
		return err
	}

	eco, name := splitPackageRef(*pkgRef)
	sim, err := trust.Simulate(eco, name, trust.SimulationScenario(*scenario), *releases)
	if err != nil {
		return err
	}

	if *save {
		store, err := trust.NewStore(*dir)
		if err != nil {
			return err
		}
		for _, obs := range sim.History {
			if _, err := store.Record(obs); err != nil {
				return err
			}
		}
		if _, err := store.Record(sim.Release); err != nil {
			return err
		}
	}

	if *jsonOut {
		return writeJSON(sim)
	}

	fmt.Fprintf(p.Out, "\nTrust simulation — scenario %q on %s\n", sim.Scenario, trust.Key(eco, name))
	fmt.Fprintf(p.Out, "  learned from %d prior release(s), scoring %s\n", len(sim.History), sim.Release.Version)
	printTrustScore(p, sim.Score, &sim.Baseline)
	if *save {
		p.Success("simulated history saved — inspect with: cwctl trust show %s", trust.Key(eco, name))
	}
	return nil
}

// ---- shared output ---------------------------------------------------------

func printTrustScore(p *ui.Printer, s trust.Score, baseline *trust.Baseline) {
	fmt.Fprintf(p.Out, "\n  %s  %s\n", trust.Key(s.Ecosystem, s.Package), versionLabel(s.Version))
	fmt.Fprintf(p.Out, "  %s\n", strings.Repeat("─", 60))
	fmt.Fprintf(p.Out, "  Trust score   %d/100   [%s]\n", s.Score, s.State)
	fmt.Fprintf(p.Out, "  Baseline      %d observation(s)\n", s.Samples)
	fmt.Fprintf(p.Out, "  Verdict       %s\n", s.Summary)

	if baseline != nil && baseline.Ready() {
		stats := make([]trust.Stat, 0, len(baseline.Stats))
		for _, st := range baseline.Stats {
			if st.Mean == 0 && st.Max == 0 {
				continue
			}
			stats = append(stats, st)
		}
		sort.SliceStable(stats, func(i, j int) bool { return stats[i].Metric < stats[j].Metric })
		if len(stats) > 0 {
			fmt.Fprintf(p.Out, "\n  Learned baseline\n")
		}
		for _, st := range stats {
			fmt.Fprintf(p.Out, "    %-28s mean %8.2f   sd %7.2f   range %.0f–%.0f\n",
				st.Label, st.Mean, st.StdDev, st.Min, st.Max)
		}
	}

	if len(s.Deviations) > 0 {
		fmt.Fprintf(p.Out, "\n  Behavioural drift\n")
		for _, d := range s.Deviations {
			fmt.Fprintf(p.Out, "    [%-8s] %-28s −%d pts  (z=%.1f)\n", d.Severity, d.Label, d.Deduction, d.ZScore)
			fmt.Fprintf(p.Out, "               %s\n", d.Reason)
		}
	}
	fmt.Fprintln(p.Out)
}

func versionLabel(v string) string {
	if v == "" {
		return ""
	}
	return "@" + v
}

func writeJSON(v any) error {
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	return enc.Encode(v)
}

// trustGate turns a score into a CI-friendly error when --fail-on is set.
func trustGate(failOn string, s trust.Score) error {
	switch strings.ToLower(strings.TrimSpace(failOn)) {
	case "", "none":
		return nil
	case "red":
		if s.State == trust.StateRed {
			return fmt.Errorf("trust gate: %s scored %d/100 (%s)", trust.Key(s.Ecosystem, s.Package), s.Score, s.State)
		}
	case "amber", "yellow":
		if s.State == trust.StateRed || s.State == trust.StateAmber {
			return fmt.Errorf("trust gate: %s scored %d/100 (%s)", trust.Key(s.Ecosystem, s.Package), s.Score, s.State)
		}
	default:
		return fmt.Errorf("trust: unknown --fail-on value %q (want: amber, red)", failOn)
	}
	return nil
}

// splitPackageRef accepts "npm:lodash", "npm/lodash" or a bare name (which
// defaults to the npm ecosystem, matching `cwctl scan`).
func splitPackageRef(ref string) (ecosystem, name string) {
	ref = strings.TrimSpace(ref)
	if ref == "" {
		return "", ""
	}
	if i := strings.Index(ref, ":"); i > 0 {
		return strings.ToLower(ref[:i]), ref[i+1:]
	}
	// "@scope/pkg" is an npm name, not an ecosystem-qualified reference.
	if i := strings.Index(ref, "/"); i > 0 && !strings.HasPrefix(ref, "@") {
		return strings.ToLower(ref[:i]), ref[i+1:]
	}
	return "npm", ref
}

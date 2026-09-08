import { useEffect, useRef, useState } from 'react';
import {
  Shield, Package, GitBranch, FileCheck,
  AlertCircle, CheckCircle, Eye, Bell, Timer, Github, ArrowRight,
  Globe, Server, Boxes, Database, Webhook, Crosshair, Radar, Zap,
} from 'lucide-react';
import { SignInDialog } from '../components/AuthPanel';
import { NetworkGraph } from '../components/NetworkGraph';
import { TopoBackground } from '../components/TopoBackground';
import { CopyButton } from '../components/CopyButton';
import { computeSecurityScore } from '../components/SecurityScore';
import { Card, CardBody } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { StatTile } from '../components/ui/stat-tile';
import {
  ThreatTicker, PostureRing, ExposureBars, CyberKicker,
} from '../components/cyber/CyberViz';
import { cn } from '../components/ui/utils';

const GITHUB_URL = 'https://github.com/deepak-ff/supply_chain';

const ENGINES = [
  { name: 'OSV',        desc: 'Known CVEs via osv.dev API',            always: true },
  { name: 'Behavioral', desc: 'Malicious install scripts, typosquatting', always: true },
  { name: 'Malware',    desc: 'Byte/regex pattern matching',            always: true },
  { name: 'AI Model',   desc: 'HuggingFace weight safety',              always: true },
  { name: 'MCP',        desc: 'Prompt injection in tool descriptions',  always: true },
  { name: 'Grype',      desc: 'Deep CVE scan of artifact files',        always: false },
  { name: 'Trivy',      desc: 'Container + OS CVE scanning',            always: false },
  { name: 'Semgrep',    desc: 'SAST static analysis',                   always: false },
];

const ECOSYSTEMS = ['npm', 'PyPI', 'Go', 'Maven', 'RubyGems', 'crates.io', 'HuggingFace', 'MCP', 'OCI / Docker'];

interface FreeProRow {
  feature: string;
  free: boolean;
  pro: boolean;
}

const FREE_PRO_ROWS: FreeProRow[] = [
  { feature: 'cwctl scan . — local project scan',                          free: true,  pro: true },
  { feature: '8 scan engines (OSV + Behavioral + Malware + AI Model + MCP)', free: true,  pro: true },
  { feature: 'Manifest ledger (CycloneDX + SPDX SBOM)',                    free: true,  pro: true },
  { feature: 'Sigstore keyless signing + verification',                    free: true,  pro: true },
  { feature: 'Community threat prints (contribute + use)',                 free: true,  pro: true },
  { feature: 'cwctl intel new/validate/test/update',                       free: true,  pro: true },
  { feature: 'Doctrine-as-code enforcement',                               free: true,  pro: true },
  { feature: 'Self-hostable + airgap-compatible',                         free: true,  pro: true },
  { feature: 'Command Deck dashboard',                                    free: true,  pro: true },
  { feature: 'Permit/deny, oracle brief, sentinel, red alerts, fix operatives, missions', free: true,  pro: true },
  { feature: 'cwctl advisory — AI security advisory',                    free: true,  pro: true },
  { feature: 'cwctl patch — AI autonomous patching',                     free: true,  pro: true },
  { feature: 'cwctl monitor — continuous overwatch',                     free: true,  pro: true },
  { feature: 'Tripwires (webhook config UI)',                            free: false, pro: true },
  { feature: 'Team management + RBAC',                                    free: false, pro: true },
  { feature: 'SLA + priority support',                                    free: false, pro: true },
  { feature: 'Cloud-hosted option',                                       free: false, pro: true },
];

const PROBLEMS = [
  {
    icon: Eye,
    title: 'Blind spots',
    desc: 'Dependencies come from nine different ecosystems. Without a single scan surface, most teams only see the packages they think to check.',
  },
  {
    icon: Bell,
    title: 'Alert fatigue',
    desc: 'A single-engine scanner produces one signal per package. Cross-referencing that against real exploitability takes a second tool, and a third.',
  },
  {
    icon: Timer,
    title: 'Slow response',
    desc: 'By the time a CVE is triaged, prioritized, and a fix is proposed by hand, the window to patch before exploitation has often already closed.',
  },
];

const HOW_IT_WORKS = [
  { step: '1', title: 'Connect',    desc: 'Point cwctl at a project, a registry package, or an uploaded archive — no account required.' },
  { step: '2', title: 'Probe',      desc: 'All available engines run concurrently: five built-in, three optional if installed.' },
  { step: '3', title: 'Recon',      desc: 'Findings are normalized across engines and enriched with fix versions where known.' },
  { step: '4', title: 'Prioritize', desc: 'Severity, exploitability, and AI triage combine into a single grade per package.' },
  { step: '5', title: 'Remediate',  desc: 'Apply the suggested fix version, or let the fix operative propose a compatible upgrade.' },
];

const INTEGRATION_STEPS = [
  {
    step: '1',
    title: 'Install',
    detail: 'One-liner, no compiler required — auto-detects OS/arch, falls back to go install.',
    code: 'curl -sSfL https://raw.githubusercontent.com/deepak-ff/supply_chain/main/install.sh | sh',
    note: 'Installs cwctl (+ cw-agent, intel-agent) to ~/.local/bin.',
  },
  {
    step: '2',
    title: 'Probe',
    detail: 'No account, no config file required to run your first probe.',
    code: 'cwctl scan .',
    note: 'Config, policy, and signatures live at ~/.chainwarden/{config,policy}.yaml and signatures.json — created on first run.',
  },
  {
    step: '3',
    title: 'Wire into CI',
    detail: 'Drop into any GitHub Actions workflow — fails the build on findings above your threshold.',
    code: 'cwctl scan . --ci --fail-on=high --format=sarif > results.sarif',
    note: 'SARIF output uploads directly to GitHub Code Scanning via github/codeql-action/upload-sarif.',
  },
  {
    step: '4',
    title: 'Connect the deck',
    detail: 'The dashboard and cwctl are two clients of the same API — point either at your server.',
    code: 'cwctl config set api_url=http://localhost:8080',
    note: 'Probes triggered from the CLI show up on the Command Deck, and vice versa — same backend, same data.',
  },
];

const INTEGRATIONS = [
  { name: 'Grype',           desc: 'Deep CVE scan of artifact files — auto-detected if installed', icon: Boxes },
  { name: 'Trivy',           desc: 'Container + OS CVE scanning — auto-detected if installed',     icon: Server },
  { name: 'Semgrep',         desc: 'SAST static analysis — auto-detected if installed',             icon: FileCheck },
  { name: 'GitHub Actions',  desc: 'Drop-in CI workflow for probe-on-PR',                           icon: Github },
  { name: 'Slack / Discord', desc: 'Tripwire alerts on new findings',                               icon: Webhook },
  { name: 'Generic Webhook', desc: 'Push alerts to any HTTP endpoint',                              icon: Globe },
];

const TOPOLOGY = [
  { label: 'Internet',       icon: Globe },
  { label: 'API',            icon: Server },
  { label: 'Application',    icon: Boxes },
  { label: 'Infrastructure', icon: GitBranch },
  { label: 'Database',       icon: Database },
];

function TierMark({ ok }: { ok: boolean }) {
  return ok
    ? <CheckCircle size={14} className="text-success" />
    : <span className="font-mono text-[0.68rem] text-text-muted">—</span>;
}

function SectionHead({ index, kicker, title, sub }: { index: string; kicker: string; title: string; sub?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <div className="mx-auto max-w-xs"><CyberKicker index={index} label={kicker} /></div>
      <h2 className="m-0 text-2xl font-bold tracking-tight text-text-primary">{title}</h2>
      {sub && <p className="mx-auto mt-3 text-sm leading-relaxed text-text-secondary">{sub}</p>}
    </div>
  );
}

interface PitchPageProps {
  onLoggedIn: () => void;
  onNavigateEnterprise: () => void;
}

export function PitchPage({ onLoggedIn, onNavigateEnterprise }: PitchPageProps) {
  const [scrolled, setScrolled] = useState(false);
  // Sign-in is a modal reached from the top bar — never a section that
  // competes with the hero. Auth is optional: local/dev installs run with it
  // disabled and go straight to the dashboard.
  const [signInOpen, setSignInOpen] = useState(false);
  const featuresRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Illustrative-only example data for the risk intelligence preview —
  // labeled clearly since there's no logged-in real data on a marketing page.
  const illustrativeSummary = { critical: 1, high: 3, medium: 6, low: 4 };
  const illustrativeScore = computeSecurityScore(illustrativeSummary);

  return (
    <div className="min-h-screen overflow-x-hidden text-text-primary">
      {/* 1. Sticky nav */}
      <nav
        className={cn(
          'sticky top-0 z-40 flex items-center justify-between gap-2 border-b bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] px-4 py-3.5 backdrop-blur-md transition-colors sm:px-6',
          scrolled ? 'border-border-color' : 'border-transparent',
        )}
      >
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-neon to-transparent opacity-70" />
        <div className="flex min-w-0 shrink items-center gap-2.5">
          <span className="relative grid h-9 w-9 shrink-0 place-items-center">
            <span aria-hidden="true" className="cyber-hex absolute inset-0 bg-gradient-to-br from-neon to-magenta opacity-70" />
            <span aria-hidden="true" className="cyber-hex absolute inset-[2px] bg-surface" />
            <img src="/logo-icon.png" alt="ChainWarden" className="relative h-5 w-5 object-contain" />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block whitespace-nowrap text-[1.02rem] font-bold tracking-tight text-text-primary">
              ChainWarden<span aria-hidden="true" className="cw-blink" />
            </span>
            <span className="block font-mono text-[0.55rem] uppercase tracking-[0.3em] text-neon">neon sentry</span>
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="wd-hover flex items-center gap-1.5 rounded-md border border-border-color px-2.5 py-1.5 text-sm font-medium text-text-primary hover:border-neon hover:text-neon hover:shadow-glow sm:px-3.5"
          >
            <Github size={14} /> <span className="hidden sm:inline">GitHub</span>
          </a>
          <button
            type="button"
            onClick={() => setSignInOpen(true)}
            className="wd-hover whitespace-nowrap rounded-md border border-neon bg-neon px-3.5 py-1.5 font-mono text-[0.72rem] font-bold uppercase tracking-widest text-void hover:shadow-glow"
          >
            Sign in
          </button>
        </div>
      </nav>

      {/* 2. Hero */}
      <section className="relative overflow-hidden px-6 pb-16 pt-16 text-center">
        <TopoBackground className="text-text-primary" opacity={0.05} lines={12} />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-60">
          <NetworkGraph mode="ambient" opacity={0.12} width={1100} height={520} />
        </div>
        {/* radar beam wash */}
        <span aria-hidden="true" className="pointer-events-none absolute -right-32 top-0 h-96 w-96 rounded-full opacity-20">
          <span className="cyber-radar-beam absolute inset-0 rounded-full" />
        </span>
        <div className="relative z-10 mx-auto max-w-3xl">
          <p className="m-0 mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-neon bg-[color-mix(in_srgb,var(--neon)_10%,transparent)] px-3.5 py-1.5 font-mono text-[0.62rem] font-bold uppercase tracking-[0.22em] text-neon">
            <span aria-hidden="true" className="sonar h-1.5 w-1.5 rounded-full bg-neon text-neon" />
            local-first behavioural supply-chain security
          </p>
          <h1 className="m-0 text-4xl font-bold leading-tight tracking-tight text-text-primary sm:text-5xl">
            Your dependencies are strangers you run as <span className="neon-text">root</span>.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-text-secondary">
            Signatures only catch malware someone has already seen. ChainWarden instead learns how
            every package behaves and flags the release that stops behaving like <em>itself</em> — a
            new install hook, an outbound call it never made, a maintainer who appeared yesterday.
            Eight detection engines across nine ecosystems, probing, signing and patching locally
            and free.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setSignInOpen(true)}
              className="wd-hover cyber-breathe flex items-center gap-2 rounded-md bg-neon px-6 py-2.5 font-mono text-[0.78rem] font-bold uppercase tracking-widest text-void hover:shadow-glow"
            >
              <Crosshair size={14} /> Enter the deck <ArrowRight size={14} />
            </button>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="wd-hover flex items-center gap-2 rounded-md border border-border-color bg-surface px-5 py-2.5 text-sm font-semibold text-text-primary hover:border-neon hover:text-neon"
            >
              <Github size={14} /> View on GitHub
            </a>
            <button
              onClick={() => scrollTo(featuresRef)}
              className="wd-hover rounded-md border border-magenta bg-[color-mix(in_srgb,var(--magenta)_10%,transparent)] px-5 py-2.5 font-mono text-[0.78rem] font-bold uppercase tracking-widest text-magenta hover:shadow-glow"
            >
              Explore arsenal
            </button>
          </div>
          {/* arsenal stats strip */}
          <div className="mx-auto mt-8 grid max-w-2xl grid-cols-2 gap-px overflow-hidden rounded-md border border-border-color bg-border-color font-mono sm:grid-cols-4">
            {[
              ['08', 'engines armed'],
              ['09', 'ecosystems'],
              ['223', 'threat prints'],
              ['100%', 'local-first'],
            ].map(([v, l]) => (
              <div key={l} className="bg-surface px-3 py-3">
                <div className="neon-text text-xl font-bold tabular-nums">{v}</div>
                <div className="mt-0.5 text-[0.58rem] uppercase tracking-[0.2em] text-text-muted">{l}</div>
              </div>
            ))}
          </div>
          <p className="mt-6 text-xs text-text-muted">
            No account required for the CLI — and local installs run with auth
            disabled, so the deck opens straight away. Self-hostable and
            airgap-compatible.
          </p>
        </div>
        {/* live-wire ticker flavor */}
        <div className="relative z-10 mx-auto mt-8 max-w-5xl text-left">
          <ThreatTicker
            items={[
              { id: 'h1', severity: 'INFO', text: 'sentry grid armed — 8 engines online' },
              { id: 'h2', severity: 'LOW', text: '223 threat prints loaded into the arsenal' },
              { id: 'h3', severity: 'INFO', text: '9 ecosystems under overwatch' },
              { id: 'h4', severity: 'MEDIUM', text: 'illustrative feed — your live signals appear after login' },
            ]}
          />
        </div>
      </section>

      {/* 3. Problem section */}
      <section className="border-t border-border-color bg-surface px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <SectionHead
            index="01" kicker="threat landscape"
            title="Your exposure grid never stops moving"
            sub="Every release, every transitive dependency, every maintainer change — the surface you defend shifts daily."
          />
          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {PROBLEMS.map((p, i) => (
              <Card key={p.title} className="cyber-lift p-6">
                <div className="flex items-center justify-between">
                  <p.icon size={20} className="text-neon" />
                  <span className="font-mono text-[0.6rem] font-bold text-magenta">0{i + 1}</span>
                </div>
                <h3 className="mt-3 text-sm font-semibold text-text-primary">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">{p.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Product overview */}
      <section ref={featuresRef} className="scroll-mt-16 px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <SectionHead
            index="02" kicker="arsenal"
            title="One sentry layer across your stack"
            sub="Every probe runs all available engines concurrently — five always armed, three optional engines activate automatically if installed."
          />
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ENGINES.map((e) => (
              <Card key={e.name} className="cyber-lift p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 font-mono text-sm font-bold text-text-primary">
                    <span
                      aria-hidden="true"
                      className={cn('h-1.5 w-1.5 rounded-full', e.always ? 'bg-success shadow-[0_0_6px_var(--success)]' : 'bg-warning')}
                    />
                    {e.name}
                  </span>
                  {e.always
                    ? <Badge variant="safe" className="text-[0.6rem]">armed</Badge>
                    : <Badge variant="outline" className="text-[0.6rem]">standby</Badge>}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-text-secondary">{e.desc}</p>
              </Card>
            ))}
          </div>

          <h3 className="mt-14 text-center font-mono text-[0.7rem] font-bold uppercase tracking-[0.24em] text-neon">
            9 ecosystems · one probe
          </h3>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {ECOSYSTEMS.map((eco) => (
              <span
                key={eco}
                className="wd-hover rounded-md border border-border-color bg-surface px-3.5 py-1.5 font-mono text-xs text-text-primary hover:border-neon hover:text-neon hover:shadow-glow"
              >
                {eco}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Continuous monitoring */}
      <section className="overflow-hidden border-t border-border-color bg-surface px-6 py-20">
        <div className="mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-2">
          <div>
            <CyberKicker index="03" label="overwatch" />
            <h2 className="m-0 text-2xl font-bold tracking-tight text-text-primary">
              A sentinel over your dependency graph
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-text-secondary">
              Every dependency is tracked as a node in a live graph. As new CVEs land upstream, the
              graph re-evaluates affected packages so nothing has to wait for the next manual probe.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Badge variant="outline">Manifest-ledger tracking</Badge>
              <Badge variant="outline">Tripwire alerts</Badge>
            </div>
          </div>
          <div className="flex max-w-full justify-center overflow-hidden rounded-md border border-border-color bg-bg-base p-4">
            <NetworkGraph mode="ambient" opacity={0.6} width={420} height={320} />
          </div>
        </div>
      </section>

      {/* 6. Risk intelligence */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <SectionHead
            index="04" kicker="intel preview"
            title="Risk intelligence, at a glance"
            sub="Illustrative example — your real deck populates these from live probe data."
          />
          <div className="mt-10 grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="cyber-lift">
              <CardBody className="flex h-full flex-col items-center justify-center gap-2 py-6">
                <PostureRing score={illustrativeScore} size={120} />
                <span className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-text-muted">posture grade</span>
              </CardBody>
            </Card>
            <StatTile label="Critical signals" value={illustrativeSummary.critical} accent="critical" icon={AlertCircle} hint="Needs immediate response" className="cyber-lift" />
            <StatTile label="High signals" value={illustrativeSummary.high} accent="warning" icon={Shield} hint="Triage before shipping" className="cyber-lift" />
            <Card className="cyber-lift">
              <CardBody className="flex h-full flex-col justify-center gap-3 py-6">
                <div className="flex items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.2em] text-text-muted">
                  <Package size={12} /> assets under watch · ~40
                </div>
                <ExposureBars
                  rows={[
                    { label: 'Critical', value: illustrativeSummary.critical, max: 14, tone: 'critical' },
                    { label: 'High', value: illustrativeSummary.high, max: 14, tone: 'warning' },
                    { label: 'Medium', value: illustrativeSummary.medium, max: 14, tone: 'amber' },
                    { label: 'Low', value: illustrativeSummary.low, max: 14, tone: 'neon' },
                  ]}
                />
              </CardBody>
            </Card>
          </div>
        </div>
      </section>

      {/* 7. Exposure pipeline diagram */}
      <section className="border-t border-border-color bg-surface px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <SectionHead
            index="05" kicker="exposure map"
            title="Full blast-path visibility"
          />
          <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
            {TOPOLOGY.map((t, i) => (
              <div key={t.label} className="flex items-center gap-3">
                <div className="cyber-lift flex flex-col items-center gap-2 rounded-md border border-border-color bg-bg-base px-6 py-5">
                  <t.icon size={20} className="text-neon" />
                  <span className="font-mono text-[0.68rem] font-semibold uppercase tracking-wider text-text-primary">{t.label}</span>
                </div>
                {i < TOPOLOGY.length - 1 && <ArrowRight size={16} className="text-magenta" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8. How it works */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <SectionHead index="06" kicker="battle plan" title="How it works" />
          <div className="mt-10 grid gap-6 sm:grid-cols-5">
            {HOW_IT_WORKS.map((s) => (
              <div key={s.step} className="text-center">
                <div className="cyber-hex mx-auto grid h-11 w-11 place-items-center bg-gradient-to-br from-neon to-magenta font-mono text-sm font-bold text-void">
                  {s.step}
                </div>
                <h3 className="mt-3 text-sm font-semibold text-text-primary">{s.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8b. Integration guide — concrete steps, not just marketing copy */}
      <section className="border-t border-border-color bg-surface px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <SectionHead
            index="07" kicker="deploy"
            title="Integrate it in minutes"
            sub="Real commands, real file paths — the CLI and deck are two clients of the same engine, not separate products."
          />
          <div className="mt-10 flex flex-col gap-4">
            {INTEGRATION_STEPS.map((s) => (
              <div key={s.step} className="cyber-lift flex gap-4 rounded-md border border-border-color bg-bg-base p-5">
                <div className="cyber-hex grid h-9 w-9 shrink-0 place-items-center bg-neon font-mono text-sm font-bold text-void">
                  {s.step}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="m-0 text-sm font-semibold text-text-primary">{s.title}</h3>
                  <p className="m-0 mt-1 text-sm text-text-secondary">{s.detail}</p>
                  <div className="mt-3 flex items-start justify-between gap-3 rounded-md border border-neon bg-surface px-3 py-2 shadow-glow">
                    <code className="break-all font-mono text-xs text-neon sm:break-normal sm:overflow-x-auto sm:whitespace-nowrap">
                      <span className="mr-2 select-none text-magenta">$</span>{s.code}
                    </code>
                    <CopyButton text={s.code} className="shrink-0" />
                  </div>
                  <p className="m-0 mt-2 font-mono text-[0.68rem] text-text-muted">{s.note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 9. Uplinks */}
      <section className="border-t border-border-color bg-surface px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <SectionHead
            index="08" kicker="uplinks"
            title="Plugs into your stack"
            sub="Optional engines auto-detect if installed. CI and alerting uplinks are first-class."
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {INTEGRATIONS.map((i) => (
              <Card key={i.name} className="cyber-lift flex items-start gap-3 p-4">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-neon bg-[color-mix(in_srgb,var(--neon)_10%,transparent)]">
                  <i.icon size={16} className="text-neon" />
                </span>
                <div>
                  <div className="text-sm font-semibold text-text-primary">{i.name}</div>
                  <div className="mt-1 text-xs leading-relaxed text-text-secondary">{i.desc}</div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 10. Free vs Pro */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <SectionHead
            index="09" kicker="arsenal tiers"
            title="Community vs Command Tier"
            sub="ChainWarden is open-core — the engine, CLI, scanner, and community tools are Apache 2.0, free forever. Command Tier adds AI-powered features and team capabilities."
          />
          <Card className="cyber-lift mt-8 overflow-hidden">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border-color bg-[color-mix(in_srgb,var(--neon)_6%,transparent)]">
                  <th className="px-4 py-3 text-left font-mono text-[0.7rem] uppercase tracking-widest text-text-secondary">Capability</th>
                  <th className="px-4 py-3 text-center font-mono text-[0.7rem] uppercase tracking-widest text-neon">Community</th>
                  <th className="px-4 py-3 text-center font-mono text-[0.7rem] uppercase tracking-widest text-magenta">Command</th>
                </tr>
              </thead>
              <tbody>
                {FREE_PRO_ROWS.map((row, i) => (
                  <tr key={row.feature} className={i < FREE_PRO_ROWS.length - 1 ? 'border-b border-[color-mix(in_srgb,var(--border-color)_60%,transparent)]' : ''}>
                    <td className="px-4 py-2.5 text-text-primary">{row.feature}</td>
                    <td className="px-4 py-2.5 text-center"><TierMark ok={row.free} /></td>
                    <td className="px-4 py-2.5 text-center"><TierMark ok={row.pro} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <p className="mt-4 text-center text-xs text-text-muted">
            Community threat prints stay community-owned — revenue from Command Tier funds continued
            development. You&apos;ll never lose access to what you have today.
          </p>
        </div>
      </section>

      {/* 10b. Enterprise / consulting teaser */}
      <section className="relative overflow-hidden border-t border-border-color bg-surface px-6 py-20">
        <TopoBackground className="text-text-primary" opacity={0.04} lines={8} />
        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <div className="mx-auto max-w-[220px]"><CyberKicker index="10" label="war room" /></div>
          <h2 className="m-0 text-2xl font-bold text-text-primary">Work with us directly</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-text-secondary">
            Beyond the open-source tool and Command Tier, we help companies deploy, run, and extend
            ChainWarden inside their own environment — setup, ongoing management, and custom
            development.
          </p>
          <div className="mt-8 flex justify-center">
            <button
              onClick={onNavigateEnterprise}
              className="wd-hover flex items-center gap-2 rounded-md border border-magenta bg-[color-mix(in_srgb,var(--magenta)_10%,transparent)] px-6 py-2.5 font-mono text-[0.78rem] font-bold uppercase tracking-widest text-magenta hover:shadow-glow"
            >
              <Radar size={14} /> See war-room services <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </section>

      {/* 11. Final CTA */}
      <section className="relative overflow-hidden border-t border-border-color px-6 py-20 text-center">
        <span aria-hidden="true" className="pointer-events-none absolute -left-24 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full opacity-20">
          <span className="cyber-radar-beam absolute inset-0 rounded-full" />
        </span>
        <span aria-hidden="true" className="pointer-events-none absolute -right-24 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full opacity-20">
          <span className="cyber-radar-beam absolute inset-0 rounded-full" />
        </span>
        <p className="m-0 font-mono text-[0.62rem] font-bold uppercase tracking-[0.3em] text-neon">final transmission</p>
        <h2 className="m-0 mx-auto mt-3 max-w-xl text-3xl font-bold tracking-tight text-text-primary">
          Make security <span className="neon-text">continuously visible</span>.
        </h2>
        <button
          type="button"
          onClick={() => setSignInOpen(true)}
          className="wd-hover cyber-breathe mt-8 inline-flex items-center gap-2 rounded-md bg-neon px-8 py-3 font-mono text-[0.8rem] font-bold uppercase tracking-widest text-void hover:shadow-glow"
        >
          <Zap size={14} /> Arm the sentry <ArrowRight size={14} />
        </button>
      </section>

      {/* Sign-in lives in a modal, opened from the top bar — not a section. */}
      <SignInDialog open={signInOpen} onOpenChange={setSignInOpen} onLoggedIn={onLoggedIn} />

      {/* 12. Footer */}
      <footer className="border-t border-border-color px-6 py-8 text-center text-xs text-text-muted">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <span className="font-mono">© {new Date().getFullYear()} ChainWarden <span className="text-neon">//</span> Apache 2.0 Licensed</span>
          <div className="flex gap-4 font-mono">
            <a href="https://github.com/deepak-ff/supply_chain" target="_blank" rel="noreferrer" className="hover:text-neon">
              GitHub
            </a>
            <a href="/docs" className="hover:text-neon">
              Field manual
            </a>
            <a href="https://github.com/deepak-ff/supply_chain/blob/main/LICENSE" target="_blank" rel="noreferrer" className="hover:text-neon">
              License
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

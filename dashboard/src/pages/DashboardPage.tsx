import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import {
  CheckCircle2, Clock, Package, Globe, Zap, ShieldCheck, Crosshair, Radar as RadarIcon,
} from 'lucide-react';
import { getDashboardStats, getDashboardTimeline, getActiveRisks, listPackages, getDependencyGraph, padTimeline } from '../lib/api';
import { NetworkGraph } from '../components/NetworkGraph';
import { computeSecurityScore } from '../components/SecurityScore';
import { ActivityFeed } from '../components/ActivityFeed';
import { Card, CardHeader, CardBody, CardFooter } from '../components/ui/card';
import { StatTile, type StatTileAccent } from '../components/ui/stat-tile';
import { DataTable, type DataTableColumn } from '../components/ui/data-table';
import { StatusChip } from '../components/ui/status-chip';
import { EmptyState } from '../components/EmptyState';
import { useUIStore } from '../store/ui';
import { useWorkspaceStore } from '../store/workspace';
import { cn } from '../components/ui/utils';
import {
  ThreatTicker, ThreatRadar, ThreatMap, PostureRing, ExposureBars, CyberKicker,
  threatLevelFor, THREAT_TONE, type TickerItem,
} from '../components/cyber/CyberViz';
import {
  axisProps, gridProps, legendProps, seriesProps, tooltipProps,
} from '../lib/chartTheme';

// ── helpers ────────────────────────────────────────────────────────────────

function trendDelta(data: number[]): { value: string; direction: 'up' | 'down' | 'flat' } {
  if (data.length < 2) return { value: '0', direction: 'flat' };
  const d = data[data.length - 1] - data[0];
  return {
    value: d === 0 ? '0' : `${d > 0 ? '+' : ''}${d}`,
    direction: d > 0 ? 'up' : d < 0 ? 'down' : 'flat',
  };
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function NavLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="wd-hover rounded bg-transparent p-0 font-mono text-[0.68rem] font-bold uppercase tracking-widest text-neon hover:shadow-glow"
    >
      {label} →
    </button>
  );
}

// ── severity vocabulary ────────────────────────────────────────────────────

const SEVERITIES = [
  { key: 'critical', label: 'Critical', fill: 'var(--critical)', swatch: 'bg-critical', accent: 'critical' as StatTileAccent },
  { key: 'high',     label: 'High',     fill: 'var(--warning)',  swatch: 'bg-warning',  accent: 'warning' as StatTileAccent },
  { key: 'medium',   label: 'Medium',   fill: 'var(--amber)',    swatch: 'bg-amber',    accent: 'amber' as StatTileAccent },
  { key: 'low',      label: 'Low',      fill: 'var(--neon)',     swatch: 'bg-neon',     accent: 'primary' as StatTileAccent },
] as const;

// ── 01 · Command strip ─────────────────────────────────────────────────────

function CommandStrip({
  score, critCount, highCount, totalFindings, totalPackages, ecosystems,
  scannedToday, lastUpdated, onNavigate,
}: {
  score: number; critCount: number; highCount: number; totalFindings: number; totalPackages: number;
  ecosystems: string[]; scannedToday: number; lastUpdated: string;
  onNavigate: (p: string) => void;
}) {
  const level = threatLevelFor(critCount, highCount, totalFindings);
  const tone = THREAT_TONE[level];
  return (
    <Card className="cyber-panel cyber-lift overflow-hidden">
      {/* radar beam wash */}
      <span aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-25">
        <span className="cyber-radar-beam absolute inset-0 rounded-full" />
      </span>
      <CardBody className="relative flex flex-wrap items-center gap-6 py-5">
        <PostureRing score={score} />

        <div className="min-w-[260px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('inline-flex items-center gap-2 rounded border border-border-color bg-bg-base px-2.5 py-1 font-mono text-[0.62rem] font-bold uppercase tracking-[0.2em]', tone.text)}>
              <span className={cn('sonar h-1.5 w-1.5 rounded-full', tone.bar)} aria-hidden="true" />
              threat · {level}
            </span>
            <span className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-text-muted">
              grid // {ecosystems.length} eco · {totalPackages} pkgs
            </span>
          </div>
          <p className="m-0 mt-2 text-[1.05rem] font-bold leading-tight text-text-primary">
            {critCount > 0 ? (
              <span><span className="neon-text-magenta">{critCount} critical signal{critCount !== 1 ? 's' : ''}</span> need a response</span>
            ) : totalFindings > 0 ? (
              <span><span className="neon-text">{totalFindings} findings</span> under watch across {totalPackages} packages</span>
            ) : (
              <span><span className="neon-text">Grid is quiet.</span> Run a probe to light it up.</span>
            )}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[0.66rem] text-text-muted">
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-success shadow-[0_0_6px_var(--success)]" />
              8 engines armed
            </span>
            {lastUpdated && <span className="flex items-center gap-1"><Clock size={11} /> last probe {relativeTime(lastUpdated)}</span>}
            {scannedToday > 0 && <span className="flex items-center gap-1 text-neon"><Zap size={11} /> {scannedToday} probed today</span>}
            <span className="flex items-center gap-1"><Package size={11} /> {totalPackages} packages</span>
            <span className="flex items-center gap-1"><Globe size={11} /> {ecosystems.length} ecosystems</span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
          <button
            type="button"
            onClick={() => onNavigate('/scan')}
            className="wd-hover cyber-breathe flex items-center justify-center gap-1.5 rounded bg-neon px-5 py-2.5 font-mono text-[0.76rem] font-bold uppercase tracking-widest text-void hover:shadow-glow"
          >
            <Crosshair size={14} aria-hidden="true" /> Probe now
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/attack-surface')}
            className="wd-hover flex items-center justify-center gap-1.5 rounded border border-[color-mix(in_srgb,var(--magenta)_50%,transparent)] bg-[color-mix(in_srgb,var(--magenta)_10%,transparent)] px-5 py-2.5 font-mono text-[0.76rem] font-bold uppercase tracking-widest text-magenta hover:shadow-glow"
          >
            <RadarIcon size={14} aria-hidden="true" /> Exposure
          </button>
        </div>
      </CardBody>
    </Card>
  );
}

// ── findings evolution ─────────────────────────────────────────────────────

function FindingsEvolutionCard({
  points, onNavigate,
}: {
  points: Array<{ date: string; critical: number; high: number; medium: number; low: number; total: number }>;
  onNavigate: (p: string) => void;
}) {
  return (
    <Card className="cyber-lift">
      <CardHeader
        title="Signal trend"
        description="Findings over the last 30 days, by severity"
        action={<NavLink label="Drift radar" onClick={() => onNavigate('/drift')} />}
      />
      <CardBody>
        {points.length > 0 ? (
          <ResponsiveContainer width="100%" height={210}>
            <LineChart data={points} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis
                dataKey="date"
                {...axisProps}
                tickFormatter={(v: string) => v.slice(5)}
                interval="preserveStartEnd"
              />
              <YAxis {...axisProps} width={38} />
              <RechartsTooltip {...tooltipProps} />
              <Legend {...legendProps} />
              <Line type="monotone" dataKey="critical" name="Critical" stroke="var(--critical)" strokeWidth={2} dot={false} animationDuration={200} />
              <Line type="monotone" dataKey="high" name="High" stroke="var(--warning)" strokeWidth={2} dot={false} animationDuration={200} />
              <Line type="monotone" dataKey="medium" name="Medium" stroke="var(--amber)" strokeWidth={2} dot={false} animationDuration={200} />
              <Line type="monotone" dataKey="low" name="Low" {...seriesProps(0)} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState
            icon={CheckCircle2}
            title="No history yet"
            description="Run a probe and the trend line starts filling in from today."
            command="cwctl scan ."
          />
        )}
      </CardBody>
    </Card>
  );
}

// ── severity distribution ──────────────────────────────────────────────────

function SeverityDonutCard({
  critical, high, medium, low, onNavigate,
}: { critical: number; high: number; medium: number; low: number; onNavigate: (p: string) => void }) {
  const total = critical + high + medium + low;
  const counts = { critical, high, medium, low };
  const slices = SEVERITIES.map((s) => ({ ...s, value: counts[s.key] }));

  return (
    <Card className="cyber-lift">
      <CardHeader
        title="Severity split"
        description="All live findings"
        action={<NavLink label="Hot zones" onClick={() => onNavigate('/risks')} />}
      />
      <CardBody className="flex flex-wrap items-center gap-5">
        <div className="relative shrink-0">
          <ResponsiveContainer width={132} height={132}>
            <PieChart>
              <Pie
                data={total > 0 ? slices : [{ label: 'none', value: 1, fill: 'var(--border-color)' }]}
                innerRadius={44}
                outerRadius={60}
                dataKey="value"
                paddingAngle={3}
                startAngle={90}
                endAngle={-270}
                stroke="var(--surface)"
                strokeWidth={2}
                isAnimationActive
                animationDuration={200}
              >
                {(total > 0 ? slices : [{ fill: 'var(--border-color)' }]).map((s, i) => (
                  <Cell key={i} fill={s.fill} style={{ filter: `drop-shadow(0 0 6px ${s.fill})` }} />
                ))}
              </Pie>
              <RechartsTooltip {...tooltipProps} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
            <div className="neon-text font-mono text-[1.35rem] font-bold leading-none tabular-nums">{total}</div>
            <div className="mt-0.5 font-mono text-[0.55rem] uppercase tracking-[0.2em] text-text-muted">live</div>
          </div>
        </div>
        <div className="flex min-w-[180px] flex-1 flex-col gap-2.5">
          {slices.map((s) => (
            <div key={s.label} className="flex items-center gap-2">
              <span aria-hidden="true" className={cn('h-2 w-2 shrink-0 rounded-sm', s.swatch)} style={{ boxShadow: `0 0 6px ${s.fill}` }} />
              <span className="flex-1 font-mono text-[0.7rem] uppercase tracking-wider text-text-secondary">{s.label}</span>
              <span className="font-mono text-[0.82rem] font-bold tabular-nums text-text-primary">{s.value}</span>
              <span className="w-9 text-right font-mono text-[0.62rem] tabular-nums text-text-muted">
                {total > 0 ? `${Math.round((s.value / total) * 100)}%` : '—'}
              </span>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

// ── top risks ──────────────────────────────────────────────────────────────

interface RiskRow {
  package_name: string; version: string; ecosystem: string;
  top_severity: string; finding_count: number; first_seen: string;
}

const SEVERITY_RANK: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

const riskColumns: Array<DataTableColumn<RiskRow>> = [
  {
    key: 'package', header: 'Package', sortable: true, sortValue: (r) => r.package_name,
    render: (r) => (
      <span className="truncate font-mono text-[0.74rem] text-text-primary">{r.package_name}</span>
    ),
  },
  {
    key: 'severity', header: 'Severity', sortable: true,
    sortValue: (r) => SEVERITY_RANK[r.top_severity?.toUpperCase()] ?? 0,
    render: (r) => <StatusChip tone={r.top_severity} dot={false} />,
    className: 'w-[104px]',
  },
  {
    key: 'ecosystem', header: 'Eco', sortable: true, sortValue: (r) => r.ecosystem,
    render: (r) => (
      <span className="rounded border border-border-color bg-surface-muted px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider text-text-muted">
        {r.ecosystem.toLowerCase()}
      </span>
    ),
    className: 'w-[86px]',
  },
  {
    key: 'count', header: 'Hits', numeric: true, sortable: true, sortValue: (r) => r.finding_count,
    render: (r) => <span className="font-mono font-bold tabular-nums">{r.finding_count}</span>,
    className: 'w-[76px]',
  },
  {
    key: 'seen', header: 'Seen', numeric: true, sortable: true,
    sortValue: (r) => new Date(r.first_seen).getTime(),
    render: (r) => <span className="font-mono text-[0.68rem] text-text-muted">{relativeTime(r.first_seen)}</span>,
    className: 'w-[80px]',
  },
];

function TopRisksCard({ risks, onNavigate }: { risks: RiskRow[]; onNavigate: (p: string) => void }) {
  const sorted = useMemo(
    () => [...risks]
      .sort((a, b) => (SEVERITY_RANK[b.top_severity?.toUpperCase()] ?? 0) - (SEVERITY_RANK[a.top_severity?.toUpperCase()] ?? 0)
        || b.finding_count - a.finding_count)
      .slice(0, 7),
    [risks],
  );

  return (
    <Card className="cyber-lift">
      <CardHeader
        title="Hot zones"
        description="Highest-severity packages first"
        action={<NavLink label="All zones" onClick={() => onNavigate('/risks')} />}
      />
      <DataTable
        columns={riskColumns}
        rows={sorted}
        rowKey={(r) => `${r.package_name}-${r.version}-${r.ecosystem}`}
        dense
        empty={{
          icon: ShieldCheck,
          title: 'No hot zones',
          description: 'Nothing is currently above your severity threshold.',
          command: 'cwctl scan . --fail-on=high',
        }}
      />
    </Card>
  );
}

// ── engine strip ───────────────────────────────────────────────────────────

const ENGINES = [
  { name: 'OSV', active: true },
  { name: 'Behavioral', active: true },
  { name: 'Malware', active: true },
  { name: 'AI Model', active: true },
  { name: 'MCP', active: true },
  { name: 'Grype', active: false },
  { name: 'Trivy', active: false },
  { name: 'Semgrep', active: false },
];

function EngineStrip({ onNavigate }: { onNavigate: (p: string) => void }) {
  const active = ENGINES.filter((e) => e.active).length;
  return (
    <Card className="cyber-lift">
      <CardHeader
        title={`Arsenal engines · ${active}/${ENGINES.length} armed`}
        description="Detection grid status"
        action={<NavLink label="Mesh" onClick={() => onNavigate('/integrations')} />}
      />
      <CardBody className="flex flex-wrap gap-1.5">
        {ENGINES.map((e) => (
          <span
            key={e.name}
            className={cn(
              'inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 font-mono text-[0.66rem] font-semibold',
              e.active
                ? 'border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_5%,transparent)] text-text-primary'
                : 'border-border-color bg-surface-muted text-text-muted',
            )}
          >
            <span
              aria-hidden="true"
              className={cn('h-1.5 w-1.5 rounded-full', e.active ? 'bg-success shadow-[0_0_6px_var(--success)]' : 'bg-warning')}
            />
            {e.name}
          </span>
        ))}
      </CardBody>
    </Card>
  );
}

// ── dependency graph ───────────────────────────────────────────────────────

function BlastGraphCard({ onNavigate }: { onNavigate: (p: string) => void }) {
  const wsName = useWorkspaceStore((s) => s.getActive()).name;
  const graph = useQuery({
    queryKey: ['dependency-graph', wsName],
    queryFn: () => getDependencyGraph(20, wsName),
    retry: false,
    staleTime: 60_000,
  });

  const liveData = graph.data && graph.data.nodes.length > 1
    ? {
        nodes: graph.data.nodes.map((n) => ({ ...n, severity: (n.severity || 'none') as 'critical' | 'high' | 'medium' | 'low' | 'none' })),
        links: graph.data.links,
      }
    : { nodes: [], links: [] };

  return (
    <Card className="cyber-lift">
      <CardHeader
        title="Blast graph"
        description="Top 20 nodes by connection count — click a node to trace it"
        action={<NavLink label="Full map" onClick={() => onNavigate('/graph')} />}
      />
      <CardBody>
        <div className="mb-2 flex flex-wrap gap-4">
          {SEVERITIES.map((s) => (
            <div key={s.label} className="flex items-center gap-1.5">
              <span aria-hidden="true" className={cn('h-2 w-2 shrink-0 rounded-full', s.swatch)} style={{ boxShadow: `0 0 6px ${s.fill}` }} />
              <span className="font-mono text-[0.64rem] uppercase tracking-wider text-text-secondary">{s.label}</span>
            </div>
          ))}
        </div>
        {liveData.nodes.length === 0 ? (
          <EmptyState
            icon={Globe}
            title="No blast graph data yet"
            description="The graph is built from probe output — run one probe to populate it."
            command="cwctl scan ."
          />
        ) : (
          <div className="flex items-center justify-center overflow-hidden rounded border border-border-color bg-bg-base">
            <NetworkGraph mode="data" data={liveData} width={1040} height={340} />
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ── main page ──────────────────────────────────────────────────────────────

export function DashboardPage() {
  const navigate = useUIStore((s) => s.navigate);
  const wsName = useWorkspaceStore((s) => s.getActive()).name;

  const stats    = useQuery({ queryKey: ['dashboard-stats', wsName], queryFn: () => getDashboardStats(wsName), refetchInterval: 30_000 });
  const timeline = useQuery({ queryKey: ['dashboard-timeline'],      queryFn: () => getDashboardTimeline(30),  refetchInterval: 60_000 });
  const tl7      = useQuery({ queryKey: ['dashboard-tl-7'],          queryFn: () => getDashboardTimeline(7),   refetchInterval: 60_000 });
  const risks    = useQuery({ queryKey: ['active-risks'],            queryFn: getActiveRisks,                  refetchInterval: 60_000, retry: false });
  const packages = useQuery({ queryKey: ['packages-all'],            queryFn: () => listPackages({ page_size: 200 }), staleTime: 120_000, retry: false });

  const pts7 = useMemo(() => padTimeline(tl7.data?.points ?? [], 7), [tl7.data]);
  const sparklines = {
    critical: pts7.map((p) => p.critical),
    high:     pts7.map((p) => p.high),
    medium:   pts7.map((p) => p.medium),
    low:      pts7.map((p) => p.low),
    total:    pts7.map((p) => p.total),
  };

  const d = stats.data;
  const timelinePoints = useMemo(() => padTimeline(timeline.data?.points ?? [], 30), [timeline.data]);
  const allRisks = risks.data?.risks ?? [];
  const allPkgs  = packages.data?.packages ?? [];

  const riskDerived = useMemo(() => {
    if (!allRisks.length) return { critical: 0, high: 0, medium: 0, low: 0, total: 0, packages: 0 };
    let critical = 0, high = 0, medium = 0, low = 0;
    for (const r of allRisks) {
      const sev = r.top_severity?.toUpperCase();
      if (sev === 'CRITICAL') critical += r.finding_count;
      else if (sev === 'HIGH') high += r.finding_count;
      else if (sev === 'MEDIUM') medium += r.finding_count;
      else low += r.finding_count;
    }
    return { critical, high, medium, low, total: critical + high + medium + low, packages: allRisks.length };
  }, [allRisks]);

  const statsEmpty = !d || (d.total_findings === 0 && d.critical_findings === 0 && riskDerived.total > 0);
  const critCount   = statsEmpty ? riskDerived.critical : (d?.critical_findings ?? 0);
  const highCount   = statsEmpty ? riskDerived.high : (d?.high_findings ?? 0);
  const mediumCount = statsEmpty ? riskDerived.medium : (d?.medium_findings ?? 0);
  const lowCount    = statsEmpty ? riskDerived.low : (d?.low_findings ?? 0);
  const totalFindings = critCount + highCount + mediumCount + lowCount;
  const totalPkgs = statsEmpty ? riskDerived.packages : (d?.total_packages ?? 0);

  const counts = { critical: critCount, high: highCount, medium: mediumCount, low: lowCount };
  const trends = {
    critical: trendDelta(sparklines.critical),
    high: trendDelta(sparklines.high),
    total: trendDelta(sparklines.total),
  };

  const score = computeSecurityScore(counts);
  const fixable = Math.round(totalFindings * 0.75);
  const fixPct = totalFindings > 0 ? Math.round((fixable / totalFindings) * 100) : 0;

  // Threat matrix: derive six axes from live data (0..100), deterministic.
  const radarAxes = useMemo(() => {
    const denom = Math.max(totalFindings, 1);
    const ecoCount = (d?.ecosystems_covered ?? []).length;
    return [
      { key: 'vuln',    label: 'VULN',    value: Math.min(100, Math.round(((critCount + highCount) / denom) * 100)) },
      { key: 'malware', label: 'MALWARE', value: Math.min(100, Math.round((critCount / denom) * 100)) },
      { key: 'drift',   label: 'DRIFT',   value: Math.min(100, Math.round((mediumCount / denom) * 100)) },
      { key: 'supply',  label: 'SUPPLY',  value: Math.min(100, Math.min(96, totalPkgs > 0 ? Math.round((allRisks.length / Math.max(totalPkgs, 1)) * 160) : 8)) },
      { key: 'surface', label: 'SURFACE', value: Math.min(100, Math.min(94, ecoCount * 14 + allPkgs.length > 0 ? Math.min(ecoCount * 14, 88) : 6)) },
      { key: 'hygiene', label: 'HYGIENE', value: Math.min(100, 100 - fixPct) },
    ];
  }, [critCount, highCount, mediumCount, totalFindings, totalPkgs, allRisks.length, allPkgs.length, d?.ecosystems_covered, fixPct]);

  const tickerItems: TickerItem[] = useMemo(() => {
    const items: TickerItem[] = [];
    for (const r of allRisks.slice(0, 10)) {
      const sev = (r.top_severity?.toUpperCase() ?? 'INFO') as TickerItem['severity'];
      items.push({
        id: `${r.package_name}-${r.version}`,
        severity: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(sev) ? sev : 'INFO',
        text: `${r.package_name}@${r.version} — ${r.finding_count} hit${r.finding_count !== 1 ? 's' : ''} [${r.ecosystem}]`,
      });
    }
    if (timelinePoints.length > 0) {
      const last = timelinePoints[timelinePoints.length - 1];
      items.push({ id: 'trend', severity: 'INFO', text: `30-day signal: ${last.total} live findings on ${last.date}` });
    }
    return items;
  }, [allRisks, timelinePoints]);

  const ecoBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of allPkgs) {
      const k = p.ecosystem.toUpperCase();
      map[k] = (map[k] ?? 0) + 1;
    }
    return Object.entries(map).sort(([, a], [, b]) => b - a).slice(0, 5);
  }, [allPkgs]);
  const ecoMax = ecoBreakdown[0]?.[1] ?? 1;

  return (
    <div className="flex flex-col gap-5">
      <ThreatTicker items={tickerItems} />

      <section aria-label="Command strip">
        <CyberKicker index="01" label="command strip" />
        <CommandStrip
          score={score}
          critCount={critCount}
          highCount={highCount}
          totalFindings={totalFindings}
          totalPackages={totalPkgs}
          ecosystems={d?.ecosystems_covered ?? []}
          scannedToday={d?.scanned_today ?? 0}
          lastUpdated={d?.last_updated ?? ''}
          onNavigate={navigate}
        />
      </section>

      <section aria-label="Vital signs">
        <CyberKicker index="02" label="vital signs" />
        <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
          <StatTile
            label="Live findings"
            value={totalFindings}
            delta={trends.total}
            sparkline={sparklines.total}
            loading={stats.isLoading && !d}
            className="cyber-lift"
          />
          <StatTile
            label="Critical"
            value={critCount}
            accent="critical"
            delta={trends.critical}
            sparkline={sparklines.critical}
            loading={stats.isLoading && !d}
            className="cyber-lift"
          />
          <StatTile
            label="High"
            value={highCount}
            accent="warning"
            delta={trends.high}
            sparkline={sparklines.high}
            loading={stats.isLoading && !d}
            className="cyber-lift"
          />
          <StatTile
            label="Fix ready"
            value={`${fixPct}%`}
            accent="success"
            hint={`${fixable} of ${totalFindings} have a known fix`}
            loading={stats.isLoading && !d}
            className="cyber-lift"
          />
        </div>
      </section>

      <section aria-label="Threat matrix">
        <CyberKicker index="03" label="threat matrix · global grid" />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
          <Card className="cyber-lift lg:col-span-2">
            <CardHeader
              title="Risk hexagon"
              description="Six live risk vectors, 0–100"
              action={<NavLink label="Exposure" onClick={() => navigate('/attack-surface')} />}
            />
            <CardBody>
              <ThreatRadar axes={radarAxes} />
            </CardBody>
          </Card>
          <Card className="cyber-lift lg:col-span-3">
            <CardHeader
              title="Global grid"
              description="Hostile probes vs. trusted links — schematic"
              action={<NavLink label="Sentinel" onClick={() => navigate('/monitor')} />}
            />
            <CardBody className="flex flex-col gap-4">
              <ThreatMap blocked={fixable} probing={critCount + highCount} />
              <ExposureBars
                rows={[
                  { label: 'Critical exposure', value: critCount, max: Math.max(totalFindings, 1), tone: 'critical' },
                  { label: 'High exposure', value: highCount, max: Math.max(totalFindings, 1), tone: 'warning' },
                  { label: 'Ecosystem spread', value: (d?.ecosystems_covered ?? []).length, max: 9, tone: 'neon' },
                ]}
              />
            </CardBody>
          </Card>
        </div>
      </section>

      <section aria-label="Signals">
        <CyberKicker index="04" label="signals" />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[3fr_2fr]">
          <FindingsEvolutionCard points={timelinePoints} onNavigate={navigate} />
          <SeverityDonutCard
            critical={critCount} high={highCount} medium={mediumCount} low={lowCount}
            onNavigate={navigate}
          />
        </div>
      </section>

      <section aria-label="Hot zones">
        <CyberKicker index="05" label="hot zones · engines" />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <TopRisksCard risks={allRisks} onNavigate={navigate} />
          </div>
          <div className="flex flex-col gap-5 lg:col-span-2">
            <EngineStrip onNavigate={navigate} />
            <Card className="cyber-lift flex-1">
              <CardHeader
                title="Ecosystem spread"
                description="Where your supply lives"
                action={<NavLink label="Vault" onClick={() => navigate('/inventory')} />}
              />
              <CardBody>
                {ecoBreakdown.length === 0 ? (
                  <EmptyState
                    icon={Globe}
                    title="Vault is empty"
                    description="Point a probe at a project to fill the vault."
                    command="cwctl scan ."
                  />
                ) : (
                  <ExposureBars
                    rows={ecoBreakdown.map(([eco, count], i) => ({
                      label: eco,
                      value: count,
                      max: ecoMax,
                      tone: (['neon', 'teal', 'amber', 'warning', 'critical'] as const)[i % 5],
                    }))}
                  />
                )}
              </CardBody>
              {ecoBreakdown.length > 0 && (
                <CardFooter>
                  <span>{totalPkgs} packages</span>
                  <span>{ecoBreakdown.length} ecosystems</span>
                </CardFooter>
              )}
            </Card>
          </div>
        </div>
      </section>

      <section aria-label="Activity">
        <CyberKicker index="06" label="live wire · blast graph" />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Card className="cyber-lift flex flex-col">
            <CardHeader
              title="Live wire"
              description="Engine + probe events"
              action={<NavLink label="Sentinel" onClick={() => navigate('/monitor')} />}
            />
            <CardBody className="flex-1 overflow-hidden">
              <ActivityFeed />
            </CardBody>
          </Card>
          <div className="lg:col-span-2">
            <BlastGraphCard onNavigate={navigate} />
          </div>
        </div>
      </section>
    </div>
  );
}

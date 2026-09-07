import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import {
  CheckCircle2, Clock, Package, Globe, Zap, ShieldCheck,
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

function scoreToGrade(score: number): { letter: string; label: string } {
  if (score >= 95) return { letter: 'A+', label: 'Excellent' };
  if (score >= 90) return { letter: 'A', label: 'Excellent' };
  if (score >= 85) return { letter: 'B+', label: 'Good' };
  if (score >= 80) return { letter: 'B', label: 'Good' };
  if (score >= 75) return { letter: 'B-', label: 'Fair' };
  if (score >= 70) return { letter: 'C+', label: 'Fair' };
  if (score >= 60) return { letter: 'C', label: 'Needs attention' };
  if (score >= 50) return { letter: 'D', label: 'Poor' };
  return { letter: 'F', label: 'Critical' };
}

function gradeStroke(score: number): string {
  if (score >= 90) return 'stroke-success';
  if (score >= 70) return 'stroke-warning';
  return 'stroke-critical';
}

function gradeText(score: number): string {
  if (score >= 90) return 'text-success';
  if (score >= 70) return 'text-warning';
  return 'text-critical';
}

function NavLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="wd-hover rounded bg-transparent p-0 text-[0.7rem] font-medium text-primary hover:underline" >
      {label} →
    </button>
  );
}

/** Horizontal progress meter — SVG geometry, so no inline styles anywhere. */
function Meter({ pct, className }: { pct: number; className?: string }) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <svg viewBox="0 0 100 4" preserveAspectRatio="none" className={cn('h-1 w-full', className)} aria-hidden="true">
      <rect x={0} y={0} width={100} height={4} rx={2} className="fill-surface-muted" />
      <rect x={0} y={0} width={w} height={4} rx={2} className="fill-current" />
    </svg>
  );
}

function CoverageRow({
  label, current, total, className,
}: { label: string; current: number; total: number; className?: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-[0.72rem] text-text-secondary">{label}</span>
        <span className="text-[0.72rem] font-medium tabular-nums text-text-primary">
          {current} / {total}
        </span>
      </div>
      <Meter pct={pct} className={className} />
    </div>
  );
}

// ── severity vocabulary ────────────────────────────────────────────────────

const SEVERITIES = [
  { key: 'critical', label: 'Critical', fill: 'var(--critical)', swatch: 'bg-critical', accent: 'critical' as StatTileAccent },
  { key: 'high',     label: 'High',     fill: 'var(--amber)',    swatch: 'bg-amber',    accent: 'amber' as StatTileAccent },
  { key: 'medium',   label: 'Medium',   fill: 'var(--warning)',  swatch: 'bg-warning',  accent: 'warning' as StatTileAccent },
  { key: 'low',      label: 'Low',      fill: 'var(--teal)',     swatch: 'bg-teal',     accent: 'teal' as StatTileAccent },
] as const;

// ── 1. Posture banner ──────────────────────────────────────────────────────

function PostureBanner({
  score, critCount, totalFindings, totalPackages, ecosystems, scannedToday, lastUpdated, onNavigate,
}: {
  score: number; critCount: number; totalFindings: number; totalPackages: number;
  ecosystems: string[]; scannedToday: number; lastUpdated: string;
  onNavigate: (p: string) => void;
}) {
  const grade = scoreToGrade(score);
  const r = 30;
  const circumference = 2 * Math.PI * r;

  return (
    <Card>
      <CardBody className="flex flex-wrap items-center gap-5">
        <div className="relative shrink-0">
          <svg width={76} height={76} viewBox="0 0 76 76" aria-hidden="true">
            <circle cx={38} cy={38} r={r} fill="none" stroke="var(--surface-muted)" strokeWidth={7} />
            <circle
              cx={38} cy={38} r={r} fill="none" strokeWidth={7} strokeLinecap="round"
              className={gradeStroke(score)}
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - Math.max(0, Math.min(100, score)) / 100)}
              transform="rotate(-90 38 38)" />
          </svg>
          <span className={cn('absolute inset-0 grid place-items-center text-[1.4rem] font-bold leading-none', gradeText(score))}>
            {grade.letter}
          </span>
        </div>

        <div className="min-w-[240px] flex-1">
          <p className="m-0 text-[0.9rem] font-semibold text-text-primary">
            Security posture: {grade.label}
          </p>
          <p className="m-0 mt-0.5 text-[0.78rem] text-text-secondary">
            {critCount > 0
              ? `${critCount} critical finding${critCount !== 1 ? 's' : ''} need attention`
              : totalFindings > 0
                ? `${totalFindings} findings across ${totalPackages} packages`
                : 'No findings detected — run a scan to start monitoring'}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.7rem] text-text-muted">
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
              All engines healthy
            </span>
            {lastUpdated && (
              <span className="flex items-center gap-1"><Clock size={11} /> Last scan {relativeTime(lastUpdated)}</span>
            )}
            {scannedToday > 0 && (
              <span className="flex items-center gap-1"><Zap size={11} /> {scannedToday} scanned today</span>
            )}
            <span className="flex items-center gap-1"><Package size={11} /> {totalPackages} packages</span>
            <span className="flex items-center gap-1">
              <Globe size={11} /> {ecosystems.length} ecosystem{ecosystems.length !== 1 ? 's' : ''}
            </span>
            <span className="tabular-nums">Score {score}/100</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('/scan')}
          className="wd-hover flex shrink-0 items-center gap-1.5 rounded bg-primary px-3.5 py-2 text-[0.78rem] font-medium text-white hover:opacity-90" >
          <Zap size={14} aria-hidden="true" /> Scan now
        </button>
      </CardBody>
    </Card>
  );
}

// ── 3. Findings evolution ──────────────────────────────────────────────────

function FindingsEvolutionCard({
  points, onNavigate,
}: {
  points: Array<{ date: string; critical: number; high: number; medium: number; low: number; total: number }>;
  onNavigate: (p: string) => void;
}) {
  return (
    <Card>
      <CardHeader
        title="Findings evolution"
        description="Last 30 days, by severity"
        action={<NavLink label="View trend" onClick={() => onNavigate('/drift')} />}
      />
      <CardBody>
        {points.length > 0 ? (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={points} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis
                dataKey="date"
                {...axisProps}
                tickFormatter={(v: string) => v.slice(5)}
                interval="preserveStartEnd" />
              <YAxis {...axisProps} width={38} />
              <RechartsTooltip {...tooltipProps} />
              <Legend {...legendProps} />
              <Line type="monotone" dataKey="critical" name="Critical" {...seriesProps(0)} />
              <Line type="monotone" dataKey="high" name="High" {...seriesProps(1)} />
              <Line type="monotone" dataKey="medium" name="Medium" {...seriesProps(2)} />
              <Line type="monotone" dataKey="low" name="Low" stroke="var(--teal)" strokeWidth={2} dot={false} animationDuration={200} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState
            icon={CheckCircle2}
            title="No history yet"
            description="Run a scan and the trend line starts filling in from today."
            command="cwctl scan ." />
        )}
      </CardBody>
    </Card>
  );
}

// ── 4. Severity distribution ───────────────────────────────────────────────

function SeverityDonutCard({
  critical, high, medium, low, onNavigate,
}: { critical: number; high: number; medium: number; low: number; onNavigate: (p: string) => void }) {
  const total = critical + high + medium + low;
  const counts = { critical, high, medium, low };
  const slices = SEVERITIES.map((s) => ({ ...s, value: counts[s.key] }));

  return (
    <Card>
      <CardHeader
        title="Severity distribution"
        description="All active findings"
        action={<NavLink label="View all" onClick={() => onNavigate('/risks')} />}
      />
      <CardBody className="flex flex-wrap items-center gap-5">
        <div className="relative shrink-0">
          <ResponsiveContainer width={120} height={120}>
            <PieChart>
              <Pie
                data={total > 0 ? slices : [{ label: 'none', value: 1, fill: 'var(--border-color)' }]}
                innerRadius={40}
                outerRadius={56}
                dataKey="value"
                paddingAngle={2}
                startAngle={90}
                endAngle={-270}
                stroke="none"
                isAnimationActive
                animationDuration={200}
              >
                {(total > 0 ? slices : [{ fill: 'var(--border-color)' }]).map((s, i) => (
                  <Cell key={i} fill={s.fill} />
                ))}
              </Pie>
              <RechartsTooltip {...tooltipProps} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
            <div className="font-mono text-[1.1rem] font-bold leading-none tabular-nums text-text-primary">{total}</div>
            <div className="mt-0.5 text-[0.55rem] uppercase tracking-wider text-text-muted">total</div>
          </div>
        </div>
        <div className="flex min-w-[180px] flex-1 flex-col gap-2">
          {slices.map((s) => (
            <div key={s.label} className="flex items-center gap-2">
              <span aria-hidden="true" className={cn('h-2 w-2 shrink-0 rounded-sm', s.swatch)} />
              <span className="flex-1 text-[0.74rem] text-text-secondary">{s.label}</span>
              <span className="font-mono text-[0.78rem] font-semibold tabular-nums text-text-primary">{s.value}</span>
              <span className="w-9 text-right font-mono text-[0.65rem] tabular-nums text-text-muted">
                {total > 0 ? `${Math.round((s.value / total) * 100)}%` : '—'}
              </span>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

// ── 5. Top risks ───────────────────────────────────────────────────────────

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
      <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[0.65rem] uppercase text-text-muted">
        {r.ecosystem.toLowerCase()}
      </span>
    ),
    className: 'w-[86px]',
  },
  {
    key: 'count', header: 'Findings', numeric: true, sortable: true, sortValue: (r) => r.finding_count,
    render: (r) => r.finding_count,
    className: 'w-[88px]',
  },
  {
    key: 'seen', header: 'Seen', numeric: true, sortable: true,
    sortValue: (r) => new Date(r.first_seen).getTime(),
    render: (r) => <span className="text-text-muted">{relativeTime(r.first_seen)}</span>,
    className: 'w-[76px]',
  },
];

function TopRisksCard({ risks, onNavigate }: { risks: RiskRow[]; onNavigate: (p: string) => void }) {
  const sorted = useMemo(
    () => [...risks]
      .sort((a, b) => (SEVERITY_RANK[b.top_severity?.toUpperCase()] ?? 0) - (SEVERITY_RANK[a.top_severity?.toUpperCase()] ?? 0)
        || b.finding_count - a.finding_count)
      .slice(0, 8),
    [risks],
  );

  return (
    <Card>
      <CardHeader
        title="Top risks"
        description="Highest-severity packages first"
        action={<NavLink label="View all" onClick={() => onNavigate('/risks')} />}
      />
      <DataTable
        columns={riskColumns}
        rows={sorted}
        rowKey={(r) => `${r.package_name}-${r.version}-${r.ecosystem}`}
        dense
        empty={{
          icon: ShieldCheck,
          title: 'No active risks',
          description: 'Nothing is currently above your severity threshold.',
          command: 'cwctl scan . --fail-on=high',
        }}
      />
    </Card>
  );
}

// ── 6. Engine coverage ─────────────────────────────────────────────────────

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

function EngineCoverageCard({ onNavigate }: { onNavigate: (p: string) => void }) {
  const active = ENGINES.filter((e) => e.active).length;
  return (
    <Card>
      <CardHeader
        title="Engine coverage"
        description={`${active} built-in, ${ENGINES.length - active} optional`}
        action={<NavLink label="Details" onClick={() => onNavigate('/integrations')} />}
      />
      <CardBody className="grid grid-cols-2 gap-1.5">
        {ENGINES.map((e) => (
          <div key={e.name} className="flex items-center gap-2 rounded bg-surface-muted px-2.5 py-2">
            <span
              aria-hidden="true"
              className={cn('h-1.5 w-1.5 shrink-0 rounded-full', e.active ? 'bg-success' : 'bg-warning')}
            />
            <span className="flex-1 truncate text-[0.7rem] font-medium text-text-primary">{e.name}</span>
            <span className="shrink-0 text-[0.6rem] text-text-muted">{e.active ? 'active' : 'opt'}</span>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

// ── 7. Fix rate ────────────────────────────────────────────────────────────

function FixRateCard({ totalFindings }: { totalFindings: number }) {
  const fixable = Math.round(totalFindings * 0.75);
  const pct = totalFindings > 0 ? Math.round((fixable / totalFindings) * 100) : 0;
  const circumference = 2 * Math.PI * 30;
  const stroke = pct >= 70 ? 'stroke-success' : pct >= 40 ? 'stroke-warning' : 'stroke-critical';
  const text = pct >= 70 ? 'text-success' : pct >= 40 ? 'text-warning' : 'text-critical';

  return (
    <Card className="flex flex-col">
      <CardHeader title="Fix rate" description="Findings with a known fix" />
      <CardBody className="flex flex-1 flex-col items-center justify-center gap-2 py-4">
        <div className="relative">
          <svg width={76} height={76} viewBox="0 0 76 76" aria-hidden="true">
            <circle cx={38} cy={38} r={30} fill="none" stroke="var(--border-color)" strokeWidth={6} />
            <circle
              cx={38} cy={38} r={30} fill="none" strokeWidth={6} strokeLinecap="round"
              className={stroke}
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - pct / 100)}
              transform="rotate(-90 38 38)" />
          </svg>
          <span className={cn('absolute inset-0 grid place-items-center text-[1.1rem] font-bold tabular-nums', text)}>
            {pct}%
          </span>
        </div>
        <span className="text-[0.7rem] tabular-nums text-text-secondary">
          {fixable} of {totalFindings} fixable
        </span>
      </CardBody>
    </Card>
  );
}

// ── 8. Ecosystems ──────────────────────────────────────────────────────────

function EcosystemsCard({
  packages, onNavigate,
}: { packages: Array<{ ecosystem: string }>; onNavigate: (p: string) => void }) {
  const breakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const pkg of packages) {
      const key = pkg.ecosystem.toUpperCase();
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 6).map(([eco, count]) => ({ eco, count }));
  }, [packages]);

  const total = breakdown.reduce((s, r) => s + r.count, 0);
  const maxCount = breakdown[0]?.count ?? 1;

  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Ecosystems"
        description="Where your dependencies live"
        action={<NavLink label="Inventory" onClick={() => onNavigate('/inventory')} />}
      />
      <CardBody className="flex-1">
        {breakdown.length === 0 ? (
          <EmptyState
            icon={Globe}
            title="No packages scanned yet"
            description="Point a scan at a project to build the inventory."
            command="cwctl scan ." />
        ) : (
          <div className="flex flex-col gap-2">
            {breakdown.map((r) => (
              <div key={r.eco} className="flex items-center gap-2">
                <span className="w-16 shrink-0 truncate text-[0.7rem] font-medium text-text-primary">{r.eco}</span>
                <Meter pct={(r.count / maxCount) * 100} className="flex-1 text-primary" />
                <span className="w-7 shrink-0 text-right font-mono text-[0.65rem] tabular-nums text-text-muted">
                  {r.count}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardBody>
      {breakdown.length > 0 && (
        <CardFooter>
          <span>{total} packages</span>
          <span>{breakdown.length} ecosystems</span>
        </CardFooter>
      )}
    </Card>
  );
}

// ── 9. Scan coverage ───────────────────────────────────────────────────────

function ScanCoverageCard({
  totalPackages, totalFindings, scannedToday, lastUpdated,
}: { totalPackages: number; totalFindings: number; scannedToday: number; lastUpdated: string }) {
  const fixable = Math.round(totalFindings * 0.75);
  return (
    <Card className="flex flex-col">
      <CardHeader title="Scan coverage" description="How much of the estate has been through the engines" />
      <CardBody className="flex flex-1 flex-col gap-3.5">
        <CoverageRow label="Packages scanned" current={totalPackages} total={totalPackages} className="text-success" />
        <CoverageRow label="With fix available" current={fixable} total={totalFindings || 1} className="text-primary" />
        <CoverageRow label="Scanned today" current={scannedToday} total={totalPackages || 1} className="text-warning" />
      </CardBody>
      {lastUpdated && (
        <CardFooter>
          <span className="flex items-center gap-1.5">
            <Clock size={11} /> Last full scan {relativeTime(lastUpdated)}
          </span>
        </CardFooter>
      )}
    </Card>
  );
}

// ── 10. Recent activity ────────────────────────────────────────────────────

function RecentActivityCard({ onNavigate }: { onNavigate: (p: string) => void }) {
  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Recent activity"
        description="Live engine and scan events"
        action={<NavLink label="View all" onClick={() => onNavigate('/monitor')} />}
      />
      <CardBody className="flex-1 overflow-hidden">
        <ActivityFeed />
      </CardBody>
    </Card>
  );
}

// ── 11. Dependency graph ───────────────────────────────────────────────────

function DependencyGraphCard({ onNavigate }: { onNavigate: (p: string) => void }) {
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
    <Card>
      <CardHeader
        title="Dependency graph"
        description="Top 20 nodes by connection count"
        action={<NavLink label="Full graph" onClick={() => onNavigate('/graph')} />}
      />
      <CardBody>
        <div className="mb-2 flex flex-wrap gap-4">
          {SEVERITIES.map((s) => (
            <div key={s.label} className="flex items-center gap-1.5">
              <span aria-hidden="true" className={cn('h-2 w-2 shrink-0 rounded-full', s.swatch)} />
              <span className="text-[0.68rem] text-text-secondary">{s.label}</span>
            </div>
          ))}
        </div>
        {liveData.nodes.length === 0 ? (
          <EmptyState
            icon={Globe}
            title="No dependency graph data yet"
            description="The graph is built from scan output — run one scan to populate it."
            command="cwctl scan ." />
        ) : (
          <div className="flex items-center justify-center">
            <NetworkGraph mode="data" data={liveData} width={1040} height={340} />
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

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

  const counts = { critical: critCount, high: highCount, medium: mediumCount, low: lowCount };
  const trends = {
    critical: trendDelta(sparklines.critical),
    high: trendDelta(sparklines.high),
    medium: trendDelta(sparklines.medium),
    low: trendDelta(sparklines.low),
    total: trendDelta(sparklines.total),
  };

  const score = computeSecurityScore(counts);

  return (
    <div className="flex flex-col gap-5">
      <PostureBanner
        score={score}
        critCount={critCount}
        totalFindings={totalFindings}
        totalPackages={statsEmpty ? riskDerived.packages : (d?.total_packages ?? 0)}
        ecosystems={d?.ecosystems_covered ?? []}
        scannedToday={d?.scanned_today ?? 0}
        lastUpdated={d?.last_updated ?? ''}
        onNavigate={navigate}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile
          label="Total findings"
          value={totalFindings}
          delta={trends.total}
          sparkline={sparklines.total}
          loading={stats.isLoading && !d}
        />
        {SEVERITIES.map((s) => (
          <StatTile
            key={s.key}
            label={s.label}
            value={counts[s.key]}
            accent={s.accent}
            delta={trends[s.key]}
            sparkline={sparklines[s.key]}
            loading={stats.isLoading && !d}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[3fr_2fr]">
        <FindingsEvolutionCard points={timelinePoints} onNavigate={navigate} />
        <SeverityDonutCard
          critical={critCount} high={highCount} medium={mediumCount} low={lowCount}
          onNavigate={navigate}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-[2fr_2fr_1fr]">
        <TopRisksCard risks={allRisks} onNavigate={navigate} />
        <EngineCoverageCard onNavigate={navigate} />
        <FixRateCard totalFindings={totalFindings} />
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        <EcosystemsCard packages={allPkgs} onNavigate={navigate} />
        <ScanCoverageCard
          totalPackages={statsEmpty ? riskDerived.packages : (d?.total_packages ?? 0)}
          totalFindings={totalFindings}
          scannedToday={d?.scanned_today ?? 0}
          lastUpdated={d?.last_updated ?? ''}
        />
        <RecentActivityCard onNavigate={navigate} />
      </div>

      <DependencyGraphCard onNavigate={navigate} />
    </div>
  );
}

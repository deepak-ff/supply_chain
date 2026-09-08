import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { axisProps, gridProps, tooltipProps, legendProps } from '../lib/chartTheme';
import {
  Activity, Shield, ShieldAlert, ShieldBan, ShieldCheck,
  Clock, History, AlertTriangle, Package, Zap, Radio,
} from 'lucide-react';
import {
  getDashboardStats, getRecentResults, getDashboardTimeline, padTimeline,
  getPolicyStatus, getMonitorEvents, quarantinePackage,
  blockPackage, unquarantinePackage, getActiveRisks,
} from '../lib/api';
import type { MonitorEvent } from '../lib/api';
import { ActivityFeed } from '../components/ActivityFeed';
import { Card, CardHeader, CardBody } from '../components/ui/card';
import { StatTile } from '../components/ui/stat-tile';
import { StatusChip } from '../components/ui/status-chip';
import { DataTable, type DataTableColumn } from '../components/ui/data-table';
import { ThreatTicker, CyberKicker, type TickerItem } from '../components/cyber/CyberViz';
import { cn } from '../components/ui/utils';

const SEV = {
  critical: { hex: '#FF4D5E' },
  high:     { hex: '#FF8A3D' },
  medium:   { hex: '#FFB224' },
  low:      { hex: '#00E5FF' },
} as const;

// ── Live wire ticker (fed by recent probe results) ─────────────────────────

function SentinelTicker() {
  const { data } = useQuery({
    queryKey: ['monitor-recent-scans'],
    queryFn: () => getRecentResults(15),
    refetchInterval: 15_000,
    retry: false,
  });
  const items: TickerItem[] = useMemo(() => {
    const results = data?.results ?? [];
    return results.slice(0, 12).map((r, i) => {
      const sev = (r.severity?.toUpperCase() ?? 'INFO') as TickerItem['severity'];
      return {
        id: `${r.package}-${r.scanned_at}-${i}`,
        severity: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(sev) ? sev : 'INFO',
        text: `${r.ecosystem}/${r.package}@${r.version} — ${r.findings_count} hit${r.findings_count !== 1 ? 's' : ''}`,
      };
    });
  }, [data]);
  return <ThreatTicker items={items} />;
}

// ── Signal trend ───────────────────────────────────────────────────────────

function TrendCard() {
  const { data } = useQuery({
    queryKey: ['monitor-timeline'],
    queryFn: () => getDashboardTimeline(14),
    refetchInterval: 30_000,
    retry: false,
  });

  const points = useMemo(() => padTimeline(data?.points ?? [], 14), [data]);
  if (points.every(p => p.total === 0)) return null;

  return (
    <Card className="cyber-lift">
      <CardHeader
        title="Signal trend"
        description="Live findings over the last 14 days"
        action={
          <span className="font-mono text-[0.6rem] font-bold uppercase tracking-[0.18em] text-neon">
            14 days
          </span>
        }
      />
      <CardBody>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={points} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="date" {...axisProps}
              tickFormatter={(v: string) => {
                const d = new Date(v);
                return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              }} interval="preserveStartEnd" />
            <YAxis {...axisProps} />
            <RechartsTooltip {...tooltipProps} />
            <Legend {...legendProps} />
            <Line type="monotone" dataKey="critical" name="Critical" stroke={SEV.critical.hex} strokeWidth={2} dot={false} isAnimationActive animationDuration={200} />
            <Line type="monotone" dataKey="high" name="High" stroke={SEV.high.hex} strokeWidth={2} dot={false} isAnimationActive animationDuration={200} />
            <Line type="monotone" dataKey="medium" name="Medium" stroke={SEV.medium.hex} strokeWidth={2} dot={false} isAnimationActive animationDuration={200} />
            <Line type="monotone" dataKey="low" name="Low" stroke={SEV.low.hex} strokeWidth={2} dot={false} isAnimationActive animationDuration={200} />
          </LineChart>
        </ResponsiveContainer>
      </CardBody>
    </Card>
  );
}

// ── Recent probes ──────────────────────────────────────────────────────────

interface RecentScan {
  package: string; version: string; ecosystem: string;
  severity: string; findings_count: number; scanned_at: string;
}

const recentColumns: Array<DataTableColumn<RecentScan>> = [
  {
    key: 'package', header: 'Package', sortable: true, sortValue: (r) => r.package,
    render: (r) => (
      <span className="truncate font-mono text-[0.74rem] text-text-primary">
        <span className="text-text-muted">{r.ecosystem}/</span>{r.package}
      </span>
    ),
  },
  {
    key: 'version', header: 'Version', sortable: true, sortValue: (r) => r.version,
    render: (r) => <span className="font-mono text-[0.72rem] text-text-muted">{r.version}</span>,
    className: 'w-[100px]',
  },
  {
    key: 'severity', header: 'Severity', sortable: true, sortValue: (r) => r.severity,
    render: (r) => <StatusChip tone={r.severity} dot={false} />,
    className: 'w-[104px]',
  },
  {
    key: 'count', header: 'Hits', numeric: true, sortable: true, sortValue: (r) => r.findings_count,
    render: (r) => <span className="font-mono font-bold tabular-nums">{r.findings_count}</span>,
    className: 'w-[70px]',
  },
  {
    key: 'time', header: 'Time', numeric: true, sortable: true,
    sortValue: (r) => new Date(r.scanned_at).getTime(),
    render: (r) => (
      <span className="font-mono text-[0.7rem] text-text-muted">
        {new Date(r.scanned_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
      </span>
    ),
    className: 'w-[80px]',
  },
];

function RecentScansCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['monitor-recent-scans'],
    queryFn: () => getRecentResults(15),
    refetchInterval: 15_000,
    retry: false,
  });

  const results: RecentScan[] = data?.results ?? [];

  return (
    <Card className="cyber-lift">
      <CardHeader
        title="Recent probes"
        description="Fresh findings off the wire"
      />
      <DataTable
        columns={recentColumns}
        rows={results}
        rowKey={(r) => `${r.ecosystem}:${r.package}@${r.version}-${r.scanned_at}`}
        loading={isLoading}
        skeletonRows={5}
        dense
        initialSort={{ key: 'time', dir: 'desc' }}
        empty={{
          icon: Package,
          title: 'No probes yet',
          description: 'Run a probe to see findings here.',
          command: 'cwctl scan .',
        }}
      />
    </Card>
  );
}

// ── Containment (quarantine / block) ───────────────────────────────────────

function DenyListCard() {
  const qc = useQueryClient();
  const [pkg, setPkg] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState<string | null>(null);

  const { data: policyData } = useQuery({
    queryKey: ['policy-status'],
    queryFn: getPolicyStatus,
    refetchInterval: 10_000,
    retry: false,
  });

  const denyPackages = policyData?.policy?.deny_packages ?? [];

  const doAction = async (action: 'quarantine' | 'block', name: string, rsn: string) => {
    setLoading(name || 'new');
    try {
      if (action === 'quarantine') await quarantinePackage(name, rsn);
      else await blockPackage(name, rsn);
      qc.invalidateQueries({ queryKey: ['policy-status'] });
      qc.invalidateQueries({ queryKey: ['monitor-events'] });
      setPkg('');
      setReason('');
    } catch { /* silently fail */ }
    setLoading(null);
  };

  const doUnquarantine = async (name: string) => {
    setLoading(name);
    try {
      await unquarantinePackage(name);
      qc.invalidateQueries({ queryKey: ['policy-status'] });
      qc.invalidateQueries({ queryKey: ['monitor-events'] });
    } catch { /* silently fail */ }
    setLoading(null);
  };

  return (
    <Card className="cyber-lift">
      <CardHeader
        icon={Shield}
        title="Containment"
        description="Quarantine or block a package everywhere the sentry watches."
      />
      <CardBody className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <input
            value={pkg} onChange={e => setPkg(e.target.value)}
            placeholder="package name_"
            aria-label="Package name"
            className="min-w-[140px] flex-1 rounded border border-border-color bg-bg-base px-2.5 py-2 font-mono text-[0.78rem] text-text-primary placeholder:text-text-muted" />
          <input
            value={reason} onChange={e => setReason(e.target.value)}
            placeholder="reason (optional)_"
            aria-label="Reason"
            className="min-w-[180px] flex-[1.5] rounded border border-border-color bg-bg-base px-2.5 py-2 font-mono text-[0.78rem] text-text-primary placeholder:text-text-muted" />
          <button
            type="button"
            disabled={!pkg.trim() || loading === 'new'}
            onClick={() => doAction('quarantine', pkg.trim(), reason.trim())}
            className="wd-hover flex items-center gap-1.5 rounded border border-[color-mix(in_srgb,var(--warning)_45%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] px-4 py-2 font-mono text-[0.72rem] font-bold uppercase tracking-widest text-warning hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ShieldAlert size={13} /> Quarantine
          </button>
          <button
            type="button"
            disabled={!pkg.trim() || loading === 'new'}
            onClick={() => doAction('block', pkg.trim(), reason.trim())}
            className="wd-hover flex items-center gap-1.5 rounded border border-[color-mix(in_srgb,var(--critical)_45%,transparent)] bg-[color-mix(in_srgb,var(--critical)_10%,transparent)] px-4 py-2 font-mono text-[0.72rem] font-bold uppercase tracking-widest text-critical hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ShieldBan size={13} /> Block
          </button>
        </div>

        {denyPackages.length > 0 && (
          <div>
            <p className="m-0 mb-2 font-mono text-[0.62rem] font-bold uppercase tracking-[0.18em] text-text-muted">
              Neutralized packages ({denyPackages.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {denyPackages.map(d => (
                <span
                  key={d}
                  className="inline-flex items-center gap-1.5 rounded border border-[color-mix(in_srgb,var(--critical)_30%,transparent)] bg-[color-mix(in_srgb,var(--critical)_8%,transparent)] px-2.5 py-1 font-mono text-[0.68rem] text-critical"
                >
                  <ShieldBan size={11} /> {d}
                  <button
                    type="button"
                    disabled={loading === d}
                    onClick={() => doUnquarantine(d)}
                    title="Release from containment"
                    aria-label={`Release ${d} from containment`}
                    className="wd-hover ml-0.5 grid h-5 w-5 place-items-center rounded border border-[color-mix(in_srgb,var(--success)_35%,transparent)] bg-transparent text-success hover:shadow-glow disabled:opacity-40"
                  >
                    <ShieldCheck size={10} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ── Action log ─────────────────────────────────────────────────────────────

const ACTION_TONE: Record<string, string> = {
  quarantine: 'border-[color-mix(in_srgb,var(--warning)_40%,transparent)] bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] text-warning',
  block: 'border-[color-mix(in_srgb,var(--critical)_40%,transparent)] bg-[color-mix(in_srgb,var(--critical)_12%,transparent)] text-critical',
  unquarantine: 'border-[color-mix(in_srgb,var(--success)_40%,transparent)] bg-[color-mix(in_srgb,var(--success)_12%,transparent)] text-success',
};

const ACTION_LABEL: Record<string, string> = {
  quarantine: 'QUARANTINE',
  block: 'BLOCK',
  unquarantine: 'RELEASE',
};

const eventColumns: Array<DataTableColumn<MonitorEvent>> = [
  {
    key: 'time', header: 'Time', sortable: true,
    sortValue: (r) => new Date(r.timestamp).getTime(),
    render: (r) => (
      <span className="flex items-center gap-1 font-mono text-[0.7rem] text-text-muted">
        <Clock size={10} />
        {new Date(r.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
      </span>
    ),
    className: 'w-[170px]',
  },
  {
    key: 'action', header: 'Action', sortable: true, sortValue: (r) => r.action,
    render: (r) => (
      <span className={cn(
        'inline-block rounded border px-1.5 py-0.5 font-mono text-[0.6rem] font-bold uppercase tracking-wider',
        ACTION_TONE[r.action] ?? 'border-border-color bg-surface-muted text-text-muted',
      )}>
        {ACTION_LABEL[r.action] ?? r.action.toUpperCase()}
      </span>
    ),
    className: 'w-[130px]',
  },
  {
    key: 'package', header: 'Package', sortable: true, sortValue: (r) => r.package,
    render: (r) => <span className="font-mono text-[0.74rem] text-text-primary">{r.package}</span>,
  },
  {
    key: 'reason', header: 'Reason',
    render: (r) => <span className="text-[0.72rem] text-text-muted">{r.reason || '—'}</span>,
  },
];

function EventsCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['monitor-events'],
    queryFn: getMonitorEvents,
    refetchInterval: 10_000,
    retry: false,
  });

  const events: MonitorEvent[] = data?.events ?? [];

  return (
    <Card className="cyber-lift">
      <CardHeader
        icon={History}
        title="Action log"
        description="Every containment order the sentry has executed."
      />
      <DataTable
        columns={eventColumns}
        rows={events}
        rowKey={(r) => `${r.timestamp}-${r.action}-${r.package}`}
        loading={isLoading}
        skeletonRows={5}
        dense
        initialSort={{ key: 'time', dir: 'desc' }}
        empty={{
          icon: History,
          title: 'No actions on record',
          description: 'Quarantine or block a package to start the log.',
        }}
      />
    </Card>
  );
}

// ── Tab navigation ─────────────────────────────────────────────────────────

type TabKey = 'overview' | 'actions' | 'history';

const TABS: { key: TabKey; label: string; icon: typeof Activity }[] = [
  { key: 'overview', label: 'Overwatch', icon: Radio },
  { key: 'actions', label: 'Containment', icon: Shield },
  { key: 'history', label: 'Action log', icon: History },
];

export default function MonitorPage() {
  const [tab, setTab] = useState<TabKey>('overview');

  const { data: stats, isError, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['monitor-stats'],
    queryFn: () => getDashboardStats(),
    refetchInterval: 10_000,
    retry: 3,
    retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 10_000),
  });

  const risksQuery = useQuery({
    queryKey: ['monitor-risks'],
    queryFn: getActiveRisks,
    refetchInterval: 30_000,
    retry: false,
  });

  const allRisks = risksQuery.data?.risks ?? [];

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

  const statsEmpty = !stats || (stats.total_findings === 0 && stats.critical_findings === 0 && riskDerived.total > 0);
  const totalPkgs = statsEmpty ? riskDerived.packages : (stats?.total_packages ?? 0);
  const critFindings = statsEmpty ? riskDerived.critical : (stats?.critical_findings ?? 0);
  const highFindings = statsEmpty ? riskDerived.high : (stats?.high_findings ?? 0);
  const totalFindings = statsEmpty ? riskDerived.total : (stats?.total_findings ?? 0);
  const scannedToday = stats?.scanned_today ?? 0;

  const lastRefresh = dataUpdatedAt ? new Date(dataUpdatedAt) : null;

  return (
    <div className="flex flex-col gap-5">
      <SentinelTicker />

      {/* Header */}
      <div>
        <CyberKicker index="O-01" label="overwatch // live sentinel" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="m-0 flex items-center gap-2 text-[1.15rem] font-bold tracking-tight text-text-primary">
              <Activity size={18} className="text-neon" aria-hidden="true" /> Live Sentinel
            </h1>
            <p className="m-0 mt-1 font-mono text-[0.68rem] text-text-muted">
              real-time security posture{lastRefresh ? ` — refreshed ${lastRefresh.toLocaleTimeString()}` : ''}
            </p>
          </div>
          {isError ? (
            <span className="flex items-center gap-1.5 font-mono text-[0.7rem] font-bold uppercase tracking-widest text-critical">
              <AlertTriangle size={13} /> API unreachable
            </span>
          ) : (
            <span className="flex items-center gap-2 rounded border border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_8%,transparent)] px-2.5 py-1.5 font-mono text-[0.68rem] text-success">
              <span aria-hidden="true" className="sonar h-1.5 w-1.5 rounded-full bg-success text-success" />
              {stats?.ecosystems_covered?.length ?? 0} ecosystems watched
            </span>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border-color" role="tablist" aria-label="Sentinel views">
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              className={cn(
                'wd-hover -mb-px flex items-center gap-1.5 border-b-2 bg-transparent px-4 py-2 font-mono text-[0.74rem] font-bold uppercase tracking-wider',
                active
                  ? 'border-neon text-neon drop-shadow-[0_0_8px_var(--neon)]'
                  : 'border-transparent text-text-secondary hover:text-text-primary',
              )}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <>
          {isLoading && !stats ? (
            <div className="py-12 text-center">
              <p className="m-0 animate-pulse font-mono text-[0.78rem] text-text-secondary">tuning the sentinel…</p>
            </div>
          ) : isError && !stats ? (
            <div className="py-12 text-center">
              <AlertTriangle size={24} className="mx-auto mb-2 text-text-muted opacity-40" />
              <p className="m-0 mb-1 text-[0.78rem] text-text-secondary">Could not reach API. Is the server running?</p>
              <code className="font-mono text-[0.7rem] text-neon">cwctl serve</code>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {/* KPI strip */}
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
                <StatTile label="Packages" value={totalPkgs} icon={Package} className="cyber-lift fg-entrance" />
                <StatTile label="Probed today" value={scannedToday} icon={Zap} accent="success" className="cyber-lift fg-entrance fg-entrance-delay-1" />
                <StatTile label="Live findings" value={totalFindings} icon={AlertTriangle} accent="amber" className="cyber-lift fg-entrance fg-entrance-delay-2" />
                <StatTile label="Critical" value={critFindings} icon={ShieldAlert} accent="critical" className="cyber-lift fg-entrance fg-entrance-delay-3" />
                <StatTile label="High" value={highFindings} icon={AlertTriangle} accent="warning" className="cyber-lift fg-entrance fg-entrance-delay-4" />
              </div>

              <TrendCard />

              {/* Recent probes + live wire */}
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <RecentScansCard />
                <Card className="cyber-lift flex flex-col">
                  <CardHeader
                    title="Live wire"
                    description="Streaming engine + probe events"
                    action={
                      <span aria-hidden="true" className="sonar h-2 w-2 rounded-full bg-success text-success" />
                    }
                  />
                  <CardBody className="flex-1 overflow-hidden">
                    <ActivityFeed limit={15} />
                  </CardBody>
                </Card>
              </div>

              {/* System info */}
              <Card className="cyber-lift">
                <CardHeader title="Grid status" description="Sentinel telemetry" />
                <CardBody className="flex flex-col gap-0 p-0">
                  <div className="flex items-center justify-between border-b border-border-color px-4 py-2.5">
                    <span className="font-mono text-[0.68rem] uppercase tracking-wider text-text-muted">Last sweep</span>
                    <span className="font-mono text-[0.74rem] text-text-primary">
                      {stats?.last_updated ? new Date(stats.last_updated).toLocaleString() : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="font-mono text-[0.68rem] uppercase tracking-wider text-text-muted">Ecosystems watched</span>
                    <span className="text-right font-mono text-[0.74rem] text-neon">
                      {stats?.ecosystems_covered && stats.ecosystems_covered.length > 0 ? stats.ecosystems_covered.join(' · ') : '—'}
                    </span>
                  </div>
                </CardBody>
              </Card>
            </div>
          )}
        </>
      )}

      {tab === 'actions' && <DenyListCard />}
      {tab === 'history' && <EventsCard />}
    </div>
  );
}

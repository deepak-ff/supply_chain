import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { axisProps, gridProps, legendProps, tooltipProps } from '../lib/chartTheme';
import { GitBranch, TrendingUp, AlertTriangle, Shield, Radar } from 'lucide-react';
import { getDashboardTimeline, getActiveRisks, padTimeline } from '../lib/api';
import { Card, CardHeader, CardBody } from '../components/ui/card';
import { StatTile, type StatTileAccent } from '../components/ui/stat-tile';
import { ExposureBars, CyberKicker } from '../components/cyber/CyberViz';
import { EmptyState } from '../components/EmptyState';
import { cn } from '../components/ui/utils';

const SEV = {
  critical: { hex: '#FF4D5E', label: 'Critical' },
  high:     { hex: '#FF8A3D', label: 'High' },
  medium:   { hex: '#FFB224', label: 'Medium' },
  low:      { hex: '#00E5FF', label: 'Low' },
} as const;

type GradeTone = 'critical' | 'warning' | 'amber' | 'teal' | 'neon';
const GRADE_TONE: Record<string, GradeTone> = {
  F: 'critical', D: 'warning', C: 'amber', B: 'teal', A: 'neon',
};

function fmtDelta(v: number): { value: string; direction: 'up' | 'down' | 'flat' } {
  if (v === 0) return { value: '0', direction: 'flat' };
  return { value: `${v > 0 ? '+' : ''}${v}`, direction: v > 0 ? 'up' : 'down' };
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

const SEV_CHIP: Record<string, string> = {
  CRITICAL: 'border-[color-mix(in_srgb,var(--critical)_40%,transparent)] bg-[color-mix(in_srgb,var(--critical)_12%,transparent)] text-critical',
  HIGH: 'border-[color-mix(in_srgb,var(--warning)_40%,transparent)] bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] text-warning',
  MEDIUM: 'border-[color-mix(in_srgb,var(--amber)_40%,transparent)] bg-[color-mix(in_srgb,var(--amber)_12%,transparent)] text-amber',
  LOW: 'border-[color-mix(in_srgb,var(--neon)_40%,transparent)] bg-[color-mix(in_srgb,var(--neon)_12%,transparent)] text-neon',
};

export function DependencyDriftPage() {
  const timeline30 = useQuery({
    queryKey: ['drift-timeline-30'],
    queryFn: () => getDashboardTimeline(30),
    refetchInterval: 60_000,
  });
  const timeline7 = useQuery({
    queryKey: ['drift-timeline-7'],
    queryFn: () => getDashboardTimeline(7),
    refetchInterval: 60_000,
  });
  const risks = useQuery({
    queryKey: ['drift-risks'],
    queryFn: getActiveRisks,
    refetchInterval: 60_000,
    retry: false,
  });

  const pts30 = useMemo(() => padTimeline(timeline30.data?.points ?? [], 30), [timeline30.data]);
  const pts7 = useMemo(() => padTimeline(timeline7.data?.points ?? [], 7), [timeline7.data]);
  const allRisks = risks.data?.risks ?? [];

  const summary = useMemo(() => {
    if (pts30.length < 2) return { totalDelta: 0, critDelta: 0, highDelta: 0, latestTotal: 0 };
    const first = pts30[0];
    const last = pts30[pts30.length - 1];
    return {
      totalDelta: last.total - first.total,
      critDelta: last.critical - first.critical,
      highDelta: last.high - first.high,
      latestTotal: last.total,
    };
  }, [pts30]);

  const riskByGrade = useMemo(() => {
    const grades: Record<string, number> = {};
    for (const r of allRisks) {
      const g = r.risk_grade || 'A';
      grades[g] = (grades[g] ?? 0) + 1;
    }
    return ['F', 'D', 'C', 'B', 'A'].map(g => ({ grade: g, count: grades[g] ?? 0 })).filter(g => g.count > 0);
  }, [allRisks]);
  const gradeMax = riskByGrade[0]?.count ?? 1;

  const recentChanges = useMemo(() => {
    return [...allRisks]
      .sort((a, b) => new Date(b.first_seen).getTime() - new Date(a.first_seen).getTime())
      .slice(0, 8);
  }, [allRisks]);

  const sevBreakdown = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const r of allRisks) {
      const s = r.top_severity?.toUpperCase();
      if (s === 'CRITICAL') counts.critical += r.finding_count;
      else if (s === 'HIGH') counts.high += r.finding_count;
      else if (s === 'MEDIUM') counts.medium += r.finding_count;
      else counts.low += r.finding_count;
    }
    return counts;
  }, [allRisks]);

  const totalFindings = sevBreakdown.critical + sevBreakdown.high + sevBreakdown.medium + sevBreakdown.low;

  const kpis: Array<{ label: string; value: number; delta?: { value: string; direction: 'up' | 'down' | 'flat' }; icon: typeof TrendingUp; accent: StatTileAccent }> = [
    { label: 'Live findings', value: totalFindings, delta: fmtDelta(summary.totalDelta), icon: AlertTriangle, accent: 'neutral' },
    { label: 'Critical', value: sevBreakdown.critical, delta: fmtDelta(summary.critDelta), icon: AlertTriangle, accent: 'critical' },
    { label: 'High', value: sevBreakdown.high, delta: fmtDelta(summary.highDelta), icon: AlertTriangle, accent: 'warning' },
    { label: 'Packages at risk', value: allRisks.length, icon: Shield, accent: 'amber' },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div>
        <CyberKicker index="O-03" label="overwatch // drift radar" />
        <h1 className="m-0 flex items-center gap-2 text-[1.15rem] font-bold tracking-tight text-text-primary">
          <Radar size={18} className="text-neon" aria-hidden="true" /> Drift Radar
        </h1>
        <p className="m-0 mt-1 text-[0.78rem] text-text-secondary">
          How your supply grid is shifting — posture drift, grade migration and fresh movement, week over week.
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
        {kpis.map((k, i) => (
          <StatTile
            key={k.label}
            label={k.label}
            value={k.value}
            delta={k.delta}
            icon={k.icon}
            accent={k.accent}
            loading={timeline30.isLoading && pts30.length === 0}
            className={cn('cyber-lift fg-entrance', i === 1 && 'fg-entrance-delay-1', i === 2 && 'fg-entrance-delay-2', i === 3 && 'fg-entrance-delay-3')}
          />
        ))}
      </div>

      {/* Main chart — 30d signal sweep */}
      <Card className="cyber-lift">
        <CardHeader
          title="Signal sweep"
          description="Finding drift across the last 30 days, by severity"
          action={
            <span className="font-mono text-[0.6rem] font-bold uppercase tracking-[0.18em] text-neon">30 days</span>
          }
        />
        <CardBody>
          {pts30.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={pts30} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="date" {...axisProps}
                  tickFormatter={(v: string) => v.slice(5)} interval="preserveStartEnd" />
                <YAxis {...axisProps} />
                <RechartsTooltip {...tooltipProps} />
                <Legend {...legendProps} />
                <Line type="monotone" dataKey="critical" name="Critical" stroke={SEV.critical.hex} strokeWidth={2} dot={false} isAnimationActive animationDuration={200} />
                <Line type="monotone" dataKey="high" name="High" stroke={SEV.high.hex} strokeWidth={2} dot={false} isAnimationActive animationDuration={200} />
                <Line type="monotone" dataKey="medium" name="Medium" stroke={SEV.medium.hex} strokeWidth={2} dot={false} isAnimationActive animationDuration={200} />
                <Line type="monotone" dataKey="low" name="Low" stroke={SEV.low.hex} strokeWidth={2} dot={false} isAnimationActive animationDuration={200} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              icon={GitBranch}
              title="No sweep history yet"
              description="Run probes on a schedule to populate the drift record."
              command="cwctl scan ."
            />
          )}
        </CardBody>
      </Card>

      {/* 7-day stacked bars + grade migration */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
        <Card className="cyber-lift">
          <CardHeader
            title="Weekly findings stack"
            description="Stacked hits per day for the last 7 days"
            action={
              <span className="font-mono text-[0.6rem] font-bold uppercase tracking-[0.18em] text-neon">7 days</span>
            }
          />
          <CardBody>
            {pts7.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={pts7} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="date" {...axisProps}
                    tickFormatter={(v: string) => {
                      const d = new Date(v);
                      return d.toLocaleDateString('en-US', { weekday: 'short' });
                    }} />
                  <YAxis {...axisProps} />
                  <RechartsTooltip {...tooltipProps} />
                  <Bar dataKey="critical" stackId="sev" fill={SEV.critical.hex} name="Critical" />
                  <Bar dataKey="high" stackId="sev" fill={SEV.high.hex} name="High" />
                  <Bar dataKey="medium" stackId="sev" fill={SEV.medium.hex} name="Medium" />
                  <Bar dataKey="low" stackId="sev" fill={SEV.low.hex} name="Low" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                icon={GitBranch}
                title="No weekly data yet"
                description="Seven days of probes will fill this stack."
              />
            )}
          </CardBody>
        </Card>

        <Card className="cyber-lift">
          <CardHeader title="Grade migration" description="Where the fleet sits, F → A" />
          <CardBody>
            {riskByGrade.length > 0 ? (
              <ExposureBars
                rows={riskByGrade.map(g => ({
                  label: `Grade ${g.grade} · ${g.count} pkg${g.count !== 1 ? 's' : ''}`,
                  value: g.count,
                  max: gradeMax,
                  tone: GRADE_TONE[g.grade] ?? 'neon',
                }))}
              />
            ) : (
              <p className="m-0 py-3 text-center font-mono text-[0.72rem] text-text-muted">// no grade data</p>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Fresh movement */}
      <Card className="cyber-lift">
        <CardHeader title="Fresh movement" description="Most recently shifted packages first" />
        <CardBody>
          {recentChanges.length === 0 ? (
            <EmptyState
              icon={Radar}
              title="Grid is holding still"
              description="No package movement detected yet — new and shifting packages land here."
            />
          ) : (
            <div className="flex flex-col">
              {recentChanges.map((r, i) => (
                <div
                  key={`${r.package_name}-${r.version}-${i}`}
                  className={cn('flex items-center gap-3 py-2.5', i < recentChanges.length - 1 && 'border-b border-border-color')}
                >
                  <span className={cn(
                    'w-12 shrink-0 rounded border px-1.5 py-0.5 text-center font-mono text-[0.6rem] font-bold uppercase tracking-wide',
                    SEV_CHIP[r.top_severity] ?? 'border-border-color bg-surface-muted text-text-muted',
                  )}>
                    {r.top_severity === 'CRITICAL' ? 'crit' : r.top_severity?.toLowerCase().slice(0, 4) ?? '—'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="font-mono text-[0.75rem] text-text-primary">{r.package_name}</span>
                    <span className="ml-1.5 font-mono text-[0.65rem] text-neon">@{r.version}</span>
                  </div>
                  <span className="shrink-0 rounded border border-border-color bg-surface-muted px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider text-text-muted">
                    {r.ecosystem.toLowerCase()}
                  </span>
                  <span className="shrink-0 font-mono text-[0.62rem] text-text-muted">
                    Grade <span className="font-bold text-text-primary">{r.risk_grade}</span>
                  </span>
                  <span className="w-8 shrink-0 text-right font-mono text-[0.68rem] font-bold tabular-nums text-text-secondary">
                    {r.finding_count}
                  </span>
                  <span className="w-14 shrink-0 text-right font-mono text-[0.6rem] text-text-muted">
                    {relativeTime(r.first_seen)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

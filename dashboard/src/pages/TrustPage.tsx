import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Gauge, ShieldCheck, ShieldAlert, Activity, FlaskConical, Radar,
  Lock, ArrowLeftRight, RefreshCw, AlertTriangle, X,
} from 'lucide-react';
import {
  listTrust, getTrust, simulateTrust, getTrustLock, getTrustDiff,
  type TrustSummary, type TrustScore, type TrustBaseline, type TrustObservation,
  type TrustVersionDiff, type TrustDrift, type TrustMetricDelta, type TrustLockView,
} from '../lib/api';
import { Card, CardHeader, CardBody, CardFooter } from '../components/ui/card';
import { StatTile } from '../components/ui/stat-tile';
import { DataTable, type DataTableColumn } from '../components/ui/data-table';
import { StatusChip } from '../components/ui/status-chip';
import { Skeleton } from '../components/ui/skeleton';
import { EmptyState } from '../components/EmptyState';
import { cn } from '../components/ui/utils';
import { CyberKicker } from '../components/cyber/CyberViz';
import {
  axisProps, gridProps, legendProps, seriesProps, tooltipProps, chartMargin,
} from '../lib/chartTheme';

const SCENARIOS = [
  { id: 'hijack',   label: 'Publish hijack',      hint: 'Stolen token adds an install hook that phones home' },
  { id: 'sleeper',  label: 'Sleeper drift',       hint: 'Payload assembled slowly across several releases' },
  { id: 'takeover', label: 'Maintainer takeover', hint: 'New publisher, then an out-of-cadence release' },
  { id: 'clean',    label: 'Healthy release',     hint: 'Control case — should stay GREEN' },
] as const;

const STATE_STROKE: Record<string, string> = {
  GREEN: 'stroke-success', AMBER: 'stroke-warning', RED: 'stroke-critical', LEARNING: 'stroke-text-muted',
};

const DRIFT_TONE: Record<string, string> = {
  'behaviour-changed': 'RED',
  'trust-dropped': 'AMBER',
  'added': 'HIGH',
  'removed': 'LEARNING',
};

const LEDGER_COMMAND = 'cwctl trust from-scan scan.json --package npm:express';

// ── score dial ──────────────────────────────────────────────────────────────

function ScoreDial({ score, state }: { score: number; state: string }) {
  const pct = Math.max(0, Math.min(100, score));
  const r = 30;
  const circumference = 2 * Math.PI * r;
  const stroke = STATE_STROKE[state] ?? STATE_STROKE.LEARNING;
  return (
    <div className="flex items-center gap-4">
      <svg width={76} height={76} viewBox="0 0 76 76" className="shrink-0" aria-hidden="true">
        <circle cx={38} cy={38} r={r} fill="none" stroke="var(--surface-muted)" strokeWidth={7} />
        <circle
          cx={38} cy={38} r={r} fill="none" strokeWidth={7} strokeLinecap="round"
          className={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct / 100)}
          transform="rotate(-90 38 38)"
          style={{ filter: 'drop-shadow(0 0 6px currentColor)' }} />
      </svg>
      <div className="min-w-0">
        <p className="m-0 text-[28px] font-semibold leading-none tabular-nums text-text-primary">
          {score}
        </p>
        <div className="mt-1.5">
          <StatusChip tone={state} />
        </div>
        <p className="m-0 mt-1 text-[0.68rem] text-text-muted">trust score out of 100</p>
      </div>
    </div>
  );
}

// ── deviations ──────────────────────────────────────────────────────────────

const deviationColumns: Array<DataTableColumn<{
  metric: string; label: string; severity: string; deduction: number; z_score: number; reason: string;
}>> = [
  {
    key: 'severity',
    header: 'Severity',
    sortable: true,
    sortValue: (d) => d.severity,
    render: (d) => <StatusChip tone={d.severity} dot={false} />,
    className: 'w-[104px]',
  },
  {
    key: 'metric',
    header: 'Metric',
    sortable: true,
    sortValue: (d) => d.label,
    render: (d) => (
      <div className="min-w-0">
        <span className="block text-[0.78rem] font-medium text-text-primary">{d.label}</span>
        <span className="mt-0.5 block text-[0.7rem] leading-snug text-text-muted">{d.reason}</span>
      </div>
    ),
  },
  {
    key: 'deduction',
    header: 'Deduction',
    numeric: true,
    sortable: true,
    sortValue: (d) => d.deduction,
    render: (d) => <span className="text-critical">−{d.deduction}</span>,
    className: 'w-[92px]',
  },
  {
    key: 'z',
    header: 'z-score',
    numeric: true,
    sortable: true,
    sortValue: (d) => d.z_score,
    render: (d) => d.z_score.toFixed(1),
    className: 'w-[80px]',
  },
];

function DeviationTable({ score }: { score: TrustScore }) {
  if (score.deviations.length === 0) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="No behavioural drift"
        description="Every observed metric sits inside the baseline learned from this package's own history." />
    );
  }
  return <DataTable columns={deviationColumns} rows={score.deviations} rowKey={(d) => d.metric} dense />;
}

// ── baseline stats ──────────────────────────────────────────────────────────

const baselineColumns: Array<DataTableColumn<TrustBaseline['stats'][number]>> = [
  { key: 'label',  header: 'Metric',  sortable: true, sortValue: (s) => s.label,  render: (s) => s.label },
  { key: 'mean',   header: 'Mean',    numeric: true, sortable: true, sortValue: (s) => s.mean,   render: (s) => s.mean.toFixed(2) },
  { key: 'stddev', header: 'Std dev', numeric: true, sortable: true, sortValue: (s) => s.stddev, render: (s) => s.stddev.toFixed(2) },
  { key: 'range',  header: 'Range',   numeric: true, sortable: true, sortValue: (s) => s.min,    render: (s) => `${s.min}–${s.max}` },
];

function BaselineTable({ baseline }: { baseline: TrustBaseline }) {
  const rows = baseline.stats.filter((s) => s.mean !== 0 || s.max !== 0);
  if (rows.length === 0) return null;
  return (
    <div className="border-t border-border-color">
      <DataTable
        columns={baselineColumns}
        rows={rows}
        rowKey={(s) => s.metric}
        initialSort={{ key: 'label', dir: 'asc' }}
        dense
      />
    </div>
  );
}

// ── observation chart ───────────────────────────────────────────────────────

function ObservationChart({ observations }: { observations: TrustObservation[] }) {
  if (observations.length < 2) return null;
  const data = observations.map((o) => ({
    version: o.version || new Date(o.observed_at).toLocaleDateString(),
    network: o.metrics.network_calls,
    hooks: o.metrics.install_hooks,
    obfuscation: o.metrics.obfuscation_score,
  }));
  return (
    <div className="h-[200px] border-t border-border-color px-3 py-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={chartMargin}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="version" {...axisProps} />
          <YAxis {...axisProps} width={40} />
          <RechartsTooltip {...tooltipProps} />
          <Legend {...legendProps} />
          <Line type="monotone" dataKey="network" name="Network calls" {...seriesProps(0)} />
          <Line type="monotone" dataKey="hooks" name="Install hooks" {...seriesProps(1)} />
          <Line type="monotone" dataKey="obfuscation" name="Obfuscation" {...seriesProps(2)} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── metric deltas ───────────────────────────────────────────────────────────

const deltaColumns: Array<DataTableColumn<TrustMetricDelta>> = [
  { key: 'label', header: 'Metric', sortable: true, sortValue: (d) => d.label, render: (d) => d.label },
  { key: 'from',  header: 'From',   numeric: true, sortable: true, sortValue: (d) => d.from,  render: (d) => d.from.toFixed(2) },
  { key: 'to',    header: 'To',     numeric: true, sortable: true, sortValue: (d) => d.to,    render: (d) => d.to.toFixed(2) },
  {
    key: 'delta', header: 'Δ', numeric: true, sortable: true, sortValue: (d) => d.delta,
    render: (d) => (
      <span className={cn('font-semibold', d.riskier ? 'text-warning' : 'text-text-secondary')}>
        {d.delta > 0 ? '+' : ''}{d.delta.toFixed(2)}
      </span>
    ),
  },
  {
    key: 'risk', header: 'Risk', numeric: true, sortable: true, sortValue: (d) => (d.riskier ? 1 : 0),
    render: (d) => (d.riskier
      ? <AlertTriangle size={13} className="ml-auto text-warning" aria-label="Riskier" />
      : <span className="text-text-muted">·</span>),
    className: 'w-[64px]',
  },
];

function DeltaTable({ deltas }: { deltas: TrustMetricDelta[] }) {
  if (deltas.length === 0) {
    return (
      <p className="m-0 px-3 py-6 text-center text-[0.74rem] text-text-muted">
        No metric drift — behaviour is identical between these releases.
      </p>
    );
  }
  return <DataTable columns={deltaColumns} rows={deltas} rowKey={(d) => d.metric} dense />;
}

// ── lockfile drift rows ─────────────────────────────────────────────────────

function DriftRow({ drift }: { drift: TrustDrift }) {
  return (
    <li className="rounded border border-border-color bg-bg-base p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <StatusChip tone={DRIFT_TONE[drift.kind] ?? 'INFO'} label={drift.kind} dot={false} />
          <span className="truncate text-[0.78rem] font-medium text-text-primary">
            {drift.ecosystem}:{drift.package}
          </span>
        </div>
        {(drift.from_score !== undefined || drift.to_score !== undefined) && (
          <span className="text-[0.7rem] tabular-nums text-text-secondary">
            {drift.from_version ?? ''} {drift.from_score !== undefined ? `(${drift.from_score})` : ''}
            {drift.to_version || drift.from_version ? ' → ' : ''}
            {drift.to_version ?? ''} {drift.to_score !== undefined ? `(${drift.to_score})` : ''}
          </span>
        )}
      </div>
      {drift.message && <p className="m-0 mt-1.5 text-[0.72rem] text-text-muted">{drift.message}</p>}
      {drift.metric_deltas && drift.metric_deltas.length > 0 && (
        <div className="mt-2 overflow-hidden rounded border border-border-color bg-surface">
          <DeltaTable deltas={drift.metric_deltas} />
        </div>
      )}
    </li>
  );
}

function LockPanelBody({ data }: { data: TrustLockView }) {
  const report = data.report;
  if (!data.present) {
    return (
      <CardBody>
        <EmptyState
          icon={Lock}
          title="No behavioural lockfile yet"
          description={`Nothing is pinned. The ledger currently holds ${data.tracked} package(s) — freeze their behaviour so the next release can be compared against it.`}
          command="cwctl trust lock" />
      </CardBody>
    );
  }

  const ok = report?.ok ?? false;
  return (
    <>
      <CardBody>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.72rem]">
          <StatusChip tone={ok ? 'GREEN' : 'RED'} label={ok ? 'Verified' : 'Drifted'} />
          <span className="tabular-nums text-text-secondary">checked {report?.checked ?? 0}</span>
          <span className="tabular-nums text-text-secondary">matched {report?.matched ?? 0}</span>
          <span className="tabular-nums text-text-secondary">drifts {report?.drifts.length ?? 0}</span>
          {data.lock?.generated && (
            <span className="text-text-muted">
              generated {new Date(data.lock.generated).toLocaleString()}
            </span>
          )}
        </div>

        {ok && (
          <p className="m-0 mt-3 text-[0.74rem] leading-relaxed text-text-secondary">
            Every tracked package still matches the behavioural fingerprint locked at{' '}
            {data.lock?.generated ? new Date(data.lock.generated).toLocaleString() : 'generation'} time.
          </p>
        )}

        {!ok && report?.drifts.length ? (
          <ul className="m-0 mt-3 list-none space-y-2 p-0">
            {report.drifts.map((drift, i) => (
              <DriftRow key={`${drift.kind}-${drift.ecosystem}:${drift.package}-${i}`} drift={drift} />
            ))}
          </ul>
        ) : null}
      </CardBody>
      <CardFooter className="font-mono text-[0.68rem]">
        <span className="truncate">{data.lockfile}</span>
        <span className="shrink-0">cwctl trust verify</span>
      </CardFooter>
    </>
  );
}

function LockPanel() {
  const lock = useQuery({ queryKey: ['trust-lock'], queryFn: getTrustLock, refetchInterval: 60_000 });

  return (
    <Card className="cyber-lift">
      <CardHeader
        icon={Lock}
        title="Behavioural lockfile"
        description="Pinned fingerprints for every tracked package, re-verified against the live ledger."
        action={
          <button
            type="button"
            onClick={() => lock.refetch()}
            title="Re-verify against the lockfile"
            className="wd-hover flex items-center gap-1.5 rounded border border-border-color bg-surface px-2 py-1 font-mono text-[0.68rem] font-bold uppercase tracking-wider text-text-secondary hover:border-neon hover:text-neon" >
            <RefreshCw size={11} aria-hidden="true" /> Re-check
          </button>
        }
      />
      {lock.isLoading && (
        <CardBody>
          <Skeleton className="h-4 w-56" />
          <Skeleton className="mt-3 h-16 w-full" />
        </CardBody>
      )}
      {lock.isError && (
        <CardBody>
          <p className="m-0 text-[0.74rem] text-critical">{(lock.error as Error).message}</p>
        </CardBody>
      )}
      {lock.data && <LockPanelBody data={lock.data} />}
    </Card>
  );
}

// ── release delta ───────────────────────────────────────────────────────────

function ReleaseDeltaBody({ data }: { data: TrustVersionDiff }) {
  return (
    <CardBody className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-[0.74rem]">
        <span className="font-mono text-text-primary">{data.from_version}</span>
        <span className="text-text-muted">→</span>
        <span className="font-mono text-text-primary">{data.to_version}</span>
        <span className="ml-1 flex items-center gap-1.5">
          <StatusChip tone={data.from_state} dot={false} />
          <span className="tabular-nums text-text-secondary">{data.from_score}</span>
        </span>
        <span className="text-text-muted">→</span>
        <span className="flex items-center gap-1.5">
          <StatusChip tone={data.to_state} dot={false} />
          <span className="tabular-nums text-text-secondary">{data.to_score}</span>
        </span>
      </div>
    </CardBody>
  );
}

function ReleaseDelta({ ecosystem, pkg }: { ecosystem: string; pkg: string }) {
  const diff = useQuery({
    queryKey: ['trust-diff', ecosystem, pkg],
    queryFn: () => getTrustDiff(ecosystem, pkg),
    enabled: !!ecosystem && !!pkg,
  });

  return (
    <Card className="cyber-lift">
      <CardHeader
        icon={ArrowLeftRight}
        title="Release delta"
        description="Previous release versus the current one, metric by metric." />
      {diff.isLoading && (
        <CardBody>
          <Skeleton className="h-4 w-64" />
          <Skeleton className="mt-3 h-24 w-full" />
        </CardBody>
      )}
      {diff.isError && (
        <CardBody>
          <p className="m-0 text-[0.74rem] text-text-muted">{(diff.error as Error).message}</p>
        </CardBody>
      )}
      {diff.data && (
        <>
          <ReleaseDeltaBody data={diff.data} />
          <div className="border-t border-border-color">
            <DeltaTable deltas={diff.data.metric_deltas} />
          </div>
        </>
      )}
    </Card>
  );
}

// ── ledger table ────────────────────────────────────────────────────────────

const ledgerColumns: Array<DataTableColumn<TrustSummary>> = [
  {
    key: 'package', header: 'Package', sortable: true, sortValue: (p) => `${p.ecosystem}:${p.package}`,
    render: (p) => (
      <span className="font-medium text-text-primary">
        <span className="text-text-muted">{p.ecosystem}:</span>{p.package}
      </span>
    ),
  },
  {
    key: 'version', header: 'Version', sortable: true, sortValue: (p) => p.version ?? '',
    render: (p) => <span className="font-mono text-[0.72rem] text-text-secondary">{p.version || '—'}</span>,
    className: 'w-[120px]',
  },
  {
    key: 'samples', header: 'Obs', numeric: true, sortable: true, sortValue: (p) => p.samples,
    render: (p) => p.samples,
    className: 'w-[64px]',
  },
  {
    key: 'score', header: 'Score', numeric: true, sortable: true, sortValue: (p) => p.score,
    render: (p) => <span className="font-semibold">{p.score}</span>,
    className: 'w-[72px]',
  },
  {
    key: 'state', header: 'State', sortable: true, sortValue: (p) => p.state,
    render: (p) => <StatusChip tone={p.state} />,
    className: 'w-[116px]',
  },
];

// ── page ────────────────────────────────────────────────────────────────────

export function TrustPage() {
  const [scenario, setScenario] = useState<string>('hijack');
  const [selected, setSelected] = useState<TrustSummary | null>(null);

  const tracked = useQuery({ queryKey: ['trust-list'], queryFn: listTrust, refetchInterval: 30_000 });

  const detail = useQuery({
    queryKey: ['trust-detail', selected?.ecosystem, selected?.package],
    queryFn: () => getTrust(selected!.ecosystem, selected!.package),
    enabled: !!selected,
  });

  const simulation = useMutation({ mutationFn: (id: string) => simulateTrust(id) });

  const states = tracked.data?.states ?? {};
  const packages = tracked.data?.packages ?? [];

  return (
    <div className="space-y-5">
      <header>
        <CyberKicker index="O-05" label="overwatch // trust pulse" />
        <h1 className="m-0 flex items-center gap-2 text-[1.15rem] font-bold tracking-tight text-text-primary">
          <Radar size={18} className="text-neon drop-shadow-[0_0_8px_var(--neon)]" aria-hidden="true" />
          Trust Pulse
        </h1>
        <p className="m-0 mt-1.5 max-w-3xl text-[0.78rem] leading-relaxed text-text-secondary">
          Signature scanning catches malware we have already seen. The trust engine catches a package
          that stops behaving like <em>itself</em> — a new install hook, an outbound call it never
          made, a maintainer who appeared yesterday. Every release is scored against the statistical
          baseline learned from its own history.
        </p>
      </header>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        <StatTile
          label="Packages tracked"
          value={tracked.data?.tracked ?? 0}
          icon={Activity}
          accent="primary"
          loading={tracked.isLoading}
          className="cyber-lift fg-entrance"
        />
        <StatTile
          label="Average trust"
          value={tracked.data?.average_score ?? 100}
          icon={Gauge}
          accent="teal"
          hint="Mean score across the ledger"
          loading={tracked.isLoading}
          className="cyber-lift fg-entrance fg-entrance-delay-1"
        />
        <StatTile
          label="Amber"
          value={states.AMBER ?? 0}
          icon={ShieldAlert}
          accent="warning"
          hint="Drifting, not yet blocked"
          loading={tracked.isLoading}
          className="cyber-lift fg-entrance fg-entrance-delay-2"
        />
        <StatTile
          label="Red"
          value={states.RED ?? 0}
          icon={ShieldAlert}
          accent="critical"
          hint="Behaviour changed materially"
          loading={tracked.isLoading}
          className="cyber-lift fg-entrance fg-entrance-delay-3"
        />
      </div>

      <LockPanel />

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Drift simulator */}
        <Card className="cyber-lift">
          <CardHeader
            icon={FlaskConical}
            title="Drift simulator"
            description="Replay a compromise pattern against a synthetic release history — no data required."
            action={
              <code className="hidden rounded bg-surface-muted px-1.5 py-0.5 font-mono text-[0.65rem] text-text-muted sm:inline">
                cwctl trust simulate --scenario {scenario}
              </code>
            }
          />
          <CardBody className="space-y-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SCENARIOS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { setScenario(s.id); simulation.mutate(s.id); }}
                  title={s.hint}
                  className={cn(
                    'wd-hover rounded border px-2.5 py-2 text-left hover:bg-surface-muted',
                    scenario === s.id
                      ? 'border-neon bg-[color-mix(in_srgb,var(--neon)_10%,transparent)] shadow-glow'
                      : 'border-border-color',
                  )}
                >
                  <span
                    className={cn(
                      'block text-[0.76rem] font-medium',
                      scenario === s.id ? 'text-neon' : 'text-text-primary',
                    )}
                  >
                    {s.label}
                  </span>
                  <span className="mt-0.5 block text-[0.68rem] leading-snug text-text-muted">
                    {s.hint}
                  </span>
                </button>
              ))}
            </div>

            {simulation.isPending && (
              <div className="space-y-2 pt-1">
                <Skeleton className="h-16 w-44" />
                <Skeleton className="h-24 w-full" />
              </div>
            )}
            {simulation.isError && (
              <p className="m-0 text-[0.74rem] text-critical">{(simulation.error as Error).message}</p>
            )}
            {simulation.data && !simulation.isPending && (
              <div className="space-y-3 border-t border-border-color pt-3">
                <ScoreDial score={simulation.data.score.score} state={simulation.data.score.state} />
                <p className="m-0 text-[0.74rem] leading-relaxed text-text-secondary">
                  <span className="font-mono text-text-primary">
                    {simulation.data.release.package}@{simulation.data.release.version}
                  </span>{' '}
                  scored against {simulation.data.baseline.samples} prior release(s) —{' '}
                  {simulation.data.score.summary}
                </p>
                <DeviationTable score={simulation.data.score} />
              </div>
            )}
            {!simulation.data && !simulation.isPending && (
              <EmptyState
                icon={FlaskConical}
                title="Pick a scenario to score it"
                description="Runs entirely against synthetic history — nothing is written to your ledger."
                command={`cwctl trust simulate --scenario ${scenario}`}
              />
            )}
          </CardBody>
        </Card>

        {/* Tracked packages — the ledger */}
        <Card className="cyber-lift">
          <CardHeader
            icon={ShieldCheck}
            title="Tracked packages"
            description="Every package the ledger has observed, worst state first."
            action={
              selected && (
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="wd-hover flex items-center gap-1 rounded border border-border-color bg-surface px-2 py-1 font-mono text-[0.68rem] font-bold uppercase tracking-wider text-text-secondary hover:border-neon hover:text-neon" >
                  <X size={11} aria-hidden="true" /> Clear
                </button>
              )
            }
          />
          {tracked.isError && (
            <CardBody>
              <p className="m-0 text-[0.74rem] text-critical">{(tracked.error as Error).message}</p>
            </CardBody>
          )}
          <DataTable
            columns={ledgerColumns}
            rows={packages}
            rowKey={(p) => `${p.ecosystem}:${p.package}`}
            loading={tracked.isLoading}
            skeletonRows={6}
            onRowClick={(p) => setSelected(p)}
            initialSort={{ key: 'score', dir: 'asc' }}
            maxHeightClass="max-h-[420px]"
            rowClassName={(p) =>
              selected?.package === p.package && selected?.ecosystem === p.ecosystem
                ? 'bg-[color-mix(in_srgb,var(--neon)_10%,transparent)]'
                : undefined
            }
            empty={{
              icon: ShieldCheck,
              title: 'No observations recorded yet',
              description: 'The ledger learns from scan output — feed it one scan and it starts tracking.',
              command: LEDGER_COMMAND,
            }}
          />
          {tracked.data?.store && (
            <CardFooter className="font-mono text-[0.68rem]">
              <span className="truncate">Ledger: {tracked.data.store}</span>
              <span className="shrink-0">cwctl trust list</span>
            </CardFooter>
          )}
        </Card>
      </div>

      {/* Selected package detail */}
      {selected && (
        <Card className="cyber-lift">
          <CardHeader
            icon={Radar}
            title={`${selected.ecosystem}:${selected.package}`}
            description="Learned baseline, observed history and the deviations behind the current score."
            action={
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="wd-hover flex items-center gap-1 rounded border border-border-color bg-surface px-2 py-1 font-mono text-[0.68rem] font-bold uppercase tracking-wider text-text-secondary hover:border-neon hover:text-neon" >
                <X size={11} aria-hidden="true" /> Close
              </button>
            }
          />
          {detail.isLoading && (
            <CardBody>
              <Skeleton className="h-16 w-44" />
              <Skeleton className="mt-3 h-40 w-full" />
            </CardBody>
          )}
          {detail.isError && (
            <CardBody>
              <p className="m-0 text-[0.74rem] text-critical">{(detail.error as Error).message}</p>
            </CardBody>
          )}
          {detail.data && (
            <>
              <CardBody className="space-y-3">
                <ScoreDial score={detail.data.score.score} state={detail.data.score.state} />
                <p className="m-0 text-[0.74rem] leading-relaxed text-text-secondary">
                  {detail.data.score.summary}
                </p>
              </CardBody>
              <ObservationChart observations={detail.data.observations} />
              <BaselineTable baseline={detail.data.baseline} />
              <div className="border-t border-border-color">
                <DeviationTable score={detail.data.score} />
              </div>
            </>
          )}
        </Card>
      )}

      {selected && <ReleaseDelta ecosystem={selected.ecosystem} pkg={selected.package} />}
    </div>
  );
}

export default TrustPage;

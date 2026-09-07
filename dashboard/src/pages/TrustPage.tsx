import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Gauge, ShieldCheck, ShieldAlert, Activity, FlaskConical, Radar, ChevronRight,
  Lock, ArrowLeftRight, RefreshCw,
} from 'lucide-react';
import {
  listTrust, getTrust, simulateTrust, getTrustLock, getTrustDiff,
  type TrustSummary, type TrustScore, type TrustBaseline, type TrustObservation,
  type TrustVersionDiff, type TrustDrift, type TrustMetricDelta, type TrustLockView,
} from '../lib/api';
import { cn } from '../components/ui/utils';

const SCENARIOS = [
  { id: 'hijack',   label: 'Publish hijack',     hint: 'Stolen token adds an install hook that phones home' },
  { id: 'sleeper',  label: 'Sleeper drift',      hint: 'Payload assembled slowly across several releases' },
  { id: 'takeover', label: 'Maintainer takeover', hint: 'New publisher, then an out-of-cadence release' },
  { id: 'clean',    label: 'Healthy release',    hint: 'Control case — should stay GREEN' },
] as const;

const STATE_COLOR: Record<string, string> = {
  GREEN:    'var(--success)',
  AMBER:    'var(--warning)',
  RED:      'var(--critical)',
  LEARNING: 'var(--text-muted)',
};

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: 'var(--critical)',
  HIGH:     '#EA580C',
  MEDIUM:   'var(--warning)',
  LOW:      'var(--cyan)',
};

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-border-color bg-surface shadow-sm', className)}>
      {children}
    </div>
  );
}

function KPITile({ label, value, icon: Icon, color }: {
  label: string; value: number | string; icon: typeof Gauge; color: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r-sm" style={{ background: color }} />
      <div className="p-4 pl-5">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Icon size={13} className="text-text-muted" />
          <span className="text-[0.68rem] text-text-secondary">{label}</span>
        </div>
        <span className="text-[1.6rem] font-bold tabular-nums leading-none" style={{ color }}>{value}</span>
      </div>
    </Card>
  );
}

function StateBadge({ state }: { state: string }) {
  const color = STATE_COLOR[state] ?? 'var(--text-muted)';
  return (
    <span
      className="rounded-full px-2 py-[0.1rem] text-[0.62rem] font-semibold tracking-wide"
      style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      {state}
    </span>
  );
}

function ScoreDial({ score, state }: { score: number; state: string }) {
  const color = STATE_COLOR[state] ?? 'var(--text-muted)';
  const pct = Math.max(0, Math.min(100, score));
  return (
    <div className="flex items-center gap-4">
      <div
        className="grid h-[76px] w-[76px] shrink-0 place-items-center rounded-full"
        style={{ background: `conic-gradient(${color} ${pct * 3.6}deg, var(--surface-muted) 0deg)` }}
      >
        <div className="grid h-[60px] w-[60px] place-items-center rounded-full bg-surface">
          <span className="text-[1.1rem] font-bold tabular-nums" style={{ color }}>{score}</span>
        </div>
      </div>
      <div>
        <StateBadge state={state} />
        <p className="mt-1 text-[0.68rem] text-text-muted">trust score out of 100</p>
      </div>
    </div>
  );
}

function DeviationList({ score }: { score: TrustScore }) {
  if (score.deviations.length === 0) {
    return (
      <p className="px-4 pb-4 text-[0.72rem] text-text-muted">
        No behavioural drift against the learned baseline.
      </p>
    );
  }
  return (
    <ul className="space-y-2 px-4 pb-4">
      {score.deviations.map((d) => (
        <li key={d.metric} className="rounded-lg border border-border-color/70 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className="rounded px-1.5 py-[0.05rem] text-[0.6rem] font-semibold"
                style={{
                  color: SEVERITY_COLOR[d.severity] ?? 'var(--text-muted)',
                  background: `color-mix(in srgb, ${SEVERITY_COLOR[d.severity] ?? '#888'} 14%, transparent)`,
                }}
              >
                {d.severity}
              </span>
              <span className="text-[0.75rem] font-medium text-text-primary">{d.label}</span>
            </div>
            <span className="text-[0.7rem] tabular-nums text-text-secondary">
              −{d.deduction} pts · z={d.z_score.toFixed(1)}
            </span>
          </div>
          <p className="mt-1 text-[0.7rem] leading-snug text-text-muted">{d.reason}</p>
        </li>
      ))}
    </ul>
  );
}

function BaselineTable({ baseline }: { baseline: TrustBaseline }) {
  const rows = baseline.stats.filter((s) => s.mean !== 0 || s.max !== 0);
  if (rows.length === 0) return null;
  return (
    <div className="px-4 pb-4">
      <table className="w-full text-[0.7rem]">
        <thead>
          <tr className="text-left text-text-muted">
            <th className="pb-1 font-medium">Metric</th>
            <th className="pb-1 text-right font-medium">Mean</th>
            <th className="pb-1 text-right font-medium">Std dev</th>
            <th className="pb-1 text-right font-medium">Range</th>
          </tr>
        </thead>
        <tbody className="tabular-nums text-text-secondary">
          {rows.map((s) => (
            <tr key={s.metric} className="border-t border-border-color/60">
              <td className="py-1 text-text-primary">{s.label}</td>
              <td className="py-1 text-right">{s.mean.toFixed(2)}</td>
              <td className="py-1 text-right">{s.stddev.toFixed(2)}</td>
              <td className="py-1 text-right">{s.min}–{s.max}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ObservationChart({ observations }: { observations: TrustObservation[] }) {
  if (observations.length < 2) return null;
  const data = observations.map((o) => ({
    version: o.version || new Date(o.observed_at).toLocaleDateString(),
    network: o.metrics.network_calls,
    hooks: o.metrics.install_hooks,
    obfuscation: o.metrics.obfuscation_score,
  }));
  return (
    <div className="h-[190px] px-2 pb-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
          <XAxis dataKey="version" tick={{ fontSize: 10 }} stroke="var(--text-muted)" />
          <YAxis tick={{ fontSize: 10 }} stroke="var(--text-muted)" />
          <RechartsTooltip contentStyle={{ fontSize: '0.7rem', borderRadius: 8 }} />
          <Legend wrapperStyle={{ fontSize: '0.65rem' }} />
          <Line type="monotone" dataKey="network" name="Network calls" stroke="#06B6D4" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="hooks" name="Install hooks" stroke="#EA580C" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="obfuscation" name="Obfuscation" stroke="#7C3AED" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

const DRIFT_COLOR: Record<string, string> = {
  'behaviour-changed': 'var(--critical)',
  'trust-dropped': 'var(--warning)',
  added: 'var(--amber)',
  removed: 'var(--text-muted)',
};

function DeltaTable({ deltas }: { deltas: TrustMetricDelta[] }) {
  if (deltas.length === 0) {
    return (
      <p className="px-4 pb-4 text-[0.72rem] text-text-muted">
        No metric drift — behaviour is identical between these releases.
      </p>
    );
  }
  return (
    <div className="px-4 pb-4">
      <table className="w-full text-[0.7rem]">
        <thead>
          <tr className="text-left text-text-muted">
            <th className="pb-1 font-medium">Metric</th>
            <th className="pb-1 text-right font-medium">From</th>
            <th className="pb-1 text-right font-medium">To</th>
            <th className="pb-1 text-right font-medium">Δ</th>
            <th className="pb-1 pl-2 font-medium">Risk</th>
          </tr>
        </thead>
        <tbody className="tabular-nums text-text-secondary">
          {deltas.map((d) => (
            <tr key={d.metric} className="border-t border-border-color/60">
              <td className="py-1 text-text-primary">{d.label}</td>
              <td className="py-1 text-right">{d.from.toFixed(2)}</td>
              <td className="py-1 text-right">{d.to.toFixed(2)}</td>
              <td className="py-1 text-right">{d.delta > 0 ? '+' : ''}{d.delta.toFixed(2)}</td>
              <td className="py-1 pl-2 text-right">
                {d.riskier
                  ? <span className="font-bold" style={{ color: 'var(--warning)' }}>!</span>
                  : <span className="text-text-muted">·</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DriftRow({ drift }: { drift: TrustDrift }) {
  const color = DRIFT_COLOR[drift.kind] ?? 'var(--text-muted)';
  return (
    <li className="rounded-lg border border-border-color/70 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="rounded px-1.5 py-[0.05rem] text-[0.6rem] font-semibold"
            style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
          >
            {drift.kind}
          </span>
          <span className="text-[0.75rem] font-medium text-text-primary">
            {drift.ecosystem}:{drift.package}
          </span>
        </div>
        {(drift.from_score !== undefined || drift.to_score !== undefined) && (
          <span className="text-[0.68rem] tabular-nums text-text-secondary">
            {drift.from_version ?? ''} {drift.from_score !== undefined ? `(${drift.from_score})` : ''}
            {drift.to_version || drift.from_version ? ' → ' : ''}
            {drift.to_version ?? ''} {drift.to_score !== undefined ? `(${drift.to_score})` : ''}
          </span>
        )}
      </div>
      {drift.message && <p className="mt-1 text-[0.7rem] text-text-muted">{drift.message}</p>}
      {drift.metric_deltas && drift.metric_deltas.length > 0 && (
        <div className="mt-2">
          <DeltaTable deltas={drift.metric_deltas} />
        </div>
      )}
    </li>
  );
}

function LockPanel() {
  const lock = useQuery({ queryKey: ['trust-lock'], queryFn: getTrustLock, refetchInterval: 60_000 });

  return (
    <Card>
      <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <Lock size={14} className="text-text-muted" />
          <span className="text-[0.78rem] font-semibold text-text-primary">Behavioural lockfile</span>
        </div>
        <button
          onClick={() => lock.refetch()}
          title="Re-verify against the lockfile"
          className="flex items-center gap-1 text-[0.68rem] text-text-muted hover:text-text-primary"
        >
          <RefreshCw size={11} /> re-check
        </button>
      </div>

      {lock.isLoading && <p className="px-4 pb-4 text-[0.72rem] text-text-muted">Reading ledger…</p>}
      {lock.isError && (
        <p className="px-4 pb-4 text-[0.72rem]" style={{ color: 'var(--critical)' }}>
          {(lock.error as Error).message}
        </p>
      )}
      {lock.data && <LockPanelBody data={lock.data} />}
    </Card>
  );
}

function LockPanelBody({ data }: { data: TrustLockView }) {
  const report = data.report;
  if (!data.present) {
    return (
      <div className="px-4 pb-4">
        <p className="text-[0.72rem] leading-relaxed text-text-secondary">
          No <code className="rounded bg-surface-muted px-1 py-[0.05rem]">chainwarden.lock</code> in the
          server directory yet — the ledger currently holds{' '}
          <span className="font-semibold text-text-primary">{data.tracked}</span> package(s).
        </p>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-surface-muted p-2.5 text-[0.68rem] leading-relaxed">
{`# freezes current behaviour into ./chainwarden.lock
cwctl trust lock`}
        </pre>
      </div>
    );
  }

  const ok = report?.ok ?? false;
  const summaryColor = ok ? 'var(--success)' : 'var(--critical)';
  return (
    <div className="px-4 pb-4">
      <div className="flex flex-wrap items-center gap-3 text-[0.72rem]">
        <span
          className="rounded-full px-2 py-[0.1rem] text-[0.62rem] font-semibold tracking-wide"
          style={{ color: summaryColor, background: `color-mix(in srgb, ${summaryColor} 14%, transparent)` }}
        >
          {ok ? 'VERIFIED' : 'DRIFTED'}
        </span>
        <span className="tabular-nums text-text-secondary">checked {report?.checked ?? 0}</span>
        <span className="tabular-nums text-text-secondary">matched {report?.matched ?? 0}</span>
        <span className="tabular-nums text-text-secondary">drifts {report?.drifts.length ?? 0}</span>
        <span className="text-text-muted">{data.lockfile}</span>
        <span className="text-text-muted">{data.lock?.generated ? `generated ${new Date(data.lock!.generated!).toLocaleString()}` : ''}</span>
      </div>

      {ok && (
        <p className="mt-3 text-[0.72rem] text-text-secondary">
          Every tracked package still matches the behavioural fingerprint locked at{' '}
          {data.lock?.generated ? new Date(data.lock!.generated!).toLocaleString() : 'generation'} time.
        </p>
      )}

      {!ok && report?.drifts.length ? (
        <ul className="mt-3 space-y-2">
          {report.drifts.map((drift, i) => (
            <DriftRow key={`${drift.kind}-${drift.ecosystem}:${drift.package}-${i}`} drift={drift} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ReleaseDelta({ ecosystem, pkg }: { ecosystem: string; pkg: string }) {
  const diff = useQuery({
    queryKey: ['trust-diff', ecosystem, pkg],
    queryFn: () => getTrustDiff(ecosystem, pkg),
    enabled: !!ecosystem && !!pkg,
  });

  return (
    <Card>
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <ArrowLeftRight size={14} className="text-text-muted" />
        <span className="text-[0.78rem] font-semibold text-text-primary">
          Release delta — previous → current
        </span>
      </div>

      {diff.isLoading && <p className="px-4 pb-4 text-[0.72rem] text-text-muted">Comparing releases…</p>}
      {diff.isError && (
        <p className="px-4 pb-4 text-[0.72rem] text-text-muted">
          {(diff.error as Error).message}
        </p>
      )}
      {diff.data && <ReleaseDeltaBody data={diff.data} />}
    </Card>
  );
}

function ReleaseDeltaBody({ data }: { data: TrustVersionDiff }) {
  return (
    <div className="px-4 pb-3">
      <p className="text-[0.72rem] text-text-secondary">
        <span className="tabular-nums">{data.from_version}</span> →{' '}
        <span className="tabular-nums">{data.to_version}</span>
        <span className="ml-2 tabular-nums">
          {data.from_score} ({data.from_state.toLowerCase()}) → {data.to_score} ({data.to_state.toLowerCase()})
        </span>
      </p>
      <div className="mt-2">
        <DeltaTable deltas={data.metric_deltas} />
      </div>
    </div>
  );
}

export function TrustPage() {
  const [scenario, setScenario] = useState<string>('hijack');
  const [selected, setSelected] = useState<TrustSummary | null>(null);

  const tracked = useQuery({ queryKey: ['trust-list'], queryFn: listTrust, refetchInterval: 30_000 });

  const detail = useQuery({
    queryKey: ['trust-detail', selected?.ecosystem, selected?.package],
    queryFn: () => getTrust(selected!.ecosystem, selected!.package),
    enabled: !!selected,
  });

  const simulation = useMutation({
    mutationFn: (id: string) => simulateTrust(id),
  });

  const states = tracked.data?.states ?? {};

  return (
    <div className="space-y-4 p-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-[1.05rem] font-semibold text-text-primary">
            <Radar size={17} className="text-primary-blue" />
            Dynamic Trust Score
          </h1>
          <p className="mt-1 max-w-3xl text-[0.74rem] leading-relaxed text-text-secondary">
            Signature scanning catches malware we have already seen. The trust engine catches a package that
            stops behaving like <em>itself</em> — a new install hook, an outbound call it never made, a
            maintainer who appeared yesterday. Every release is scored against the statistical baseline learned
            from its own history.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPITile label="Packages tracked" value={tracked.data?.tracked ?? 0} icon={Activity} color="var(--primary)" />
        <KPITile label="Average trust" value={tracked.data?.average_score ?? 100} icon={Gauge} color="var(--teal)" />
        <KPITile label="Amber" value={states.AMBER ?? 0} icon={ShieldAlert} color="var(--warning)" />
        <KPITile label="Red" value={states.RED ?? 0} icon={ShieldAlert} color="var(--critical)" />
      </div>

      {/* Behavioural lockfile: verified vs drifted, with per-drift metric deltas */}
      <LockPanel />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── Simulation ── */}
        <Card>
          <div className="flex items-center gap-2 px-4 pt-3 pb-2">
            <FlaskConical size={14} className="text-text-muted" />
            <span className="text-[0.78rem] font-semibold text-text-primary">Drift simulator</span>
          </div>
          <p className="px-4 pb-3 text-[0.7rem] text-text-muted">
            Replay a compromise pattern against a synthetic release history — no data required.
          </p>
          <div className="grid grid-cols-2 gap-2 px-4 pb-3">
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                onClick={() => { setScenario(s.id); simulation.mutate(s.id); }}
                title={s.hint}
                className={cn(
                  'rounded-lg border px-2.5 py-2 text-left text-[0.7rem] transition-colors',
                  scenario === s.id
                    ? 'border-primary-blue bg-blue-light text-primary-blue'
                    : 'border-border-color text-text-secondary hover:bg-surface-muted',
                )}
              >
                <span className="block font-medium">{s.label}</span>
                <span className="mt-0.5 block text-[0.62rem] leading-snug text-text-muted">{s.hint}</span>
              </button>
            ))}
          </div>

          {simulation.isPending && (
            <p className="px-4 pb-4 text-[0.72rem] text-text-muted">Running simulation…</p>
          )}
          {simulation.isError && (
            <p className="px-4 pb-4 text-[0.72rem]" style={{ color: 'var(--critical)' }}>
              {(simulation.error as Error).message}
            </p>
          )}
          {simulation.data && !simulation.isPending && (
            <>
              <div className="px-4 pb-3">
                <ScoreDial score={simulation.data.score.score} state={simulation.data.score.state} />
                <p className="mt-2 text-[0.7rem] text-text-secondary">
                  {simulation.data.release.package}@{simulation.data.release.version} scored against{' '}
                  {simulation.data.baseline.samples} prior release(s) — {simulation.data.score.summary}
                </p>
              </div>
              <BaselineTable baseline={simulation.data.baseline} />
              <DeviationList score={simulation.data.score} />
            </>
          )}
          {!simulation.data && !simulation.isPending && (
            <p className="px-4 pb-4 text-[0.72rem] text-text-muted">
              Pick a scenario to score it. Equivalent CLI:{' '}
              <code className="rounded bg-surface-muted px-1 py-[0.05rem]">cwctl trust simulate --scenario {scenario}</code>
            </p>
          )}
        </Card>

        {/* ── Tracked packages ── */}
        <Card>
          <div className="flex items-center gap-2 px-4 pt-3 pb-2">
            <ShieldCheck size={14} className="text-text-muted" />
            <span className="text-[0.78rem] font-semibold text-text-primary">Tracked packages</span>
          </div>

          {tracked.isLoading && <p className="px-4 pb-4 text-[0.72rem] text-text-muted">Loading ledger…</p>}
          {tracked.isError && (
            <p className="px-4 pb-4 text-[0.72rem]" style={{ color: 'var(--critical)' }}>
              {(tracked.error as Error).message}
            </p>
          )}

          {tracked.data && tracked.data.packages.length === 0 && (
            <div className="px-4 pb-4 text-[0.72rem] text-text-muted">
              <p>No observations recorded yet. Feed the ledger from a scan:</p>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-surface-muted p-2.5 text-[0.68rem] leading-relaxed">
{`cwctl scan . --format json > scan.json
cwctl trust from-scan scan.json --package npm:express
cwctl trust list`}
              </pre>
            </div>
          )}

          {tracked.data && tracked.data.packages.length > 0 && (
            <ul className="pb-2">
              {tracked.data.packages.map((pkg) => (
                <li key={`${pkg.ecosystem}:${pkg.package}`}>
                  <button
                    onClick={() => setSelected(pkg)}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 px-4 py-2 text-left transition-colors hover:bg-surface-muted',
                      selected?.package === pkg.package && selected?.ecosystem === pkg.ecosystem && 'bg-surface-muted',
                    )}
                  >
                    <div className="min-w-0">
                      <span className="block truncate text-[0.75rem] font-medium text-text-primary">
                        {pkg.ecosystem}:{pkg.package}
                      </span>
                      <span className="block truncate text-[0.66rem] text-text-muted">
                        {pkg.version ? `${pkg.version} · ` : ''}{pkg.samples} observation(s) · {pkg.summary}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className="text-[0.85rem] font-bold tabular-nums"
                        style={{ color: STATE_COLOR[pkg.state] ?? 'var(--text-muted)' }}
                      >
                        {pkg.score}
                      </span>
                      <StateBadge state={pkg.state} />
                      <ChevronRight size={13} className="text-text-muted" />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {tracked.data?.store && (
            <p className="px-4 pb-3 text-[0.62rem] text-text-muted">Ledger: {tracked.data.store}</p>
          )}
        </Card>
      </div>

      {/* ── Selected package detail ── */}
      {selected && (
        <Card>
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <span className="text-[0.78rem] font-semibold text-text-primary">
              {selected.ecosystem}:{selected.package}
            </span>
            <button
              onClick={() => setSelected(null)}
              className="text-[0.68rem] text-text-muted hover:text-text-primary"
            >
              Close
            </button>
          </div>

          {detail.isLoading && <p className="px-4 pb-4 text-[0.72rem] text-text-muted">Loading baseline…</p>}
          {detail.isError && (
            <p className="px-4 pb-4 text-[0.72rem]" style={{ color: 'var(--critical)' }}>
              {(detail.error as Error).message}
            </p>
          )}
          {detail.data && (
            <>
              <div className="px-4 pb-3">
                <ScoreDial score={detail.data.score.score} state={detail.data.score.state} />
                <p className="mt-2 text-[0.7rem] text-text-secondary">{detail.data.score.summary}</p>
              </div>
              <ObservationChart observations={detail.data.observations} />
              <BaselineTable baseline={detail.data.baseline} />
              <DeviationList score={detail.data.score} />
            </>
          )}
        </Card>
      )}

      {/* Release delta for the selected package (previous vs latest) */}
      {selected && <ReleaseDelta ecosystem={selected.ecosystem} pkg={selected.package} />}
    </div>
  );
}

export default TrustPage;

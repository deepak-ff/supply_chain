import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Siren, X } from 'lucide-react';
import { listAlerts, dismissAlert } from '../lib/api';
import type { Severity } from '../types/api';
import { Card, CardHeader, CardBody } from '../components/ui/card';
import { StatusChip } from '../components/ui/status-chip';
import { EmptyState } from '../components/EmptyState';
import { CyberKicker } from '../components/cyber/CyberViz';
import { cn } from '../components/ui/utils';

const SEV_DOT: Record<string, string> = {
  CRITICAL: 'bg-critical shadow-[0_0_8px_var(--critical)]',
  HIGH: 'bg-warning shadow-[0_0_8px_var(--warning)]',
  MEDIUM: 'bg-amber shadow-[0_0_8px_var(--amber)]',
  LOW: 'bg-neon shadow-[0_0_8px_var(--neon)]',
  INFORMATIONAL: 'bg-teal shadow-[0_0_8px_var(--teal)]',
};

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function AlertsPage() {
  const qc = useQueryClient();
  const [sevFilter, setSevFilter] = useState<string>('ALL');
  const [showDismissed, setShowDismissed] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['alerts', sevFilter, showDismissed],
    queryFn: () => listAlerts({
      page_size: 100,
      severity: sevFilter === 'ALL' ? undefined : sevFilter,
      dismissed: showDismissed ? undefined : false,
    }),
    refetchInterval: 15_000,
  });

  const dismiss = useMutation({
    mutationFn: (id: number) => dismissAlert(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });

  const alerts = data?.alerts ?? [];
  const severities = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL'];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <CyberKicker index="O-04" label="overwatch // red alerts" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="m-0 flex items-center gap-2 text-[1.15rem] font-bold tracking-tight text-text-primary">
              <Siren size={18} className="text-critical drop-shadow-[0_0_8px_var(--critical)]" aria-hidden="true" />
              Red Alerts
            </h1>
            <p className="m-0 mt-1 text-[0.78rem] text-text-secondary">
              Threat pings from every engine.
              {data?.total !== undefined && (
                <span className="ml-1 font-mono font-bold text-magenta">({data.total} live)</span>
              )}
            </p>
          </div>
          <label className="flex cursor-pointer items-center gap-2 font-mono text-[0.7rem] uppercase tracking-wider text-text-muted">
            <input
              type="checkbox"
              checked={showDismissed}
              onChange={e => setShowDismissed(e.target.checked)}
              className="h-3.5 w-3.5 accent-[var(--neon)]"
            />
            show neutralized
          </label>
        </div>
      </div>

      {/* Severity filter */}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by severity">
        {severities.map(s => {
          const active = sevFilter === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setSevFilter(s)}
              aria-pressed={active}
              className={cn(
                'wd-hover rounded border px-2.5 py-1 font-mono text-[0.68rem] font-bold tracking-wider',
                active
                  ? 'border-neon bg-[color-mix(in_srgb,var(--neon)_14%,transparent)] text-neon shadow-glow'
                  : 'border-border-color bg-surface text-text-muted hover:border-neon hover:text-neon',
              )}
            >
              {s}
            </button>
          );
        })}
      </div>

      {/* Alert list */}
      <Card className="cyber-lift">
        <CardHeader
          title="Incoming signals"
          description={isLoading ? 'Tuning the wire…' : `${alerts.length} signal${alerts.length !== 1 ? 's' : ''} on screen`}
          action={
            <span aria-hidden="true" className="sonar h-2 w-2 rounded-full bg-critical text-critical" />
          }
        />
        <CardBody className="flex flex-col gap-0 p-0">
          {isLoading && (
            <p className="m-0 animate-pulse px-4 py-8 text-center font-mono text-[0.78rem] text-text-muted">
              {'// listening for signals…'}
            </p>
          )}
          {!isLoading && alerts.length === 0 && (
            <div className="px-4 py-6">
              <EmptyState
                icon={Siren}
                title="Wire is quiet"
                description="No alerts at this severity. Run a probe to generate signals."
                command="cwctl scan ."
              />
            </div>
          )}
          {alerts.map((al, i) => (
            <div
              key={al.id}
              className={cn(
                'flex items-start gap-3 px-4 py-3',
                i < alerts.length - 1 && 'border-b border-border-color',
                al.dismissed && 'opacity-45',
              )}
            >
              <span
                aria-hidden="true"
                className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', SEV_DOT[al.severity as Severity] ?? 'bg-text-muted')}
              />
              <div className="min-w-0 flex-1">
                <p className="m-0 text-[0.8rem] leading-snug text-text-primary">{al.message}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <StatusChip tone={al.severity} dot={false} />
                  {al.package_name && (
                    <span className="truncate font-mono text-[0.7rem] text-neon">
                      {al.ecosystem ? `${al.ecosystem}/` : ''}{al.package_name}{al.version ? `@${al.version}` : ''}
                    </span>
                  )}
                </div>
              </div>
              <span className="shrink-0 whitespace-nowrap font-mono text-[0.66rem] text-text-muted">
                {relativeTime(al.occurred_at)}
              </span>
              {!al.dismissed && (
                <button
                  type="button"
                  onClick={() => dismiss.mutate(al.id)}
                  title="Neutralize alert"
                  aria-label="Neutralize alert"
                  className="wd-hover grid h-6 w-6 shrink-0 place-items-center rounded border border-transparent bg-transparent text-text-muted hover:border-neon hover:text-neon"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}

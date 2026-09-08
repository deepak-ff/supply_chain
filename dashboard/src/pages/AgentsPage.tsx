import { Bot, Radio, Trash2, Cpu } from 'lucide-react';
import { useAgentStream } from '../hooks/useAgentStream';
import { Card, CardHeader, CardBody } from '../components/ui/card';
import { EmptyState } from '../components/EmptyState';
import { CyberKicker } from '../components/cyber/CyberViz';
import { cn } from '../components/ui/utils';

const TYPE_TONE: Record<string, string> = {
  start: 'text-neon',
  step: 'text-teal',
  patch: 'text-success',
  done: 'text-success',
  error: 'text-critical',
};

function relTime(s: string) {
  const diff = Date.now() - new Date(s).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export function AgentsPage() {
  const { events, connected, error, clear } = useAgentStream();
  // events are newest-first (useAgentStream prepends) and the log spans
  // every session ever seen this page load, so "active" must be scoped to
  // the most recent session_id — otherwise an old session's terminal
  // 'done'/'error' event permanently masks a brand-new session's 'start'.
  const latestSessionId = events.find(e => e.session_id)?.session_id;
  const latestSessionEvents = latestSessionId
    ? events.filter(e => e.session_id === latestSessionId)
    : events;
  const active = latestSessionEvents.some(e => e.type === 'start') &&
                 !latestSessionEvents.some(e => e.type === 'done' || e.type === 'error');

  return (
    <div className="flex flex-col gap-5">
      <div>
        <CyberKicker index="R-04" label="recon // fix operatives" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="m-0 flex items-center gap-2 text-[1.15rem] font-bold tracking-tight text-text-primary">
              <Cpu size={18} className="text-magenta drop-shadow-[0_0_8px_var(--magenta)]" aria-hidden="true" />
              Fix Operatives
            </h1>
            <p className="m-0 mt-1 text-[0.78rem] text-text-secondary">
              Live feed of autonomous patch-operative sessions.
            </p>
          </div>
          <span className={cn(
            'flex items-center gap-2 rounded border px-2.5 py-1.5 font-mono text-[0.66rem] font-bold tracking-widest',
            connected
              ? 'border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_8%,transparent)] text-success'
              : 'border-[color-mix(in_srgb,var(--critical)_30%,transparent)] bg-[color-mix(in_srgb,var(--critical)_8%,transparent)] text-critical',
          )}>
            <span className={cn('h-1.5 w-1.5 rounded-full', connected ? 'sonar bg-success text-success' : 'bg-critical')} aria-hidden="true" />
            {connected ? 'UPLINK LIVE' : 'UPLINK DOWN'}
          </span>
        </div>
      </div>

      {/* Session status */}
      <Card className="cyber-lift">
        <CardBody className="flex items-center gap-3">
          {active
            ? <Radio size={18} className="shrink-0 text-success drop-shadow-[0_0_8px_var(--success)]" />
            : <Bot size={18} className="shrink-0 text-text-muted" />}
          <div className="min-w-0">
            <p className={cn('m-0 font-mono text-[0.78rem] font-bold tracking-widest', active ? 'text-success' : 'text-text-muted')}>
              {active ? '// OPERATIVE IN THE FIELD' : '// NO OPERATIVE DEPLOYED'}
            </p>
            <p className="m-0 mt-0.5 text-[0.74rem] text-text-secondary">
              {active
                ? 'Patch operative is active. Events stream below in real time.'
                : 'Deploy one from the CLI — events will appear here automatically.'}
            </p>
            {error && <p className="m-0 mt-1 font-mono text-[0.72rem] text-critical">{error}</p>}
          </div>
        </CardBody>
      </Card>

      {/* Live event feed */}
      {events.length > 0 ? (
        <Card className="cyber-lift">
          <CardHeader
            title={`Operative event log · ${events.length}`}
            description="Newest findings first"
            action={
              <button
                type="button"
                onClick={clear}
                className="wd-hover flex items-center gap-1 rounded border border-transparent bg-transparent px-2 py-1 font-mono text-[0.66rem] font-bold uppercase tracking-widest text-text-muted hover:border-neon hover:text-neon"
              >
                <Trash2 size={12} /> purge
              </button>
            }
          />
          <CardBody className="max-h-[340px] overflow-y-auto p-0">
            {events.map((ev, i) => (
              <div
                key={i}
                className={cn('flex items-start gap-3 px-4 py-2', i < events.length - 1 && 'border-b border-border-color')}
              >
                <span className={cn('w-[52px] shrink-0 pt-0.5 font-mono text-[0.64rem] font-bold uppercase', TYPE_TONE[ev.type] ?? 'text-text-primary')}>
                  {ev.type}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-[0.78rem] leading-snug text-text-primary">{ev.message}</p>
                  {ev.package && (
                    <p className="m-0 mt-0.5 truncate font-mono text-[0.7rem] text-neon">
                      {ev.package}{ev.version ? `@${ev.version}` : ''}
                    </p>
                  )}
                </div>
                <span className="shrink-0 whitespace-nowrap font-mono text-[0.64rem] text-text-muted">
                  {relTime(ev.occurred_at)}
                </span>
              </div>
            ))}
          </CardBody>
        </Card>
      ) : (
        <Card className="cyber-lift">
          <CardBody>
            <EmptyState
              icon={Bot}
              title="No operative traffic yet"
              description="Deploy an operative from the CLI and watch it work here."
              command="cwctl patch . --dry-run"
            />
          </CardBody>
        </Card>
      )}

      {/* CLI hint */}
      <Card className="cyber-lift">
        <CardHeader title="Deployment orders" description="Launch an operative from your terminal" />
        <CardBody className="flex flex-col gap-2">
          {[
            'cwctl patch .                      # patch current project',
            'cwctl patch . --severity=high      # high+ findings only',
            'cwctl patch . --dry-run            # preview proposed changes',
          ].map(c => (
            <code key={c} className="overflow-x-auto whitespace-pre rounded border border-border-color bg-bg-base px-3 py-2 font-mono text-[0.74rem] text-neon">
              <span className="mr-2 select-none text-magenta">$</span>{c}
            </code>
          ))}
          <p className="m-0 mt-1 font-mono text-[0.68rem] text-text-muted">
            {'// requires an AI provider key — see Settings to arm it.'}
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

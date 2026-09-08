import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Terminal, Package, FileCode, Beer, Gem, Container, Binary, AlertCircle, Activity, ShieldAlert, Clock, Play, Loader, CheckCircle, Fingerprint } from 'lucide-react';
import { getAuditStats, getDashboardStats, getHealth, triggerAudit, getAuditJobStatus } from '../lib/api';
import { Skeleton } from '../components/ui/skeleton';
import { MetricCard } from '../components/MetricCard';
import { ActivityFeed } from '../components/ActivityFeed';
import { Card, CardHeader, CardBody } from '../components/ui/card';
import { StatTile } from '../components/ui/stat-tile';
import { CyberKicker } from '../components/cyber/CyberViz';
import { cn } from '../components/ui/utils';

const ECOSYSTEMS = [
  { label: 'npm (global)',   icon: Package,  hint: 'npm -g list' },
  { label: 'Python (pip)',   icon: FileCode,  hint: 'pip list' },
  { label: 'Homebrew',       icon: Beer,      hint: 'brew list' },
  { label: 'Ruby gems',      icon: Gem,       hint: 'gem list' },
  { label: 'Cargo bins',     icon: Binary,    hint: 'cargo install --list' },
  { label: 'Go binaries',    icon: Binary,    hint: '$GOPATH/bin' },
  { label: 'Docker images',  icon: Container, hint: 'docker images' },
];

function MonitoringStatusHeader() {
  const health = useQuery({
    queryKey: ['api-health', 'audit-monitor'],
    queryFn: getHealth,
    retry: 3,
    retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 10_000),
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });

  const active = !health.isError && !health.isLoading;
  const reconnecting = health.isLoading && health.failureCount > 0;

  return (
    <Card className="cyber-lift">
      <CardBody className="flex items-center gap-3">
        <span
          className={cn('h-2.5 w-2.5 shrink-0 rounded-full', active ? 'sonar bg-success text-success' : 'bg-warning')}
          aria-hidden="true"
        />
        <div>
          <p className={cn('m-0 font-mono text-[0.8rem] font-bold tracking-widest', active ? 'text-success' : 'text-warning')}>
            {active ? '// WATCH ACTIVE' : reconnecting ? '// REACQUIRING SIGNAL…' : '// WATCH DOWN — API UNREACHABLE'}
          </p>
          <p className="m-0 mt-0.5 text-[0.74rem] text-text-secondary">
            {active
              ? 'Command uplink is live — stats below refresh automatically.'
              : 'Could not reach the command uplink. Start it with `make api` or the docker-compose stack.'}
          </p>
        </div>
      </CardBody>
    </Card>
  );
}

function MonitoringStatsRow() {
  const stats = useQuery({
    queryKey: ['dashboard-stats', 'audit-monitor'],
    queryFn: () => getDashboardStats(),
    refetchInterval: 30_000,
    retry: false,
  });

  const d = stats.data;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <MetricCard
        label="Threats detected"
        value={(d?.critical_findings ?? 0) + (d?.high_findings ?? 0)}
        variant="critical"
        icon={ShieldAlert}
      />
      <MetricCard
        label="Assets monitored"
        value={d?.total_packages ?? 0}
        icon={Package}
      />
      <MetricCard
        label="Last scan"
        value={d?.last_updated ? new Date(d.last_updated).toLocaleTimeString() : 'N/A'}
        icon={Clock}
      />
    </div>
  );
}

const AUDIT_JOB_KEY = 'fg-audit-job-id';
const AUDIT_OUTPUT_KEY = 'fg-audit-output';

function AuditRunner() {
  const [jobId, setJobId] = useState<string | null>(() => {
    try { return sessionStorage.getItem(AUDIT_JOB_KEY); } catch { return null; }
  });
  const [auditOutput, setAuditOutput] = useState<string | null>(() => {
    try { return sessionStorage.getItem(AUDIT_OUTPUT_KEY); } catch { return null; }
  });

  useEffect(() => {
    try {
      if (jobId) sessionStorage.setItem(AUDIT_JOB_KEY, jobId);
      else sessionStorage.removeItem(AUDIT_JOB_KEY);
    } catch {}
  }, [jobId]);

  useEffect(() => {
    try {
      if (auditOutput) sessionStorage.setItem(AUDIT_OUTPUT_KEY, auditOutput);
      else sessionStorage.removeItem(AUDIT_OUTPUT_KEY);
    } catch {}
  }, [auditOutput]);

  const trigger = useMutation({
    mutationFn: triggerAudit,
    onSuccess: (data) => {
      setJobId(data.job_id);
      setAuditOutput(null);
    },
  });

  const jobPoll = useQuery({
    queryKey: ['audit-job', jobId],
    queryFn: () => getAuditJobStatus(jobId!),
    enabled: !!jobId && !auditOutput,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'complete' || status === 'failed') {
        if (status === 'complete' && query.state.data?.result?.output) {
          setAuditOutput(query.state.data.result.output);
        }
        if (status === 'failed') {
          setJobId(null);
        }
        return false;
      }
      return 2_000;
    },
  });

  const isRunning = trigger.isPending || (!!jobId && !auditOutput && jobPoll.data?.status !== 'complete' && jobPoll.data?.status !== 'failed');
  const jobError = trigger.error || (jobPoll.data?.status === 'failed' ? new Error(jobPoll.data.error || 'Audit failed') : undefined);

  return (
    <Card className="cyber-lift">
      <CardHeader
        icon={Terminal}
        title="Run system audit"
        description="Sweep globally installed packages across npm, pip, cargo, go, brew, gem and Docker"
        action={
          <button
            type="button"
            onClick={() => trigger.mutate()}
            disabled={isRunning}
            className="wd-hover flex items-center gap-2 rounded bg-neon px-5 py-2 font-mono text-[0.74rem] font-bold uppercase tracking-widest text-void hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRunning ? <Loader size={14} className="animate-spin" /> : <Play size={14} />}
            {isRunning ? 'Inspecting…' : 'Run host inspect'}
          </button>
        }
      />
      <CardBody className="flex flex-col gap-3">
        {jobError && (
          <div className="flex items-center gap-2 rounded border border-[color-mix(in_srgb,var(--critical)_30%,transparent)] bg-[color-mix(in_srgb,var(--critical)_10%,transparent)] px-3 py-2.5 text-[0.78rem] text-critical">
            <AlertCircle size={14} className="shrink-0" />
            {(jobError as Error).message}
          </div>
        )}

        {auditOutput && (
          <div className="overflow-hidden rounded border border-border-color bg-bg-base">
            <div className="flex items-center gap-2 border-b border-border-color bg-surface px-3.5 py-2.5">
              <CheckCircle size={13} className="text-success" />
              <span className="font-mono text-[0.7rem] font-bold tracking-widest text-success">
                INSPECT COMPLETE
              </span>
            </div>
            <pre className="m-0 max-h-[500px] overflow-y-auto whitespace-pre-wrap break-words p-4 font-mono text-[0.75rem] leading-relaxed text-text-primary">
              {auditOutput}
            </pre>
          </div>
        )}

        {!auditOutput && !isRunning && !jobError && (
          <p className="m-0 font-mono text-[0.72rem] text-text-muted">
            {'// the host is unmapped territory — run the inspect to chart it.'}
          </p>
        )}
      </CardBody>
    </Card>
  );
}

export function SystemAuditPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['audit-stats'],
    queryFn: getAuditStats,
    retry: false,
  });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <CyberKicker index="R-08" label="recon // host inspect" />
        <div className="flex items-center gap-2.5">
          <Fingerprint size={20} className="text-neon drop-shadow-[0_0_8px_var(--neon)]" aria-hidden="true" />
          <div>
            <h1 className="m-0 text-[1.15rem] font-bold tracking-tight text-text-primary">Host Inspect</h1>
            <p className="m-0 mt-0.5 text-[0.78rem] text-text-secondary">
              Interrogate this machine — every global package, every manager, every shadow in $PATH.
            </p>
          </div>
        </div>
      </div>

      {/* Run Audit button + results */}
      <AuditRunner />

      {/* Continuous monitoring */}
      <div className="flex flex-col gap-3">
        <h2 className="m-0 flex items-center gap-2 font-mono text-[0.72rem] font-bold uppercase tracking-[0.18em] text-text-muted">
          <Activity size={13} className="text-neon" />
          Continuous watch
        </h2>
        <MonitoringStatusHeader />
        <MonitoringStatsRow />
        <ActivityFeed />
      </div>

      {/* Signature store stats */}
      <h2 className="m-0 font-mono text-[0.72rem] font-bold uppercase tracking-[0.18em] text-text-muted">
        Signature vault
      </h2>
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-[110px] w-full" />)}
        </div>
      ) : isError ? (
        <Card className="cyber-lift border-critical">
          <CardBody className="flex items-center gap-3">
            <AlertCircle size={16} className="shrink-0 text-critical" />
            <span className="text-[0.82rem] text-critical">{(error as Error).message}</span>
          </CardBody>
        </Card>
      ) : data ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <StatTile label="Total signatures" value={data.total_signatures} icon={ShieldAlert} accent="success" className="cyber-lift" />
            <StatTile label="Malware patterns" value={data.malware_patterns} icon={AlertCircle} accent="critical" className="cyber-lift" />
            <StatTile label="Typosquat targets" value={data.typosquat_targets} icon={AlertCircle} accent="warning" className="cyber-lift" />
            <StatTile label="Behavioral rules" value={data.behavioral_rules} icon={Activity} className="cyber-lift" />
            <StatTile label="Blocklist entries" value={data.blocklist_entries} icon={AlertCircle} accent="critical" className="cyber-lift" />
            <StatTile label="MCP injection rules" value={data.mcp_injection_rules} icon={Terminal} className="cyber-lift" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {data.ecosystems_covered.map(e => (
              <span key={e} className="rounded border border-border-color bg-surface px-2 py-0.5 font-mono text-[0.68rem] text-text-secondary">
                {e}
              </span>
            ))}
            {data.signatures_updated && (
              <span className="font-mono text-[0.68rem] text-text-muted">
                vault sealed {new Date(data.signatures_updated).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      ) : null}

      {/* CLI hints */}
      <Card className="cyber-lift">
        <CardHeader icon={Terminal} title="Field commands" description="Run the inspect without the deck" />
        <CardBody className="flex flex-col gap-3">
          <div>
            <p className="m-0 font-mono text-[0.68rem] text-text-muted">Refresh the signature vault:</p>
            <code className="mt-1 block rounded border border-border-color bg-bg-base px-3 py-2 font-mono text-[0.74rem] text-neon">
              <span className="mr-2 select-none text-magenta">$</span>cwctl intel update
            </code>
          </div>
          <div>
            <p className="m-0 font-mono text-[0.68rem] text-text-muted">Full host inspect from the terminal:</p>
            <code className="mt-1 block rounded border border-border-color bg-bg-base px-3 py-2 font-mono text-[0.74rem] text-neon">
              <span className="mr-2 select-none text-magenta">$</span>cwctl audit system
            </code>
          </div>
          <div>
            <p className="m-0 mt-1 font-mono text-[0.7rem] font-bold text-text-primary">Running in Docker?</p>
            <p className="m-0 mt-1 text-[0.74rem] text-text-secondary">
              Breach the container with <code className="font-mono text-[0.72rem] text-text-primary">docker exec</code>:
            </p>
            <div className="mt-1 flex flex-col gap-2">
              {[
                'docker exec chainwarden cwctl audit system',
                'docker exec chainwarden cwctl scan npm/lodash@4.17.21',
                'docker exec -it chainwarden cwctl doctor',
              ].map(c => (
                <code key={c} className="block overflow-x-auto whitespace-nowrap rounded border border-border-color bg-bg-base px-3 py-2 font-mono text-[0.74rem] text-neon">
                  <span className="mr-2 select-none text-magenta">$</span>{c}
                </code>
              ))}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Ecosystem cards */}
      <div className="flex flex-col gap-3">
        <h2 className="m-0 font-mono text-[0.72rem] font-bold uppercase tracking-[0.18em] text-text-muted">
          Swept ecosystems
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {ECOSYSTEMS.map(eco => (
            <Card key={eco.label} className="cyber-lift">
              <CardBody className="flex items-center gap-3">
                <eco.icon size={20} className="shrink-0 text-neon" />
                <div>
                  <p className="m-0 font-mono text-[0.8rem] font-bold text-text-primary">{eco.label}</p>
                  <p className="m-0 mt-0.5 font-mono text-[0.7rem] text-text-muted">{eco.hint}</p>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>

      {/* PATH check note */}
      <Card className="cyber-lift">
        <CardHeader title="Path shadow check" description="World-writable dirs in $PATH are open doors" />
        <CardBody>
          <p className="m-0 text-[0.8rem] text-text-primary">
            The inspect also hunts world-writable directories in your <code className="font-mono text-[0.76rem] text-neon">$PATH</code> that
            could let an intruder hijack your commands.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

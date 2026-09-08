import { useState } from 'react';
import { Skeleton } from '../components/ui/skeleton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listSignatures, refreshIntelligence } from '../lib/api';
import { SeverityBadge } from '../components/SeverityBadge';
import { Database, RefreshCw, AlertCircle, Plus, Radio } from 'lucide-react';
import { useUIStore } from '../store/ui';
import type { DetectionSignature } from '../types/api';
import { Card, CardHeader, CardBody } from '../components/ui/card';
import { EmptyState } from '../components/EmptyState';
import { CyberKicker } from '../components/cyber/CyberViz';
import { cn } from '../components/ui/utils';

const SIG_TYPES = ['', 'typosquat_target', 'malware_pattern', 'blocklisted_package', 'behavioral_rule', 'mcp_injection_pattern', 'pickle_rule'];
const ECOSYSTEMS = ['', 'npm', 'pypi', 'go', 'rubygems', 'crates', 'maven', 'huggingface', 'mcp'];

function sigTypeTone(t: string) {
  switch (t) {
    case 'blocklisted_package': return 'text-critical';
    case 'malware_pattern': return 'text-critical';
    case 'typosquat_target': return 'text-warning';
    case 'behavioral_rule': return 'text-neon';
    default: return 'text-text-muted';
  }
}

export function IntelligencePage() {
  const [sigType, setSigType] = useState('');
  const [eco, setEco] = useState('');
  const qc = useQueryClient();
  const navigate = useUIStore(s => s.navigate);

  const sigs = useQuery({
    queryKey: ['signatures', sigType, eco],
    queryFn: () => listSignatures({ type: sigType || undefined, ecosystem: eco || undefined }),
  });

  const refresh = useMutation({
    mutationFn: refreshIntelligence,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['signatures'] }),
  });

  const refreshStatusText = refresh.isSuccess
    ? (refresh.data.added > 0
        ? `+${refresh.data.added} fresh findings (${refresh.data.total} in the vault)`
        : `Vault is current (${refresh.data.total} sealed)`)
    : refresh.isError
      ? (refresh.error as Error).message
      : null;

  const renderValue = (s: DetectionSignature) =>
    s.package ?? s.target ?? (s.rule ? s.rule.slice(0, 40) + '…' : s.pattern ?? '—');

  return (
    <div className="flex flex-col gap-5">
      <div>
        <CyberKicker index="X-04" label="archives // signal intel" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Radio size={20} className="text-neon drop-shadow-[0_0_8px_var(--neon)]" aria-hidden="true" />
            <div>
              <h1 className="m-0 text-[1.15rem] font-bold tracking-tight text-text-primary">Signal Intel</h1>
              <p className="m-0 mt-0.5 text-[0.78rem] text-text-secondary">
                Live detection signatures, tuned by the agent from OSV, OpenSSF and popularity feeds.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/intel/new')}
              className="wd-hover flex items-center gap-2 rounded border border-border-color bg-transparent px-3 py-2 font-mono text-[0.72rem] font-bold uppercase tracking-widest text-text-secondary hover:border-magenta hover:text-magenta"
            >
              <Plus size={13} />
              Forge print
            </button>
            <button
              type="button"
              onClick={() => refresh.mutate()}
              disabled={refresh.isPending}
              className="wd-hover flex items-center gap-2 rounded bg-neon px-3 py-2 font-mono text-[0.72rem] font-bold uppercase tracking-widest text-void hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw size={13} className={refresh.isPending ? 'animate-spin' : ''} />
              {refresh.isPending ? 'Tuning…' : 'Tune feeds'}
            </button>
          </div>
        </div>
      </div>

      {refreshStatusText && (
        <p className={cn('m-0 font-mono text-[0.74rem]', refresh.isError ? 'text-critical' : 'text-success')}>
          {refreshStatusText}
        </p>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={sigType}
          onChange={e => setSigType(e.target.value)}
          aria-label="Filter by signature type"
          className="rounded border border-border-color bg-surface px-3 py-2 font-mono text-[0.78rem] text-text-primary"
        >
          {SIG_TYPES.map(t => <option key={t} value={t}>{t || 'All print types'}</option>)}
        </select>
        <select
          value={eco}
          onChange={e => setEco(e.target.value)}
          aria-label="Filter by ecosystem"
          className="rounded border border-border-color bg-surface px-3 py-2 font-mono text-[0.78rem] text-text-primary"
        >
          {ECOSYSTEMS.map(e => <option key={e} value={e}>{e || 'All ecosystems'}</option>)}
        </select>
        {sigs.data && (
          <span className="flex items-center font-mono text-[0.78rem] text-text-secondary">
            <Database size={13} className="mr-1.5 text-neon" /> {sigs.data.total} sealed prints
          </span>
        )}
      </div>

      {/* Table */}
      <Card className="cyber-lift overflow-hidden">
        <CardHeader title="Signature vault" description="Every print the grid hunts with" />
        {sigs.isLoading && (
          <CardBody className="flex flex-col gap-2">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
          </CardBody>
        )}
        {sigs.isError && (
          <CardBody className="flex items-center gap-2 text-[0.82rem] text-critical">
            <AlertCircle size={14} className="shrink-0" />{(sigs.error as Error).message}
          </CardBody>
        )}
        {sigs.data && (
          <>
            {sigs.data.signatures.length === 0 ? (
              <CardBody>
                <EmptyState
                  icon={Radio}
                  title="Vault is empty"
                  description="Pull community prints from OSV, OpenSSF and popularity feeds."
                  command="cwctl update"
                />
              </CardBody>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[0.8rem]">
                  <thead>
                    <tr className="border-b border-border-color bg-bg-base">
                      {['Print', 'Ecosystem', 'Value', 'Severity', 'Source', 'CVE'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left font-mono text-[0.64rem] font-bold uppercase tracking-[0.14em] text-text-muted">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sigs.data.signatures.map((s) => (
                      <tr key={s.id} className="border-b border-border-color last:border-b-0">
                        <td className="px-4 py-2.5">
                          <span className={cn('rounded border border-border-color bg-bg-base px-2 py-0.5 font-mono text-[0.68rem] font-bold', sigTypeTone(s.type))}>
                            {s.type}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[0.74rem] text-text-secondary">{s.ecosystem}</td>
                        <td className="max-w-xs truncate px-4 py-2.5 font-mono text-[0.74rem] text-text-primary"
                          title={s.package ?? s.target ?? s.rule ?? s.pattern}>{renderValue(s)}</td>
                        <td className="px-4 py-2.5"><SeverityBadge severity={s.severity.toUpperCase() as never} /></td>
                        <td className="px-4 py-2.5 text-[0.76rem] text-text-secondary">{s.source}</td>
                        <td className="px-4 py-2.5 font-mono text-[0.74rem] text-text-secondary">{s.cve ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {sigs.data.updated_at && (
              <div className="border-t border-border-color bg-surface px-4 py-2 font-mono text-[0.68rem] text-text-muted">
                Vault sealed: {new Date(sigs.data.updated_at).toLocaleString()}
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

import { useState, useMemo } from 'react';
import {
  ClipboardList, Search, Trash2, Eye, Download, Filter, ArrowUpDown,
  ArrowUp, ArrowDown, Shield, AlertTriangle, Crosshair,
} from 'lucide-react';
import { useSessionStore, type ScanSession } from '../store/sessions';
import { useWorkspaceStore } from '../store/workspace';
import { useUIStore } from '../store/ui';
import { Input } from '../components/ui/input';
import { Card, CardBody } from '../components/ui/card';
import { StatTile } from '../components/ui/stat-tile';
import { EmptyState } from '../components/EmptyState';
import { CyberKicker } from '../components/cyber/CyberViz';
import { cn } from '../components/ui/utils';

const SEV_COLORS: Record<string, string> = {
  CRITICAL: '#FF4D5E', HIGH: '#FF8A3D', MEDIUM: '#FFB224', LOW: '#00E5FF', INFORMATIONAL: '#5E6F93',
};

const TYPE_TONE: Record<string, string> = {
  registry: 'border-[color-mix(in_srgb,var(--neon)_40%,transparent)] bg-[color-mix(in_srgb,var(--neon)_12%,transparent)] text-neon',
  upload: 'border-[color-mix(in_srgb,var(--magenta)_40%,transparent)] bg-[color-mix(in_srgb,var(--magenta)_12%,transparent)] text-magenta',
  remote: 'border-[color-mix(in_srgb,var(--success)_40%,transparent)] bg-[color-mix(in_srgb,var(--success)_12%,transparent)] text-success',
};

type SortKey = 'date' | 'critical' | 'total' | 'name';
type SortDir = 'asc' | 'desc';

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

function SeverityBar({ summary }: { summary: ScanSession['summary'] }) {
  const segments = [
    { key: 'critical', count: summary.critical, color: SEV_COLORS.CRITICAL },
    { key: 'high', count: summary.high, color: SEV_COLORS.HIGH },
    { key: 'medium', count: summary.medium, color: SEV_COLORS.MEDIUM },
    { key: 'low', count: summary.low, color: SEV_COLORS.LOW },
  ].filter(s => s.count > 0);

  if (segments.length === 0) {
    return (
      <div className="flex items-center gap-1.5 font-mono text-[0.68rem] font-bold uppercase tracking-wider text-success">
        <Shield size={12} /> Clean
      </div>
    );
  }

  const total = segments.reduce((s, v) => s + v.count, 0);

  return (
    <div className="flex min-w-[140px] items-center gap-2">
      <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
        {segments.map(s => (
          <div
            key={s.key}
            className="h-full"
            style={{ width: `${(s.count / total) * 100}%`, background: s.color, boxShadow: `0 0 6px ${s.color}` }}
          />
        ))}
      </div>
      <span className="w-6 text-right font-mono text-[0.65rem] tabular-nums text-text-muted">{total}</span>
    </div>
  );
}

export default function ScanSessionsPage() {
  const navigate = useUIStore(s => s.navigate);
  const { sessions, remove, clear } = useSessionStore();
  const { activeId } = useWorkspaceStore();
  const active = useWorkspaceStore(s => s.getActive());

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [confirmClear, setConfirmClear] = useState(false);

  const workspaceSessions = useMemo(
    () => sessions.filter(s => s.workspace_id === activeId),
    [sessions, activeId]
  );

  const filtered = useMemo(() => {
    let list = workspaceSessions;
    if (typeFilter !== 'all') list = list.filter(s => s.scan_type === typeFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.label.toLowerCase().includes(q) ||
        s.package_name?.toLowerCase().includes(q) ||
        s.ecosystem?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [workspaceSessions, typeFilter, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'date': cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); break;
        case 'critical': cmp = a.summary.critical - b.summary.critical; break;
        case 'total': cmp = a.summary.total - b.summary.total; break;
        case 'name': cmp = a.label.localeCompare(b.label); break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown size={11} className="text-text-muted" />;
    return sortDir === 'asc' ? <ArrowUp size={11} className="text-neon" /> : <ArrowDown size={11} className="text-neon" />;
  };

  const stats = useMemo(() => {
    const total = workspaceSessions.length;
    const critical = workspaceSessions.reduce((s, v) => s + v.summary.critical, 0);
    const high = workspaceSessions.reduce((s, v) => s + v.summary.high, 0);
    const clean = workspaceSessions.filter(s => s.summary.total === 0).length;
    return { total, critical, high, clean };
  }, [workspaceSessions]);

  const exportSession = (session: ScanSession) => {
    const blob = new Blob([JSON.stringify({
      id: session.id,
      scan_type: session.scan_type,
      label: session.label,
      ecosystem: session.ecosystem,
      package_name: session.package_name,
      version: session.version,
      summary: session.summary,
      findings: session.findings,
      created_at: session.created_at,
    }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `probe-${session.label.replace(/[^a-zA-Z0-9]/g, '-')}-${session.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <CyberKicker index="R-05" label="recon // sweep logs" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="m-0 flex items-center gap-2 text-[1.15rem] font-bold tracking-tight text-text-primary">
              <ClipboardList size={18} className="text-neon" aria-hidden="true" /> Sweep Logs
            </h1>
            <p className="m-0 mt-1 text-[0.78rem] text-text-secondary">
              Mission <span className="font-mono font-bold text-neon">{active.name}</span>
              {' '}· {workspaceSessions.length} sweep{workspaceSessions.length !== 1 ? 's' : ''} on record
            </p>
          </div>
          {workspaceSessions.length > 0 && (
            <div className="flex items-center gap-2">
              {confirmClear ? (
                <div className="flex items-center gap-2 font-mono text-[0.72rem]">
                  <span className="font-bold text-critical">Purge all logs?</span>
                  <button
                    type="button"
                    onClick={() => { clear(activeId); setConfirmClear(false); }}
                    className="wd-hover rounded bg-critical px-2.5 py-1 font-bold text-void"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="wd-hover rounded border border-border-color bg-transparent px-2.5 py-1 text-text-secondary hover:border-neon hover:text-neon"
                  >
                    Abort
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="wd-hover flex items-center gap-1.5 rounded border border-border-color bg-transparent px-2.5 py-1.5 font-mono text-[0.7rem] font-bold uppercase tracking-widest text-text-secondary hover:border-critical hover:text-critical"
                >
                  <Trash2 size={12} /> Purge all
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
        <StatTile label="Total sweeps" value={stats.total} icon={ClipboardList} className="cyber-lift" />
        <StatTile label="Critical" value={stats.critical} icon={AlertTriangle} accent="critical" className="cyber-lift" />
        <StatTile label="High" value={stats.high} icon={AlertTriangle} accent="warning" className="cyber-lift" />
        <StatTile label="Clean sweeps" value={stats.clean} icon={Shield} accent="success" className="cyber-lift" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search the logs…"
            aria-label="Search sweep logs"
            className="h-8 pl-8 text-xs" />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter size={12} className="text-text-muted" />
          {['all', 'registry', 'upload', 'remote'].map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              aria-pressed={typeFilter === t}
              className={cn(
                'wd-hover rounded border px-2.5 py-1 font-mono text-[0.68rem] font-bold uppercase tracking-wider',
                typeFilter === t
                  ? 'border-neon bg-[color-mix(in_srgb,var(--neon)_12%,transparent)] text-neon shadow-glow'
                  : 'border-border-color bg-transparent text-text-secondary hover:border-neon hover:text-neon',
              )}
            >
              {t === 'all' ? 'All' : t}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {sorted.length === 0 ? (
        <Card className="cyber-lift">
          <CardBody>
            <EmptyState
              icon={Crosshair}
              title="No sweeps on record"
              description="Run a probe from the Probe page and it will be logged here."
              command="cwctl scan ."
              action={{ label: 'Probe now', onClick: () => navigate('/scan') }}
            />
          </CardBody>
        </Card>
      ) : (
        <Card className="cyber-lift overflow-hidden">
          <table className="w-full text-[0.78rem]" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr className="border-b border-border-color bg-bg-base font-mono text-[0.64rem] uppercase tracking-[0.14em] text-text-muted">
                <th className="cursor-pointer select-none px-3 py-2.5 text-left font-bold" onClick={() => toggleSort('name')}>
                  <span className="flex items-center gap-1">Sweep <SortIcon k="name" /></span>
                </th>
                <th className="px-3 py-2.5 text-left font-bold">Vector</th>
                <th className="px-3 py-2.5 text-left font-bold">Ecosystem</th>
                <th className="px-3 py-2.5 text-left font-bold">Severity</th>
                <th className="cursor-pointer select-none px-3 py-2.5 text-center font-bold" onClick={() => toggleSort('critical')}>
                  <span className="flex items-center justify-center gap-1">Crit <SortIcon k="critical" /></span>
                </th>
                <th className="cursor-pointer select-none px-3 py-2.5 text-center font-bold" onClick={() => toggleSort('total')}>
                  <span className="flex items-center justify-center gap-1">Total <SortIcon k="total" /></span>
                </th>
                <th className="cursor-pointer select-none px-3 py-2.5 text-right font-bold" onClick={() => toggleSort('date')}>
                  <span className="flex items-center justify-end gap-1">Swept <SortIcon k="date" /></span>
                </th>
                <th className="w-24 px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(session => (
                <tr
                  key={session.id}
                  className="wd-hover cursor-pointer border-t border-border-color transition-colors hover:bg-surface-muted"
                  onClick={() => navigate(`/sessions/${session.id}`)}
                >
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="max-w-[200px] truncate font-medium text-text-primary">{session.label}</div>
                      {session.summary.critical > 0 && (
                        <AlertTriangle size={12} className="shrink-0 text-critical drop-shadow-[0_0_6px_var(--critical)]" />
                      )}
                    </div>
                    {session.version && (
                      <div className="mt-0.5 font-mono text-[0.65rem] text-neon">v{session.version}</div>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={cn(
                      'inline-block rounded border px-1.5 py-0.5 font-mono text-[0.62rem] font-bold uppercase tracking-wide',
                      TYPE_TONE[session.scan_type] ?? 'border-border-color bg-surface-muted text-text-muted',
                    )}>
                      {session.scan_type}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[0.72rem] text-text-secondary">
                    {session.ecosystem ?? '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    <SeverityBar summary={session.summary} />
                  </td>
                  <td className="px-3 py-2.5 text-center font-mono">
                    {session.summary.critical > 0 ? (
                      <span className="font-bold text-critical">{session.summary.critical}</span>
                    ) : (
                      <span className="text-text-muted">0</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center font-mono tabular-nums text-text-secondary">
                    {session.summary.total}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[0.68rem] text-text-muted">
                    {formatDate(session.created_at)}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => navigate(`/sessions/${session.id}`)}
                        className="wd-hover grid h-7 w-7 place-items-center rounded border border-transparent bg-transparent text-text-muted hover:border-neon hover:text-neon"
                        title="View sweep detail"
                      >
                        <Eye size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => exportSession(session)}
                        className="wd-hover grid h-7 w-7 place-items-center rounded border border-transparent bg-transparent text-text-muted hover:border-success hover:text-success"
                        title="Extract JSON"
                      >
                        <Download size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(session.id)}
                        className="wd-hover grid h-7 w-7 place-items-center rounded border border-transparent bg-transparent text-text-muted hover:border-critical hover:text-critical"
                        title="Delete sweep"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

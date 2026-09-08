import { useState, useMemo, useCallback } from 'react';
import { ChevronDown, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, ShieldBan, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { Finding } from '../types/api';
import { StatusChip } from './ui/status-chip';
import { EmptyState } from './EmptyState';
import { cn } from './ui/utils';
import { quarantinePackage, blockPackage, unquarantinePackage } from '../lib/api';

const SEV_ORDER: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, INFORMATIONAL: 0 };

type SortKey = 'severity' | 'id' | 'title' | 'source';
type SortDir = 'asc' | 'desc';

interface Props {
  findings: Finding[];
  maxRows?: number;
  showActions?: boolean;
  denyList?: string[];
  onPolicyChange?: () => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <span className="block font-mono text-[0.62rem] uppercase tracking-wide text-text-muted">{label}</span>
      <p className="m-0 mt-0.5 font-mono text-[0.72rem] break-all text-text-primary">{children}</p>
    </div>
  );
}

const ACTION_BTN =
  'wd-hover inline-flex items-center gap-1 rounded border px-2.5 py-1 font-mono text-[0.72rem] disabled:cursor-wait disabled:opacity-60';

export function FindingsTable({ findings, maxRows, showActions, denyList, onPolicyChange }: Props) {
  const [visibleCount, setVisibleCount] = useState(50);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>('severity');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const toggleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }, [sortKey]);

  const sorted = useMemo(() => {
    const arr = [...findings];
    const dir = sortDir === 'desc' ? -1 : 1;
    arr.sort((a, b) => {
      switch (sortKey) {
        case 'severity': return dir * ((SEV_ORDER[a.severity] ?? 0) - (SEV_ORDER[b.severity] ?? 0));
        case 'id': return dir * a.id.localeCompare(b.id);
        case 'title': return dir * a.title.localeCompare(b.title);
        case 'source': return dir * a.source.localeCompare(b.source);
        default: return 0;
      }
    });
    return arr;
  }, [findings, sortKey, sortDir]);

  const rows = maxRows ? sorted.slice(0, maxRows) : sorted.slice(0, visibleCount);
  const hasMore = !maxRows && findings.length > visibleCount;

  const toggle = (uid: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      return next;
    });
  };

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="No findings"
        description="This scan came back clean — nothing matched any engine signature." />
    );
  }

  const headers: Array<{ key: SortKey; label: string }> = [
    { key: 'severity', label: 'Severity' },
    { key: 'id', label: 'ID' },
    { key: 'title', label: 'Title' },
    { key: 'source', label: 'Source' },
  ];

  return (
    <div className="dt-scroll w-full overflow-x-auto">
      <table className="w-full border-collapse text-[0.78rem]">
        <thead className="sticky top-0 z-10">
          <tr>
            <th scope="col" className="w-7 border-b border-border-color bg-surface" />
            {headers.map((h) => {
              const active = sortKey === h.key;
              return (
                <th
                  key={h.key}
                  scope="col"
                  aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className="border-b border-border-color bg-surface px-3 py-2 text-left text-[12px] font-semibold uppercase tracking-[0.04em] text-text-muted" >
                  <button
                    type="button"
                    onClick={() => toggleSort(h.key)}
                    className={cn(
                      'wd-hover -mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 font-semibold uppercase tracking-[0.04em]',
                      active ? 'text-text-primary' : 'text-text-muted hover:bg-surface-muted hover:text-text-secondary',
                    )}
                  >
                    {h.label}
                    {active
                      ? (sortDir === 'desc' ? <ArrowDown size={11} /> : <ArrowUp size={11} />)
                      : <ArrowUpDown size={11} className="opacity-40" />}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((f, i) => {
            const uid = f.id + i;
            const isOpen = expanded.has(uid);
            return (
              <FragmentRow
                key={uid}
                isOpen={isOpen}
                onToggle={() => toggle(uid)}
                finding={f}
                showActions={showActions}
                denyList={denyList}
                actionLoading={actionLoading}
                setActionLoading={setActionLoading}
                onPolicyChange={onPolicyChange}
              />
            );
          })}
        </tbody>
      </table>

      {maxRows && findings.length > maxRows && (
        <p className="m-0 py-2 text-center text-[0.7rem] text-text-muted">
          + {findings.length - maxRows} more findings
        </p>
      )}
      {hasMore && (
        <div className="py-3 text-center">
          <button
            type="button"
            onClick={() => setVisibleCount((c) => c + 50)}
            className="wd-hover rounded border border-border-color bg-surface px-4 py-1.5 font-mono text-[0.72rem] text-text-primary hover:bg-surface-muted" >
            Load 50 more ({findings.length - visibleCount} remaining)
          </button>
        </div>
      )}
    </div>
  );
}

interface RowProps {
  isOpen: boolean;
  onToggle: () => void;
  finding: Finding;
  showActions?: boolean;
  denyList?: string[];
  actionLoading: string | null;
  setActionLoading: (v: string | null) => void;
  onPolicyChange?: () => void;
}

function FragmentRow({
  isOpen, onToggle, finding: f, showActions, denyList, actionLoading, setActionLoading, onPolicyChange,
}: RowProps) {
  const knownKeys = ['artifact', 'package_name', 'ecosystem', 'file_path', 'location', 'file', 'path', 'urls', 'format', 'error'];
  const meta = f.metadata ?? {};
  const metaKeys = Object.keys(meta);
  const shown = knownKeys.filter((k) => meta[k] != null);
  const rest = metaKeys.filter((k) => !knownKeys.includes(k));

  const pkgName = (meta.package_name as string) || (meta.artifact as string) || f.id.split('-')[0] || '';
  const isDenied = denyList?.some((d) => d.toLowerCase() === pkgName.toLowerCase());
  const loading = actionLoading === pkgName;

  const doAction = async (action: 'quarantine' | 'block' | 'unquarantine') => {
    setActionLoading(pkgName);
    try {
      if (action === 'quarantine') await quarantinePackage(pkgName, f.title);
      else if (action === 'block') await blockPackage(pkgName, f.title);
      else await unquarantinePackage(pkgName);
      onPolicyChange?.();
    } catch {
      /* a toast would be nice here; the banner above already covers API outages */
    }
    setActionLoading(null);
  };

  return (
    <>
      <tr
        onClick={onToggle}
        className="wd-hover cursor-pointer border-b border-[color-mix(in_srgb,var(--border-color)_60%,transparent)] hover:bg-[var(--row-hover)]" >
        <td className="py-2 pl-3 text-text-muted">
          {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </td>
        <td className="px-3 py-2"><StatusChip tone={f.severity} dot={false} /></td>
        <td className="px-3 py-2 font-mono text-[0.72rem] text-text-muted">{f.id}</td>
        <td className="px-3 py-2 text-text-primary">{f.title}</td>
        <td className="px-3 py-2 text-[0.72rem] text-text-muted">{f.source}</td>
      </tr>
      {isOpen && (
        <tr className="border-b border-[color-mix(in_srgb,var(--border-color)_60%,transparent)]">
          <td colSpan={5} className="p-0">
            <div className="ml-9 mr-3 mb-3 rounded border border-border-color bg-bg-base p-3">
              {f.description && (
                <div className="mb-2">
                  <span className="block font-mono text-[0.62rem] uppercase tracking-wide text-text-muted">
                    Description
                  </span>
                  <p className="m-0 mt-0.5 text-[0.76rem] leading-relaxed text-text-primary">{f.description}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-x-8 gap-y-2">
                {f.fixed_version && (
                  <Field label="Fix available">
                    <span className="text-success">Upgrade to {f.fixed_version}</span>
                  </Field>
                )}
                <Field label="Type">{f.type || '—'}</Field>
                <Field label="Engine">{f.source}</Field>
              </div>

              {metaKeys.length > 0 && (
                <div className="mt-3">
                  <span className="block font-mono text-[0.62rem] uppercase tracking-wide text-text-muted">
                    Details
                  </span>
                  <div className="mt-1 flex flex-wrap gap-x-6 gap-y-2">
                    {shown.map((k) => (
                      <Field key={k} label={k.replace(/_/g, ' ')}>
                        {typeof meta[k] === 'object' ? JSON.stringify(meta[k]) : String(meta[k])}
                      </Field>
                    ))}
                  </div>
                  {rest.length > 0 && (
                    <pre className="m-0 mt-2 whitespace-pre-wrap break-all font-mono text-[0.68rem] text-text-muted">
                      {JSON.stringify(Object.fromEntries(rest.map((k) => [k, meta[k]])), null, 2)}
                    </pre>
                  )}
                </div>
              )}

              {showActions && pkgName && (
                <div className="mt-3 flex items-center gap-2 border-t border-border-color pt-2.5">
                  <span className="mr-1 font-mono text-[0.62rem] uppercase tracking-wide text-text-muted">
                    Actions
                  </span>
                  {isDenied ? (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={(e) => { e.stopPropagation(); doAction('unquarantine'); }}
                      className={cn(
                        ACTION_BTN,
                        'border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_10%,transparent)] text-success',
                      )}
                    >
                      <ShieldCheck size={12} /> Unquarantine
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={(e) => { e.stopPropagation(); doAction('quarantine'); }}
                        className={cn(
                          ACTION_BTN,
                          'border-[color-mix(in_srgb,var(--warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] text-warning',
                        )}
                      >
                        <ShieldAlert size={12} /> Quarantine
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={(e) => { e.stopPropagation(); doAction('block'); }}
                        className={cn(
                          ACTION_BTN,
                          'border-[color-mix(in_srgb,var(--critical)_30%,transparent)] bg-[color-mix(in_srgb,var(--critical)_10%,transparent)] text-critical',
                        )}
                      >
                        <ShieldBan size={12} /> Block
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

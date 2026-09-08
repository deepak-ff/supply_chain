import { useState } from 'react';
import { Skeleton } from '../components/ui/skeleton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ListFilter, ShieldCheck, ShieldX, Plus, Trash2 } from 'lucide-react';
import { listAllowlist, addAllowlist, deleteAllowlist } from '../lib/api';
import { Card, CardHeader, CardBody } from '../components/ui/card';
import { EmptyState } from '../components/EmptyState';
import { CyberKicker } from '../components/cyber/CyberViz';

const FIELD = 'w-full rounded border border-border-color bg-bg-base px-3 py-2 font-mono text-[0.8rem] text-text-primary';
const LABEL = 'mb-1 block font-mono text-[0.62rem] font-bold uppercase tracking-[0.14em] text-text-muted';

export function AllowlistPage() {
  const qc = useQueryClient();
  const [eco, setEco] = useState('');
  const [pkg, setPkg] = useState('');
  const [reason, setReason] = useState('');
  const [formErr, setFormErr] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['allowlist'],
    queryFn: listAllowlist,
    staleTime: 30_000,
  });

  const add = useMutation({
    mutationFn: () => addAllowlist(eco, pkg, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['allowlist'] });
      setPkg(''); setReason(''); setEco(''); setFormErr('');
    },
    onError: (e: Error) => setFormErr(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteAllowlist(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['allowlist'] }),
  });

  const entries = data?.allowlist ?? [];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <CyberKicker index="D-02" label="doctrine // permit deny" />
        <div className="flex items-center gap-2.5">
          <ListFilter size={20} className="text-neon drop-shadow-[0_0_8px_var(--neon)]" aria-hidden="true" />
          <div>
            <h1 className="m-0 text-[1.15rem] font-bold tracking-tight text-text-primary">Permit / Deny</h1>
            <p className="m-0 mt-0.5 text-[0.78rem] text-text-secondary">
              Explicitly cleared packages that walk straight past directive enforcement.
            </p>
          </div>
        </div>
      </div>

      {/* Add form */}
      <Card className="cyber-lift">
        <CardHeader title="Clear a package" description="Stamp a permit with a reason on record" />
        <CardBody className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[110px_1fr_1fr]">
            <div>
              <label className={LABEL} htmlFor="permit-eco">Ecosystem</label>
              <input id="permit-eco" value={eco} onChange={e => setEco(e.target.value)} placeholder="npm_" className={FIELD} />
            </div>
            <div>
              <label className={LABEL} htmlFor="permit-pkg">Package *</label>
              <input id="permit-pkg" value={pkg} onChange={e => setPkg(e.target.value)} placeholder="lodash_" className={FIELD} />
            </div>
            <div>
              <label className={LABEL} htmlFor="permit-why">Reason</label>
              <input id="permit-why" value={reason} onChange={e => setReason(e.target.value)} placeholder="internal fork — no CVE impact_" className={FIELD} />
            </div>
          </div>
          {formErr && <p className="m-0 font-mono text-[0.72rem] text-critical">{formErr}</p>}
          <div>
            <button
              type="button"
              onClick={() => { if (!pkg) { setFormErr('Package is required'); return; } add.mutate(); }}
              disabled={add.isPending}
              className="wd-hover flex items-center gap-2 rounded border border-success bg-[color-mix(in_srgb,var(--success)_12%,transparent)] px-4 py-2 font-mono text-[0.76rem] font-bold uppercase tracking-widest text-success hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={13} />
              {add.isPending ? 'Stamping…' : 'Stamp permit'}
            </button>
          </div>
        </CardBody>
      </Card>

      {/* Allowlist table */}
      <Card className="cyber-lift overflow-hidden">
        <CardHeader
          icon={ShieldCheck}
          title={`Cleared (${entries.length})`}
          description="Packages holding a live permit"
        />
        {isLoading && (
          <CardBody className="flex flex-col gap-2">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
          </CardBody>
        )}
        {!isLoading && entries.length === 0 && (
          <CardBody>
            <EmptyState
              icon={ShieldCheck}
              title="No permits stamped"
              description="Clear a package above and it will walk past enforcement from here on."
              command="cwctl policy allow lodash"
            />
          </CardBody>
        )}
        {entries.map((e, i) => (
          <div
            key={e.id}
            className={`flex items-center gap-3 px-3.5 py-2 ${i < entries.length - 1 ? 'border-b border-border-color' : ''}`}
          >
            <ShieldCheck size={13} className="shrink-0 text-success" />
            <code className="min-w-0 flex-1 truncate font-mono text-[0.78rem] font-bold text-neon">
              {e.ecosystem ? `${e.ecosystem}/` : ''}{e.package}
            </code>
            <span className="hidden min-w-0 flex-[2] truncate text-[0.72rem] text-text-muted sm:block">{e.reason || '—'}</span>
            <span className="hidden shrink-0 font-mono text-[0.66rem] text-text-muted md:block">{e.added_by}</span>
            <button
              type="button"
              onClick={() => remove.mutate(e.id)}
              title="Revoke permit"
              className="wd-hover grid h-7 w-7 shrink-0 place-items-center rounded border border-transparent bg-transparent text-text-muted hover:border-critical hover:text-critical"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </Card>

      {/* Blocklist from policy (read-only) */}
      <Card className="cyber-lift border-critical">
        <CardHeader icon={ShieldX} title="Deny roster" description="Denials are sealed in policy.yaml, not here" />
        <CardBody>
          <p className="m-0 text-[0.78rem] text-text-secondary">
            Denied packages are managed via the doctrine file — issue{' '}
            <code className="font-mono text-[0.74rem] text-neon">cwctl policy set deny=pkg@version</code>
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Layers, AlertTriangle, CheckCircle, Crosshair } from 'lucide-react';
import { triggerScan, getJobStatus } from '../lib/api';
import type { ScanResult } from '../types/api';
import { Card, CardHeader, CardBody } from '../components/ui/card';
import { StatTile } from '../components/ui/stat-tile';
import { StatusChip } from '../components/ui/status-chip';
import { EmptyState } from '../components/EmptyState';
import { CyberKicker } from '../components/cyber/CyberViz';

// Scans run async — submit returns a job_id, poll until it settles.
// Bounded to 5 minutes (150 * 2s) so a stuck worker can't poll forever, and
// checks isMounted so navigating away stops polling instead of leaking a
// setTimeout loop tied to nothing.
const MAX_POLLS = 150;

async function scanAndAwait(eco: string, pkg: string, ver: string, isMounted: () => boolean): Promise<ScanResult> {
  const job = await triggerScan(eco, pkg, ver);
  let current = job;
  let polls = 0;
  while (current.status !== 'complete' && current.status !== 'failed') {
    if (!isMounted()) throw new Error('cancelled — navigated away');
    if (++polls > MAX_POLLS) throw new Error(`probe for ${pkg}@${ver} did not complete after 5 minutes`);
    await new Promise(r => setTimeout(r, 2_000));
    current = await getJobStatus(job.job_id);
  }
  if (current.status === 'failed') throw new Error(current.error || `probe failed for ${pkg}@${ver}`);
  return current.result!;
}

const FIELD = 'w-full rounded border border-border-color bg-bg-base px-3 py-2 font-mono text-[0.8rem] text-text-primary';
const LABEL = 'mb-1 block font-mono text-[0.62rem] font-bold uppercase tracking-[0.14em] text-text-muted';

export function RecursiveScanPage() {
  const [eco, setEco] = useState('npm');
  const [pkg, setPkg] = useState('');
  const [ver, setVer] = useState('');
  const [results, setResults] = useState<ScanResult[]>([]);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const { mutate, isPending, error } = useMutation({
    mutationFn: async () => {
      // Probe the root package plus any comma-separated extra packages
      const pkgs = pkg.split(',').map(p => p.trim()).filter(Boolean);
      const scans = await Promise.all(
        pkgs.map(p => scanAndAwait(eco, p, ver, () => mountedRef.current))
      );
      return scans;
    },
    onSuccess: (scans) => setResults(scans),
  });

  const totalFindings = results.reduce((s, r) => s + (r.findings?.length ?? 0), 0);
  const criticalCount = results.reduce((s, r) => s + (r.findings?.filter(f => f.severity === 'CRITICAL').length ?? 0), 0);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <CyberKicker index="R-06" label="recon // deep trace" />
        <div className="flex items-center gap-2.5">
          <Layers size={20} className="text-neon drop-shadow-[0_0_8px_var(--neon)]" aria-hidden="true" />
          <div>
            <h1 className="m-0 text-[1.15rem] font-bold tracking-tight text-text-primary">Deep Trace</h1>
            <p className="m-0 mt-0.5 text-[0.78rem] text-text-secondary">
              Trace several packages in one sweep — expose what hides in the transitive depths.
            </p>
          </div>
        </div>
      </div>

      {/* Input form */}
      <Card className="cyber-lift">
        <CardHeader title="Trace coordinates" description="One version across many packages, all engines firing" />
        <CardBody className="flex flex-col gap-4">
          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[120px_1fr_140px]">
            <div>
              <label className={LABEL} htmlFor="trace-eco">Ecosystem</label>
              <select id="trace-eco" value={eco} onChange={e => setEco(e.target.value)} className={FIELD}>
                {['npm','pypi','go','maven','crates','rubygems','huggingface','mcp'].map(e => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL} htmlFor="trace-pkgs">Packages (comma-separated)</label>
              <input id="trace-pkgs" value={pkg} onChange={e => setPkg(e.target.value)} placeholder="lodash, express, axios_" className={FIELD} />
            </div>
            <div>
              <label className={LABEL} htmlFor="trace-ver">Version</label>
              <input id="trace-ver" value={ver} onChange={e => setVer(e.target.value)} placeholder="4.17.21_" className={FIELD} />
            </div>
          </div>
          <div>
            <button
              type="button"
              onClick={() => mutate()}
              disabled={isPending || !pkg || !ver}
              className="wd-hover flex items-center gap-2 rounded bg-neon px-5 py-2.5 font-mono text-[0.76rem] font-bold uppercase tracking-widest text-void hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Crosshair size={14} />
              {isPending ? 'Tracing…' : 'Run deep trace'}
            </button>
          </div>
          {error && (
            <p className="m-0 font-mono text-[0.74rem] text-critical">
              {(error as Error).message}
            </p>
          )}
        </CardBody>
      </Card>

      {/* Summary bar */}
      {results.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <StatTile label="Packages traced" value={results.length} icon={Layers} className="cyber-lift" />
          <StatTile label="Total findings" value={totalFindings} icon={AlertTriangle} accent="amber" className="cyber-lift" />
          <StatTile label="Critical" value={criticalCount} icon={AlertTriangle} accent="critical" className="cyber-lift" />
        </div>
      )}

      {results.length === 0 && !isPending && (
        <Card className="cyber-lift">
          <CardBody>
            <EmptyState
              icon={Layers}
              title="No trace on record"
              description="Set coordinates above and run a deep trace across several packages at once."
              command="cwctl scan . --recursive"
            />
          </CardBody>
        </Card>
      )}

      {/* Per-package results */}
      {results.map((r, i) => (
        <Card key={i} className="cyber-lift overflow-hidden">
          <CardHeader
            icon={(r.findings?.length ?? 0) === 0 ? CheckCircle : AlertTriangle}
            title={r.package}
            description={`${r.findings?.length ?? 0} findings`}
          />
          <CardBody className="flex flex-col gap-0 p-0">
            {(r.findings ?? []).slice(0, 5).map((f, j) => (
              <div key={j} className="flex items-start gap-3 border-b border-border-color px-4 py-2.5 last:border-b-0">
                <span className="w-[86px] shrink-0 pt-0.5">
                  <StatusChip tone={f.severity} dot={false} />
                </span>
                <div className="min-w-0">
                  <p className="m-0 text-[0.78rem] text-text-primary">{f.title}</p>
                  <p className="m-0 mt-0.5 font-mono text-[0.68rem] text-text-muted">{f.source}</p>
                </div>
              </div>
            ))}
            {(r.findings?.length ?? 0) > 5 && (
              <p className="m-0 px-4 py-2.5 font-mono text-[0.7rem] text-text-muted">
                + {(r.findings?.length ?? 0) - 5} more — use <code className="text-neon">cwctl scan</code> for full output
              </p>
            )}
          </CardBody>
        </Card>
      ))}

      {/* CLI hint */}
      <Card className="cyber-lift">
        <CardHeader title="Terminal equivalent" description="Same trace, no browser required" />
        <CardBody className="flex flex-col gap-2">
          {['cwctl scan . --recursive', 'cwctl scan . --recursive --depth=all --format json'].map(c => (
            <code key={c} className="overflow-x-auto whitespace-nowrap rounded border border-border-color bg-bg-base px-3 py-2 font-mono text-[0.74rem] text-neon">
              <span className="mr-2 select-none text-magenta">$</span>{c}
            </code>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { generateProvenance } from '../lib/api';
import { FileCheck, AlertCircle, Route, Copy } from 'lucide-react';
import type { Provenance } from '../types/api';
import { Card, CardHeader, CardBody } from '../components/ui/card';
import { EmptyState } from '../components/EmptyState';
import { CyberKicker } from '../components/cyber/CyberViz';

const ECOSYSTEMS = ['npm', 'pypi', 'go', 'rubygems', 'crates', 'maven', 'huggingface', 'mcp'];

const FIELD = 'w-full rounded border border-border-color bg-bg-base px-3 py-2 font-mono text-[0.8rem] text-text-primary';
const LABEL = 'mb-1 block font-mono text-[0.62rem] font-bold uppercase tracking-[0.14em] text-text-muted';

export function ProvenancePage() {
  const [ecosystem, setEcosystem] = useState('npm');
  const [pkg, setPkg] = useState('');
  const [version, setVersion] = useState('');
  const [sha256, setSha256] = useState('');
  const [provenance, setProvenance] = useState<Provenance | null>(null);

  const generate = useMutation({
    mutationFn: () => generateProvenance(sha256, ecosystem, pkg, version),
    onSuccess: (data) => setProvenance(data),
  });

  const copyJSON = () => provenance && navigator.clipboard.writeText(JSON.stringify(provenance, null, 2));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <CyberKicker index="D-04" label="doctrine // origin trail" />
        <div className="flex items-center gap-2.5">
          <Route size={20} className="text-neon drop-shadow-[0_0_8px_var(--neon)]" aria-hidden="true" />
          <div>
            <h1 className="m-0 text-[1.15rem] font-bold tracking-tight text-text-primary">Origin Trail</h1>
            <p className="m-0 mt-0.5 text-[0.78rem] text-text-secondary">
              SLSA v1 build provenance — definition, resolved dependencies and run details for any artifact.
            </p>
          </div>
        </div>
      </div>

      {/* Generate form */}
      <Card className="cyber-lift">
        <CardHeader title="Chart the trail" description="Point at an artifact — we trace how it was built" />
        <CardBody className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div>
              <label className={LABEL} htmlFor="origin-eco">Ecosystem</label>
              <select id="origin-eco" value={ecosystem} onChange={e => setEcosystem(e.target.value)} className={FIELD}>
                {ECOSYSTEMS.map(e => <option key={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL} htmlFor="origin-pkg">Package</label>
              <input id="origin-pkg" value={pkg} onChange={e => setPkg(e.target.value)} placeholder="name_" className={FIELD} />
            </div>
            <div>
              <label className={LABEL} htmlFor="origin-ver">Version</label>
              <input id="origin-ver" value={version} onChange={e => setVersion(e.target.value)} placeholder="version_" className={FIELD} />
            </div>
            <div>
              <label className={LABEL} htmlFor="origin-sha">SHA256</label>
              <input id="origin-sha" value={sha256} onChange={e => setSha256(e.target.value)} placeholder="hex hash_" className={FIELD} />
            </div>
          </div>
          <div>
            <button
              type="button"
              onClick={() => generate.mutate()}
              disabled={!sha256 || !pkg || !version || generate.isPending}
              className="wd-hover flex items-center gap-2 rounded bg-neon px-5 py-2.5 font-mono text-[0.76rem] font-bold uppercase tracking-widest text-void hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FileCheck size={14} />{generate.isPending ? 'Tracing…' : 'Trace origin'}
            </button>
          </div>
          {generate.isError && (
            <div className="flex items-center gap-2 rounded border border-[color-mix(in_srgb,var(--critical)_30%,transparent)] bg-[color-mix(in_srgb,var(--critical)_10%,transparent)] px-3 py-2.5 text-[0.78rem] text-critical">
              <AlertCircle size={14} className="shrink-0" />{(generate.error as Error).message}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Provenance output */}
      {provenance ? (
        <Card className="cyber-lift overflow-hidden">
          <CardHeader
            icon={FileCheck}
            title="Trail charted"
            description="Sealed SLSA v1 statement for this artifact"
            action={
              <button
                type="button"
                onClick={copyJSON}
                className="wd-hover flex items-center gap-1.5 rounded border border-border-color bg-transparent px-2.5 py-1.5 font-mono text-[0.68rem] font-bold uppercase tracking-widest text-text-secondary hover:border-neon hover:text-neon"
              >
                <Copy size={12} /> Copy JSON
              </button>
            }
          />
          <CardBody className="max-h-96 overflow-auto p-0">
            <pre className="m-0 p-4 font-mono text-[0.74rem] leading-relaxed text-neon">
              {JSON.stringify(provenance, null, 2)}
            </pre>
          </CardBody>
        </Card>
      ) : (
        <Card className="cyber-lift">
          <CardBody>
            <EmptyState
              icon={Route}
              title="No trail charted yet"
              description="Feed the forge an artifact above and its build lineage will materialize here."
              command="cwctl provenance npm/lodash@4.17.21"
            />
          </CardBody>
        </Card>
      )}
    </div>
  );
}

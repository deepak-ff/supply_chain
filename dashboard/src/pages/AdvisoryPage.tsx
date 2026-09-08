import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { generateAdvisory } from '../lib/api';
import { SeverityBadge } from '../components/SeverityBadge';
import { Zap, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';
import type { Advisory } from '../types/api';
import { Card, CardHeader, CardBody } from '../components/ui/card';
import { EmptyState } from '../components/EmptyState';
import { CyberKicker } from '../components/cyber/CyberViz';

const ECOSYSTEMS = ['npm', 'pypi', 'go', 'rubygems', 'crates', 'maven', 'huggingface', 'mcp'];

const FIELD = 'w-full rounded border border-border-color bg-bg-base px-3 py-2 font-mono text-[0.8rem] text-text-primary';
const LABEL = 'mb-1 block font-mono text-[0.62rem] font-bold uppercase tracking-[0.14em] text-text-muted';

export function AdvisoryPage() {
  const [ecosystem, setEcosystem] = useState('npm');
  const [pkg, setPkg] = useState('');
  const [version, setVersion] = useState('');
  const [advisory, setAdvisory] = useState<Advisory | null>(null);

  const gen = useMutation({
    mutationFn: () => generateAdvisory(ecosystem, pkg, version),
    onSuccess: (data) => setAdvisory(data),
  });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <CyberKicker index="R-03" label="recon // oracle brief" />
        <h1 className="m-0 flex items-center gap-2 text-[1.15rem] font-bold tracking-tight text-text-primary">
          <Sparkles size={18} className="text-magenta drop-shadow-[0_0_8px_var(--magenta)]" aria-hidden="true" />
          Oracle Brief
        </h1>
        <p className="m-0 mt-1 text-[0.78rem] text-text-secondary">
          Consult the oracle — structured AI brief with exploitability analysis and recommended action.
        </p>
      </div>

      <Card className="cyber-lift">
        <CardHeader title="Consultation" description="Name the package — the oracle reads its fate" />
        <CardBody className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className={LABEL} htmlFor="oracle-eco">Ecosystem</label>
              <select id="oracle-eco" value={ecosystem} onChange={e => setEcosystem(e.target.value)} className={FIELD}>
                {ECOSYSTEMS.map(e => <option key={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL} htmlFor="oracle-pkg">Package</label>
              <input id="oracle-pkg" value={pkg} onChange={e => setPkg(e.target.value)} placeholder="package name_" className={FIELD} />
            </div>
            <div>
              <label className={LABEL} htmlFor="oracle-ver">Version</label>
              <input id="oracle-ver" value={version} onChange={e => setVersion(e.target.value)} placeholder="version_" className={FIELD} />
            </div>
          </div>
          <div>
            <button
              type="button"
              onClick={() => gen.mutate()}
              disabled={!pkg || !version || gen.isPending}
              className="wd-hover flex items-center gap-2 rounded bg-magenta px-5 py-2.5 font-mono text-[0.76rem] font-bold uppercase tracking-widest text-void hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Zap size={14} />
              {gen.isPending ? 'Reading the signs…' : 'Consult oracle'}
            </button>
          </div>
        </CardBody>
      </Card>

      {gen.isError && (
        <div className="flex items-center gap-2 rounded border border-[color-mix(in_srgb,var(--critical)_30%,transparent)] bg-[color-mix(in_srgb,var(--critical)_10%,transparent)] px-3 py-2.5 text-[0.78rem] text-critical">
          <AlertCircle size={14} className="shrink-0" />{(gen.error as Error).message}
        </div>
      )}

      {!advisory && !gen.isPending && !gen.isError && (
        <Card className="cyber-lift">
          <CardBody>
            <EmptyState
              icon={Sparkles}
              title="The oracle awaits"
              description="Name a package above and receive its exploitability brief."
              command="cwctl advisory npm/express@4.18.2"
            />
          </CardBody>
        </Card>
      )}

      {advisory && (
        <div className="flex flex-col gap-5">
          <Card className="cyber-lift">
            <CardBody className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <SeverityBadge severity={advisory.severity} />
                <span className="font-mono text-[0.72rem] text-text-muted">
                  confidence <span className="font-bold text-neon">{Math.round(advisory.confidence * 100)}%</span>
                </span>
              </div>
              <h2 className="m-0 font-mono text-[0.95rem] font-bold text-text-primary">
                {advisory.package.name}@{advisory.package.version}
                <span className="ml-2 font-normal text-text-muted">({advisory.package.ecosystem})</span>
              </h2>
            </CardBody>
          </Card>

          <Card className="cyber-lift">
            <CardHeader title="The brief" description="What the oracle sees" />
            <CardBody>
              <p className="m-0 text-[0.82rem] leading-relaxed text-text-primary">{advisory.advisory}</p>
            </CardBody>
          </Card>

          <Card className="cyber-lift">
            <CardHeader
              icon={CheckCircle2}
              title="Sanctioned action"
              description="The oracle's recommended move"
            />
            <CardBody>
              <p className="m-0 border-l-2 border-success pl-3 text-[0.82rem] leading-relaxed text-text-primary">
                {advisory.recommended_action}
              </p>
            </CardBody>
          </Card>

          {advisory.agentic_risk && (
            <Card className="cyber-lift">
              <CardHeader title="Agentic attack surface" description="How AI agents could turn this package into a weapon" />
              <CardBody>
                <p className="m-0 border-l-2 border-warning pl-3 text-[0.82rem] leading-relaxed text-text-primary">
                  {advisory.agentic_risk}
                </p>
              </CardBody>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

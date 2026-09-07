import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { generateAdvisory } from '../lib/api';
import { SeverityBadge } from '../components/SeverityBadge';
import { Zap, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { Advisory } from '../types/api';

const ECOSYSTEMS = ['npm', 'pypi', 'go', 'rubygems', 'crates', 'maven', 'huggingface', 'mcp'];

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
    <div className="space-y-6">
      <h1 className="text-xl font-bold font-mono text-text-primary">AI Security Advisory</h1>
      <p className="text-sm text-text-secondary">
        AI-powered structured advisory with exploitability analysis and recommended actions.
      </p>

      <div className="rounded-lg p-5 space-y-4 bg-surface border border-border-color">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-mono mb-1 text-text-secondary">ECOSYSTEM</label>
            <select value={ecosystem} onChange={e => setEcosystem(e.target.value)}
              className="w-full rounded px-3 py-2 text-sm font-mono bg-bg-base text-text-primary border border-border-color" >
              {ECOSYSTEMS.map(e => <option key={e}>{e}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-mono mb-1 text-text-secondary">PACKAGE</label>
            <input value={pkg} onChange={e => setPkg(e.target.value)} placeholder="package name"
              className="w-full rounded px-3 py-2 text-sm font-mono bg-bg-base text-text-primary border border-border-color" />
          </div>
          <div>
            <label className="block text-xs font-mono mb-1 text-text-secondary">VERSION</label>
            <input value={version} onChange={e => setVersion(e.target.value)} placeholder="version"
              className="w-full rounded px-3 py-2 text-sm font-mono bg-bg-base text-text-primary border border-border-color" />
          </div>
        </div>
        <button onClick={() => gen.mutate()} disabled={!pkg || !version || gen.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded text-sm font-mono font-bold disabled:opacity-50"
          style={{ background: 'var(--color-warning)', color: '#0A0B0D' }}>
          <Zap size={14} />
          {gen.isPending ? 'Generating advisory…' : 'Generate Advisory'}
        </button>
      </div>

      {gen.isError && (
        <div className="flex items-center gap-2 p-3 rounded text-sm"
          style={{ background: 'rgba(255,61,61,0.1)', color: 'var(--color-critical)', border: '1px solid rgba(255,61,61,0.2)' }}>
          <AlertCircle size={14} />{(gen.error as Error).message}
        </div>
      )}

      {advisory && (
        <div className="space-y-4">
          {/* Header */}
          <div className="rounded-lg p-5 space-y-3 bg-surface border border-border-color">
            <div className="flex items-center gap-3">
              <SeverityBadge severity={advisory.severity} />
              <span className="text-sm font-mono text-text-secondary">
                Confidence: {Math.round(advisory.confidence * 100)}%
              </span>
            </div>
            <h2 className="font-bold text-text-primary">
              {advisory.package.name}@{advisory.package.version} ({advisory.package.ecosystem})
            </h2>
          </div>

          {/* Advisory text */}
          <div className="rounded-lg p-5 bg-surface border border-border-color">
            <h3 className="text-xs font-mono mb-2 text-text-secondary">ADVISORY</h3>
            <p className="text-sm leading-relaxed text-text-primary">{advisory.advisory}</p>
          </div>

          {/* Recommended action */}
          <div className="rounded-lg p-5" style={{ background: 'rgba(0,255,135,0.05)', border: '1px solid rgba(0,255,135,0.15)' }}>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 size={14} color="var(--color-safe)" />
              <h3 className="text-xs font-mono text-success">RECOMMENDED ACTION</h3>
            </div>
            <p className="text-sm text-text-primary">{advisory.recommended_action}</p>
          </div>

          {/* Agentic risk */}
          {advisory.agentic_risk && (
            <div className="rounded-lg p-5" style={{ background: 'rgba(255,171,64,0.05)', border: '1px solid rgba(255,171,64,0.15)' }}>
              <h3 className="text-xs font-mono mb-2 text-warning">AGENTIC ATTACK SURFACE</h3>
              <p className="text-sm text-text-primary">{advisory.agentic_risk}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

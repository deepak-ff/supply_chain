import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { generateProvenance } from '../lib/api';
import { FileCheck, AlertCircle } from 'lucide-react';
import type { Provenance } from '../types/api';

const ECOSYSTEMS = ['npm', 'pypi', 'go', 'rubygems', 'crates', 'maven', 'huggingface', 'mcp'];

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
    <div className="space-y-6">
      <h1 className="text-xl font-bold font-mono text-text-primary">Provenance</h1>
      <p className="text-sm text-text-secondary">
        SLSA v1 build provenance — buildDefinition, resolvedDependencies, and runDetails for a given artifact.
      </p>

      {/* Generate form */}
      <div className="rounded-lg p-5 space-y-4 bg-surface border border-border-color">
        <h2 className="text-sm font-mono text-text-secondary">GENERATE PROVENANCE</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-mono mb-1 text-text-secondary">ECOSYSTEM</label>
            <select value={ecosystem} onChange={e => setEcosystem(e.target.value)}
              className="w-full rounded px-3 py-2 text-sm font-mono bg-bg-base text-text-primary border border-border-color" >
              {ECOSYSTEMS.map(e => <option key={e}>{e}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-mono mb-1 text-text-secondary">PACKAGE</label>
            <input value={pkg} onChange={e => setPkg(e.target.value)} placeholder="name"
              className="w-full rounded px-3 py-2 text-sm font-mono bg-bg-base text-text-primary border border-border-color" />
          </div>
          <div>
            <label className="block text-xs font-mono mb-1 text-text-secondary">VERSION</label>
            <input value={version} onChange={e => setVersion(e.target.value)} placeholder="version"
              className="w-full rounded px-3 py-2 text-sm font-mono bg-bg-base text-text-primary border border-border-color" />
          </div>
          <div>
            <label className="block text-xs font-mono mb-1 text-text-secondary">SHA256</label>
            <input value={sha256} onChange={e => setSha256(e.target.value)} placeholder="hex hash"
              className="w-full rounded px-3 py-2 text-sm font-mono bg-bg-base text-text-primary border border-border-color" />
          </div>
        </div>
        <button onClick={() => generate.mutate()} disabled={!sha256 || !pkg || !version || generate.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded text-sm font-mono font-bold disabled:opacity-50"
          style={{ background: 'var(--color-safe)', color: '#0A0B0D' }}>
          <FileCheck size={14} />{generate.isPending ? 'Generating…' : 'Generate Provenance'}
        </button>
        {generate.isError && (
          <div className="flex items-center gap-2 text-sm text-critical">
            <AlertCircle size={14} />{(generate.error as Error).message}
          </div>
        )}
      </div>

      {/* Provenance output */}
      {provenance && (
        <div className="rounded-lg" style={{ background: 'var(--surface)', border: '1px solid rgba(0,255,135,0.2)' }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-color">
            <div className="flex items-center gap-2">
              <FileCheck size={14} color="var(--color-safe)" />
              <span className="text-xs font-mono text-success">PROVENANCE GENERATED</span>
            </div>
            <button onClick={copyJSON} className="text-xs px-2 py-1 rounded font-mono"
              style={{ background: 'rgba(0,255,135,0.1)', color: 'var(--color-safe)' }}>Copy JSON</button>
          </div>
          <pre className="p-4 text-xs overflow-auto max-h-96 font-mono text-text-primary">
            {JSON.stringify(provenance, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { getSBOM } from '../lib/api';
import { FileText, Download, AlertCircle, ScrollText } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../components/ui/card';
import { EmptyState } from '../components/EmptyState';
import { CyberKicker } from '../components/cyber/CyberViz';

const FORMATS = ['cyclonedx-json', 'cyclonedx-xml', 'spdx-json', 'spdx-tv'];
const ECOSYSTEMS = ['npm', 'pypi', 'go', 'rubygems', 'crates', 'maven', 'huggingface', 'mcp'];

const FIELD = 'w-full rounded border border-border-color bg-bg-base px-3 py-2 font-mono text-[0.8rem] text-text-primary';
const LABEL = 'mb-1 block font-mono text-[0.62rem] font-bold uppercase tracking-[0.14em] text-text-muted';

export function SBOMPage() {
  const [ecosystem, setEcosystem] = useState('npm');
  const [pkg, setPkg] = useState('');
  const [version, setVersion] = useState('');
  const [format, setFormat] = useState('cyclonedx-json');
  const [sbomText, setSbomText] = useState('');
  // What the currently-displayed sbomText was actually generated for — kept
  // separate from the live form fields so editing package/version/format
  // after generating doesn't relabel or rename-on-download stale content.
  const [generatedFor, setGeneratedFor] = useState<{ ecosystem: string; pkg: string; version: string; format: string } | null>(null);

  const gen = useMutation({
    mutationFn: () => getSBOM(ecosystem, pkg, version, format),
    onSuccess: (data) => {
      setSbomText(data);
      setGeneratedFor({ ecosystem, pkg, version, format });
    },
  });

  const download = () => {
    if (!generatedFor) return;
    const ext = generatedFor.format.includes('json') ? 'json' : generatedFor.format.includes('xml') ? 'xml' : 'txt';
    const blob = new Blob([sbomText], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${generatedFor.pkg}-${generatedFor.version}-sbom.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <CyberKicker index="A-03" label="arsenal // manifest ledger" />
        <div className="flex items-center gap-2.5">
          <ScrollText size={20} className="text-neon drop-shadow-[0_0_8px_var(--neon)]" aria-hidden="true" />
          <div>
            <h1 className="m-0 text-[1.15rem] font-bold tracking-tight text-text-primary">Manifest Ledger</h1>
            <p className="m-0 mt-0.5 text-[0.78rem] text-text-secondary">
              Mint a CycloneDX or SPDX bill of materials for any package in the vault.
            </p>
          </div>
        </div>
      </div>

      <Card className="cyber-lift">
        <CardHeader title="Mint a manifest" description="One package in, a sealed ledger out" />
        <CardBody className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div>
              <label className={LABEL} htmlFor="sbom-eco">Ecosystem</label>
              <select id="sbom-eco" value={ecosystem} onChange={e => setEcosystem(e.target.value)} className={FIELD}>
                {ECOSYSTEMS.map(e => <option key={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL} htmlFor="sbom-pkg">Package</label>
              <input id="sbom-pkg" value={pkg} onChange={e => setPkg(e.target.value)} placeholder="package_" className={FIELD} />
            </div>
            <div>
              <label className={LABEL} htmlFor="sbom-ver">Version</label>
              <input id="sbom-ver" value={version} onChange={e => setVersion(e.target.value)} placeholder="version_" className={FIELD} />
            </div>
            <div>
              <label className={LABEL} htmlFor="sbom-fmt">Format</label>
              <select id="sbom-fmt" value={format} onChange={e => setFormat(e.target.value)} className={FIELD}>
                {FORMATS.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
          </div>
          <div>
            <button
              type="button"
              onClick={() => gen.mutate()}
              disabled={!pkg || !version || gen.isPending}
              className="wd-hover flex items-center gap-2 rounded bg-neon px-5 py-2.5 font-mono text-[0.76rem] font-bold uppercase tracking-widest text-void hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FileText size={14} />
              {gen.isPending ? 'Minting…' : 'Mint manifest'}
            </button>
          </div>
          {gen.isError && (
            <div className="flex items-center gap-2 rounded border border-[color-mix(in_srgb,var(--critical)_30%,transparent)] bg-[color-mix(in_srgb,var(--critical)_10%,transparent)] px-3 py-2.5 text-[0.78rem] text-critical">
              <AlertCircle size={14} className="shrink-0" />{(gen.error as Error).message}
            </div>
          )}
        </CardBody>
      </Card>

      {sbomText && generatedFor ? (
        <Card className="cyber-lift overflow-hidden">
          <CardHeader
            title={`${generatedFor.format} — ${generatedFor.pkg}@${generatedFor.version}`}
            description="Sealed and ready for extraction"
            action={
              <button
                type="button"
                onClick={download}
                className="wd-hover flex items-center gap-1.5 rounded border border-border-color bg-transparent px-2.5 py-1.5 font-mono text-[0.68rem] font-bold uppercase tracking-widest text-text-secondary hover:border-neon hover:text-neon"
              >
                <Download size={12} /> Extract
              </button>
            }
          />
          <CardBody className="max-h-96 overflow-auto p-0">
            <pre className="m-0 p-4 font-mono text-[0.74rem] leading-relaxed text-text-primary">
              {sbomText}
            </pre>
          </CardBody>
        </Card>
      ) : !gen.isError && (
        <Card className="cyber-lift">
          <CardBody>
            <EmptyState
              icon={ScrollText}
              title="Ledger is blank"
              description="Mint a manifest above and its full contents will unroll here."
              command="cwctl sbom npm/lodash@4.17.21"
            />
          </CardBody>
        </Card>
      )}
    </div>
  );
}

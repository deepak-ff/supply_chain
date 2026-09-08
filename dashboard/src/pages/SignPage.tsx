import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { signArtifact, verifyAttestation } from '../lib/api';
import { Key, CheckCircle2, XCircle, AlertCircle, Fingerprint, Copy } from 'lucide-react';
import type { Attestation } from '../types/api';
import { Card, CardHeader, CardBody } from '../components/ui/card';
import { CyberKicker } from '../components/cyber/CyberViz';
import { cn } from '../components/ui/utils';

const ECOSYSTEMS = ['npm', 'pypi', 'go', 'rubygems', 'crates', 'maven', 'huggingface', 'mcp'];

const FIELD = 'w-full rounded border border-border-color bg-bg-base px-3 py-2 font-mono text-[0.8rem] text-text-primary';
const LABEL = 'mb-1 block font-mono text-[0.62rem] font-bold uppercase tracking-[0.14em] text-text-muted';

export function SignPage() {
  const [ecosystem, setEcosystem] = useState('npm');
  const [pkg, setPkg] = useState('');
  const [version, setVersion] = useState('');
  const [sha256, setSha256] = useState('');
  const [attestation, setAttestation] = useState<Attestation | null>(null);
  const [verifyInput, setVerifyInput] = useState('');
  const [verifySHA, setVerifySHA] = useState('');

  const sign = useMutation({
    mutationFn: () => signArtifact(sha256, ecosystem, pkg, version),
    onSuccess: (data) => setAttestation(data),
  });

  const verify = useMutation({
    mutationFn: () => {
      let att: Attestation;
      try {
        att = JSON.parse(verifyInput) as Attestation;
      } catch {
        return Promise.reject(new Error('Invalid JSON — paste a valid attestation object'));
      }
      return verifyAttestation(att, verifySHA);
    },
  });

  const copyAtt = () => attestation && navigator.clipboard.writeText(JSON.stringify(attestation, null, 2));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <CyberKicker index="D-03" label="doctrine // threat prints" />
        <div className="flex items-center gap-2.5">
          <Fingerprint size={20} className="text-magenta drop-shadow-[0_0_8px_var(--magenta)]" aria-hidden="true" />
          <div>
            <h1 className="m-0 text-[1.15rem] font-bold tracking-tight text-text-primary">Threat Prints</h1>
            <p className="m-0 mt-0.5 text-[0.78rem] text-text-secondary">
              Sigstore keyless signing on the Rekor transparency log — ephemeral ECDSA P-256, no long-lived secrets.
            </p>
          </div>
        </div>
      </div>

      {/* Sign form */}
      <Card className="cyber-lift">
        <CardHeader title="Press a print" description="Sign an artifact into the transparency log" />
        <CardBody className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div>
              <label className={LABEL} htmlFor="print-eco">Ecosystem</label>
              <select id="print-eco" value={ecosystem} onChange={e => setEcosystem(e.target.value)} className={FIELD}>
                {ECOSYSTEMS.map(e => <option key={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL} htmlFor="print-pkg">Package</label>
              <input id="print-pkg" value={pkg} onChange={e => setPkg(e.target.value)} placeholder="name_" className={FIELD} />
            </div>
            <div>
              <label className={LABEL} htmlFor="print-ver">Version</label>
              <input id="print-ver" value={version} onChange={e => setVersion(e.target.value)} placeholder="version_" className={FIELD} />
            </div>
            <div>
              <label className={LABEL} htmlFor="print-sha">SHA256</label>
              <input id="print-sha" value={sha256} onChange={e => setSha256(e.target.value)} placeholder="hex hash_" className={FIELD} />
            </div>
          </div>
          <div>
            <button
              type="button"
              onClick={() => sign.mutate()}
              disabled={!sha256 || !pkg || !version || sign.isPending}
              className="wd-hover flex items-center gap-2 rounded bg-neon px-5 py-2.5 font-mono text-[0.76rem] font-bold uppercase tracking-widest text-void hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Key size={14} />{sign.isPending ? 'Pressing…' : 'Press print'}
            </button>
          </div>
          {sign.isError && (
            <div className="flex items-center gap-2 rounded border border-[color-mix(in_srgb,var(--critical)_30%,transparent)] bg-[color-mix(in_srgb,var(--critical)_10%,transparent)] px-3 py-2.5 text-[0.78rem] text-critical">
              <AlertCircle size={14} className="shrink-0" />{(sign.error as Error).message}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Attestation output */}
      {attestation && (
        <Card className="cyber-lift overflow-hidden">
          <CardHeader
            icon={CheckCircle2}
            title="Print pressed"
            description={attestation.rekor_log_id ? `Rekor sealed · ${attestation.rekor_log_id.slice(0, 16)}…` : 'Sealed and witnessed'}
            action={
              <button
                type="button"
                onClick={copyAtt}
                className="wd-hover flex items-center gap-1.5 rounded border border-border-color bg-transparent px-2.5 py-1.5 font-mono text-[0.68rem] font-bold uppercase tracking-widest text-text-secondary hover:border-neon hover:text-neon"
              >
                <Copy size={12} /> Copy JSON
              </button>
            }
          />
          <CardBody className="max-h-60 overflow-auto p-0">
            <pre className="m-0 p-4 font-mono text-[0.74rem] leading-relaxed text-success">
              {JSON.stringify(attestation, null, 2)}
            </pre>
          </CardBody>
        </Card>
      )}

      {/* Verify form */}
      <Card className="cyber-lift">
        <CardHeader title="Lift a print" description="Verify an attestation against its expected hash" />
        <CardBody className="flex flex-col gap-4">
          <div>
            <label className={LABEL} htmlFor="lift-json">Attestation JSON</label>
            <textarea
              id="lift-json"
              rows={4}
              value={verifyInput}
              onChange={e => setVerifyInput(e.target.value)}
              placeholder="Paste attestation JSON here…"
              className="w-full resize-y rounded border border-border-color bg-bg-base px-3 py-2 font-mono text-[0.76rem] text-text-primary"
            />
          </div>
          <div>
            <label className={LABEL} htmlFor="lift-sha">Expected SHA256</label>
            <input id="lift-sha" value={verifySHA} onChange={e => setVerifySHA(e.target.value)} placeholder="expected sha256 hex_" className={FIELD} />
          </div>
          <div>
            <button
              type="button"
              onClick={() => verify.mutate()}
              disabled={!verifyInput || !verifySHA || verify.isPending}
              className="wd-hover flex items-center gap-2 rounded border border-magenta bg-[color-mix(in_srgb,var(--magenta)_12%,transparent)] px-5 py-2.5 font-mono text-[0.76rem] font-bold uppercase tracking-widest text-magenta hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Fingerprint size={14} />
              {verify.isPending ? 'Lifting…' : 'Verify print'}
            </button>
          </div>
          {verify.isError && (
            <div className="flex items-center gap-2 rounded border border-[color-mix(in_srgb,var(--critical)_30%,transparent)] bg-[color-mix(in_srgb,var(--critical)_10%,transparent)] px-3 py-2.5 text-[0.78rem] text-critical">
              <XCircle size={14} className="shrink-0" />{(verify.error as Error).message}
            </div>
          )}
          {verify.data && (
            <div className={cn(
              'flex items-center gap-2 rounded border px-3 py-2.5 font-mono text-[0.76rem]',
              verify.data.valid
                ? 'border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_10%,transparent)] text-success'
                : 'border-[color-mix(in_srgb,var(--critical)_30%,transparent)] bg-[color-mix(in_srgb,var(--critical)_10%,transparent)] text-critical',
            )}>
              {verify.data.valid ? <CheckCircle2 size={14} className="shrink-0" /> : <XCircle size={14} className="shrink-0" />}
              {verify.data.valid
                ? `MATCH — sha256: ${verify.data.sha256_match}, rekor: ${verify.data.rekor_verified}`
                : `NO MATCH — ${verify.data.error}`}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

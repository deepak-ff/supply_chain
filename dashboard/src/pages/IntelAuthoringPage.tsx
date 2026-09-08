import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { generateSignature, validateSignatureYaml, testSignature } from '../lib/api';
import { PenTool, CheckCircle2, XCircle, AlertCircle, FlaskConical, Hammer, Copy } from 'lucide-react';
import type { SignatureType, GeneratedSignature } from '../types/api';
import { Card, CardHeader, CardBody } from '../components/ui/card';
import { CyberKicker } from '../components/cyber/CyberViz';
import { cn } from '../components/ui/utils';

const ECOSYSTEMS = ['npm', 'pypi', 'go', 'rubygems', 'crates', 'maven', 'huggingface', 'mcp', '*'];
const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL'];

const SIG_TYPES: { value: SignatureType; label: string; description: string }[] = [
  { value: 'blocklisted_package', label: 'blocklisted_package', description: 'A specific package version confirmed malicious' },
  { value: 'typosquatting_target', label: 'typosquatting_target', description: 'A popular package that attackers misspell to hijack' },
  { value: 'behavioral_rule', label: 'behavioral_rule', description: 'A dangerous install script pattern (regex)' },
  { value: 'malware_pattern', label: 'malware_pattern', description: 'A byte/regex pattern found in malware (regex)' },
  { value: 'mcp_injection_pattern', label: 'mcp_injection_pattern', description: 'A prompt injection pattern in MCP tool descriptions (regex)' },
  { value: 'pickle_rule', label: 'pickle_rule', description: 'An unsafe AI model configuration pattern' },
];

const FIELD = 'w-full rounded border border-border-color bg-bg-base px-3 py-2 font-mono text-[0.8rem] text-text-primary';
const LABEL = 'mb-1 block font-mono text-[0.62rem] font-bold uppercase tracking-[0.14em] text-text-muted';

function extraFieldLabel(type: SignatureType): { label: string; placeholder: string; multiline?: boolean } {
  switch (type) {
    case 'blocklisted_package': return { label: 'Package name', placeholder: 'evil-pkg_' };
    case 'typosquatting_target': return { label: 'Target package', placeholder: 'lodash_' };
    case 'malware_pattern': return { label: 'Regex pattern', placeholder: '(?i)eval\\(atob\\(' };
    case 'mcp_injection_pattern': return { label: 'Regex pattern', placeholder: '(?i)ignore (all )?previous instructions_' };
    case 'behavioral_rule': return { label: 'Rule text', placeholder: 'postinstall script downloads and executes remote binary_', multiline: true };
    case 'pickle_rule': return { label: 'Rule text', placeholder: '__reduce__ used to invoke os.system_', multiline: true };
  }
}

export function IntelAuthoringPage() {
  const [type, setType] = useState<SignatureType>('blocklisted_package');
  const [ecosystem, setEcosystem] = useState('npm');
  const [severity, setSeverity] = useState('CRITICAL');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [author, setAuthor] = useState('');
  const [cve, setCve] = useState('');
  const [reference, setReference] = useState('');
  const [extraValue, setExtraValue] = useState('');

  const [generated, setGenerated] = useState<GeneratedSignature | null>(null);
  const [yamlText, setYamlText] = useState('');

  const [testEco, setTestEco] = useState('npm');
  const [testPkg, setTestPkg] = useState('');
  const [testVersion, setTestVersion] = useState('');

  const extraField = extraFieldLabel(type);

  const generate = useMutation({
    mutationFn: () =>
      generateSignature({
        type,
        ecosystem,
        severity,
        name,
        description,
        author: author || 'anonymous',
        cve,
        references: reference ? [reference] : [],
        package: type === 'blocklisted_package' ? extraValue : undefined,
        target: type === 'typosquatting_target' ? extraValue : undefined,
        pattern: type === 'malware_pattern' || type === 'mcp_injection_pattern' ? extraValue : undefined,
        rule: type === 'behavioral_rule' || type === 'pickle_rule' ? extraValue : undefined,
        tags: [],
      }),
    onSuccess: (data) => {
      setGenerated(data);
      setYamlText(data.yaml);
    },
  });

  const validate = useMutation({
    mutationFn: () => validateSignatureYaml(yamlText),
  });

  const test = useMutation({
    mutationFn: () => testSignature(yamlText, testEco, testPkg, testVersion),
  });

  const copyYAML = () => yamlText && navigator.clipboard.writeText(yamlText);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <CyberKicker index="D-05" label="doctrine // print forge" />
        <div className="flex items-center gap-2.5">
          <Hammer size={20} className="text-magenta drop-shadow-[0_0_8px_var(--magenta)]" aria-hidden="true" />
          <div>
            <h1 className="m-0 text-[1.15rem] font-bold tracking-tight text-text-primary">Print Forge</h1>
            <p className="m-0 mt-0.5 text-[0.78rem] text-text-secondary">
              Forge new detection prints for the intel vault — then temper and test-fire each one.
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <Card className="cyber-lift">
        <CardHeader title="Fresh steel" description="Describe the threat — the forge casts the print" />
        <CardBody className="flex flex-col gap-4">
          <div>
            <label className={LABEL} htmlFor="forge-type">Print type</label>
            <select id="forge-type" value={type} onChange={e => setType(e.target.value as SignatureType)} className={FIELD}>
              {SIG_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <p className="m-0 mt-1 font-mono text-[0.7rem] text-text-muted">
              {SIG_TYPES.find(t => t.value === type)?.description}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL} htmlFor="forge-eco">Ecosystem</label>
              <select id="forge-eco" value={ecosystem} onChange={e => setEcosystem(e.target.value)} className={FIELD}>
                {ECOSYSTEMS.map(e => <option key={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL} htmlFor="forge-sev">Severity</label>
              <select id="forge-sev" value={severity} onChange={e => setSeverity(e.target.value)} className={FIELD}>
                {SEVERITIES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={LABEL} htmlFor="forge-name">Name</label>
            <input id="forge-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Backdoor in evil-pkg_" className={FIELD} />
          </div>

          <div>
            <label className={LABEL} htmlFor="forge-desc">Description</label>
            <textarea id="forge-desc" rows={3} value={description} onChange={e => setDescription(e.target.value)}
              placeholder="What does it do / why is it dangerous?_"
              className={`${FIELD} resize-y`} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL} htmlFor="forge-author">Smith</label>
              <input id="forge-author" value={author} onChange={e => setAuthor(e.target.value)} placeholder="anonymous_" className={FIELD} />
            </div>
            <div>
              <label className={LABEL} htmlFor="forge-cve">CVE (optional)</label>
              <input id="forge-cve" value={cve} onChange={e => setCve(e.target.value)} placeholder="CVE-YYYY-NNNNN_" className={FIELD} />
            </div>
          </div>

          <div>
            <label className={LABEL} htmlFor="forge-ref">Reference URL (optional)</label>
            <input id="forge-ref" value={reference} onChange={e => setReference(e.target.value)} placeholder="https://…_" className={FIELD} />
          </div>

          <div>
            <label className={LABEL} htmlFor="forge-extra">{extraField.label}</label>
            {extraField.multiline ? (
              <textarea id="forge-extra" rows={2} value={extraValue} onChange={e => setExtraValue(e.target.value)}
                placeholder={extraField.placeholder}
                className={`${FIELD} resize-y`} />
            ) : (
              <input id="forge-extra" value={extraValue} onChange={e => setExtraValue(e.target.value)}
                placeholder={extraField.placeholder}
                className={FIELD} />
            )}
          </div>

          <div>
            <button
              type="button"
              onClick={() => generate.mutate()}
              disabled={!name || !description || !extraValue || generate.isPending}
              className="wd-hover flex items-center gap-2 rounded bg-neon px-5 py-2.5 font-mono text-[0.76rem] font-bold uppercase tracking-widest text-void hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PenTool size={14} />{generate.isPending ? 'Forging…' : 'Forge print'}
            </button>
          </div>
          {generate.isError && (
            <div className="flex items-center gap-2 rounded border border-[color-mix(in_srgb,var(--critical)_30%,transparent)] bg-[color-mix(in_srgb,var(--critical)_10%,transparent)] px-3 py-2.5 text-[0.78rem] text-critical">
              <AlertCircle size={14} className="shrink-0" />{(generate.error as Error).message}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Generated YAML */}
      {generated && (
        <Card className="cyber-lift overflow-hidden">
          <CardHeader
            icon={CheckCircle2}
            title={generated.id}
            description="Fresh from the anvil"
            action={
              <button
                type="button"
                onClick={copyYAML}
                className="wd-hover flex items-center gap-1.5 rounded border border-border-color bg-transparent px-2.5 py-1.5 font-mono text-[0.68rem] font-bold uppercase tracking-widest text-text-secondary hover:border-neon hover:text-neon"
              >
                <Copy size={12} /> Copy YAML
              </button>
            }
          />
          <CardBody className="max-h-72 overflow-auto p-0">
            <pre className="m-0 bg-bg-base p-4 font-mono text-[0.74rem] leading-relaxed text-neon">
              {yamlText}
            </pre>
          </CardBody>
          <div className="border-t border-border-color bg-surface px-4 py-2 font-mono text-[0.7rem] text-text-muted">
            Suggested vault slot: <code className="text-success">{generated.suggested_path}</code>
          </div>
        </Card>
      )}

      {/* Validate */}
      {generated && (
        <Card className="cyber-lift">
          <CardHeader title="Temper the steel" description="Validate the fresh print before it ships" />
          <CardBody className="flex flex-col gap-3">
            <div>
              <button
                type="button"
                onClick={() => validate.mutate()}
                disabled={!yamlText || validate.isPending}
                className="wd-hover flex items-center gap-2 rounded border border-magenta bg-[color-mix(in_srgb,var(--magenta)_12%,transparent)] px-5 py-2.5 font-mono text-[0.76rem] font-bold uppercase tracking-widest text-magenta hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CheckCircle2 size={14} />
                {validate.isPending ? 'Tempering…' : 'Validate print'}
              </button>
            </div>
            {validate.data && (
              <div className={cn(
                'flex items-start gap-2 rounded border px-3 py-2.5 font-mono text-[0.76rem]',
                validate.data.valid
                  ? 'border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_10%,transparent)] text-success'
                  : 'border-[color-mix(in_srgb,var(--critical)_30%,transparent)] bg-[color-mix(in_srgb,var(--critical)_10%,transparent)] text-critical',
              )}>
                {validate.data.valid ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> : <XCircle size={14} className="mt-0.5 shrink-0" />}
                {validate.data.valid ? (
                  'TEMPERED — print is battle-ready'
                ) : (
                  <ul className="m-0 list-inside list-disc">
                    {validate.data.problems.map(p => <li key={p}>{p}</li>)}
                  </ul>
                )}
              </div>
            )}
            {validate.isError && (
              <div className="flex items-center gap-2 rounded border border-[color-mix(in_srgb,var(--critical)_30%,transparent)] bg-[color-mix(in_srgb,var(--critical)_10%,transparent)] px-3 py-2.5 text-[0.78rem] text-critical">
                <AlertCircle size={14} className="shrink-0" />{(validate.error as Error).message}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Test against a live package */}
      {generated && (
        <Card className="cyber-lift">
          <CardHeader title="Test-fire" description="Loose the fresh print at a live package" />
          <CardBody className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <select value={testEco} onChange={e => setTestEco(e.target.value)} aria-label="Test ecosystem" className={FIELD}>
                {ECOSYSTEMS.filter(e => e !== '*').map(e => <option key={e}>{e}</option>)}
              </select>
              <input value={testPkg} onChange={e => setTestPkg(e.target.value)} placeholder="package_" aria-label="Test package" className={FIELD} />
              <input value={testVersion} onChange={e => setTestVersion(e.target.value)} placeholder="version_" aria-label="Test version" className={FIELD} />
            </div>
            <div>
              <button
                type="button"
                onClick={() => test.mutate()}
                disabled={!testPkg || !testVersion || test.isPending}
                className="wd-hover flex items-center gap-2 rounded border border-magenta bg-[color-mix(in_srgb,var(--magenta)_12%,transparent)] px-5 py-2.5 font-mono text-[0.76rem] font-bold uppercase tracking-widest text-magenta hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FlaskConical size={14} />{test.isPending ? 'Firing…' : 'Test-fire print'}
              </button>
            </div>
            {test.data && (
              <div className={cn(
                'rounded border px-3 py-2.5 font-mono text-[0.76rem]',
                test.data.matched
                  ? 'border-[color-mix(in_srgb,var(--warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] text-warning'
                  : 'border-border-color bg-bg-base text-text-muted',
              )}>
                <p className="m-0 font-bold">{test.data.matched ? `DIRECT HIT — ${test.data.findings.length} finding(s)` : 'CLEAN MISS — no match'}</p>
                <p className="m-0 mt-1 font-sans text-[0.74rem] text-text-secondary">{test.data.note}</p>
              </div>
            )}
            {test.isError && (
              <div className="flex items-center gap-2 rounded border border-[color-mix(in_srgb,var(--critical)_30%,transparent)] bg-[color-mix(in_srgb,var(--critical)_10%,transparent)] px-3 py-2.5 text-[0.78rem] text-critical">
                <AlertCircle size={14} className="shrink-0" />{(test.error as Error).message}
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}

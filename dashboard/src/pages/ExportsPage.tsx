import { useState } from 'react';
import { Download, FileJson, FileCode, FileText, FileSpreadsheet, CheckCircle, FileDown } from 'lucide-react';
import { useUIStore } from '../store/ui';
import { Card, CardBody } from '../components/ui/card';
import { CyberKicker } from '../components/cyber/CyberViz';
import { cn } from '../components/ui/utils';

const BASE = import.meta.env.VITE_API_URL ?? '';

async function downloadReport(format: 'json' | 'csv') {
  const res = await fetch(`${BASE}/api/v1/export/report?format=${format}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Export failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const date = new Date().toISOString().slice(0, 10);
  a.download = `chainwarden-report-${date}.${format}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ExportsPage() {
  const navigate = useUIStore(s => s.navigate);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const handleDownload = async (format: 'json' | 'csv') => {
    setDownloading(format);
    setDone(null);
    try {
      await downloadReport(format);
      setDone(format);
      setTimeout(() => setDone(null), 3000);
    } finally {
      setDownloading(null);
    }
  };

  const reports = [
    {
      icon: FileJson,
      title: 'Sweep report (JSON)',
      desc: 'Full sweep results with threat scores, severity breakdown and timestamps. Machine-readable, ready to pipe into other weapons.',
      tone: 'text-neon',
      format: 'json' as const,
    },
    {
      icon: FileSpreadsheet,
      title: 'Sweep report (CSV)',
      desc: 'Spreadsheet-compatible results. Drop into Excel, Sheets or any data rig for custom war-room analysis.',
      tone: 'text-success',
      format: 'csv' as const,
    },
  ];

  const sbomFormats = [
    {
      icon: FileJson,
      title: 'CycloneDX JSON',
      desc: 'Machine-readable manifest in CycloneDX 1.5 JSON. Feeds Dependency-Track, OWASP tooling and most pipelines.',
      tone: 'text-magenta',
      hint: 'cwctl sbom npm/express@4.18.2 --format cyclonedx-json',
    },
    {
      icon: FileCode,
      title: 'CycloneDX XML',
      desc: 'CycloneDX 1.5 XML. Demanded by some enterprise arsenals and legacy scanners.',
      tone: 'text-neon',
      hint: 'cwctl sbom npm/express@4.18.2 --format cyclonedx-xml',
    },
    {
      icon: FileText,
      title: 'SPDX',
      desc: 'Software Package Data Exchange. ISO/IEC 5962:2021 — the paperwork the US government supply chain demands.',
      tone: 'text-warning',
      hint: 'cwctl sbom npm/express@4.18.2 --format spdx-json',
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <CyberKicker index="U-02" label="uplinks // intel extracts" />
        <div className="flex items-center gap-2.5">
          <FileDown size={20} className="text-magenta drop-shadow-[0_0_8px_var(--magenta)]" aria-hidden="true" />
          <div>
            <h1 className="m-0 text-[1.15rem] font-bold tracking-tight text-text-primary">Intel Extracts</h1>
            <p className="m-0 mt-0.5 text-[0.78rem] text-text-secondary">
              Exfiltrate sweep results, manifests and reports in standard-issue formats.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="m-0 font-mono text-[0.72rem] font-bold uppercase tracking-[0.18em] text-text-muted">Sweep reports</h2>
        {reports.map(f => (
          <Card key={f.title} className="cyber-lift">
            <CardBody className="flex items-start gap-4">
              <f.icon size={20} className={cn('mt-0.5 shrink-0', f.tone)} />
              <div className="min-w-0 flex-1">
                <p className="m-0 text-[0.85rem] font-bold text-text-primary">{f.title}</p>
                <p className="m-0 mt-1 text-[0.76rem] leading-relaxed text-text-secondary">{f.desc}</p>
              </div>
              <button
                type="button"
                onClick={() => handleDownload(f.format)}
                disabled={downloading === f.format}
                className={cn(
                  'wd-hover flex shrink-0 items-center gap-1.5 rounded border px-3 py-1.5 font-mono text-[0.72rem] font-bold uppercase tracking-widest',
                  done === f.format
                    ? 'border-success bg-[color-mix(in_srgb,var(--success)_12%,transparent)] text-success'
                    : 'border-neon bg-[color-mix(in_srgb,var(--neon)_10%,transparent)] text-neon hover:shadow-glow',
                )}
              >
                {done === f.format ? <><CheckCircle size={12} /> Extracted</> :
                 downloading === f.format ? 'Extracting…' :
                 <><Download size={12} /> Extract</>}
              </button>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="m-0 font-mono text-[0.72rem] font-bold uppercase tracking-[0.18em] text-text-muted">Manifest formats</h2>
        {sbomFormats.map(f => (
          <Card key={f.title} className="cyber-lift">
            <CardBody className="flex items-start gap-4">
              <f.icon size={20} className={cn('mt-0.5 shrink-0', f.tone)} />
              <div className="min-w-0 flex-1">
                <p className="m-0 text-[0.85rem] font-bold text-text-primary">{f.title}</p>
                <p className="m-0 mt-1 text-[0.76rem] leading-relaxed text-text-secondary">{f.desc}</p>
                <code className="mt-2 block truncate font-mono text-[0.72rem] text-neon">{f.hint}</code>
              </div>
              <button
                type="button"
                onClick={() => navigate('/sbom')}
                className="wd-hover shrink-0 rounded border border-neon bg-[color-mix(in_srgb,var(--neon)_10%,transparent)] px-3 py-1.5 font-mono text-[0.72rem] font-bold uppercase tracking-widest text-neon hover:shadow-glow"
              >
                Mint →
              </button>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}

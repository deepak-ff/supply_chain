import { useState, useMemo, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { triggerScan, scanUpload, getJobStatus, triggerRemoteScan, getRemoteScanJobStatus, getRecentResults } from '../lib/api';
import { FindingsTable } from '../components/FindingsTable';
import {
  Search, Upload, AlertCircle, ShieldCheck, CheckCircle, XCircle, Loader,
  Server, Lock, Clock, FolderOpen, Package, RefreshCw,
} from 'lucide-react';
import type { EngineStatus, ScanSummary, ProjectScanResult } from '../types/api';
import { useSessionStore } from '../store/sessions';
import { useWorkspaceStore } from '../store/workspace';
import { Card, CardHeader, CardBody } from '../components/ui/card';
import { StatTile, type StatTileAccent } from '../components/ui/stat-tile';
import { StatusChip } from '../components/ui/status-chip';
import { DataTable, type DataTableColumn } from '../components/ui/data-table';
import { EmptyState } from '../components/EmptyState';
import { cn } from '../components/ui/utils';
import { axisProps, barTooltipProps, gridProps, tooltipProps } from '../lib/chartTheme';

const ECOSYSTEMS = ['npm', 'pypi', 'go', 'rubygems', 'crates', 'maven', 'huggingface', 'mcp'];

// Mirrors the Go backend's internal/policy/policy.go severityOrd ordering.
const SEVERITY_ORDER: Record<string, number> = {
  CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, INFORMATIONAL: 0,
};

type SeverityFilter = 'all' | 'critical' | 'high' | 'medium';

const SEVERITY_FILTER_THRESHOLD: Record<SeverityFilter, number> = {
  all: -1,
  critical: SEVERITY_ORDER.CRITICAL,
  high: SEVERITY_ORDER.HIGH,
  medium: SEVERITY_ORDER.MEDIUM,
};

const SUMMARY_TILES: Array<{
  key: 'critical' | 'high' | 'medium' | 'low'; label: string; accent: StatTileAccent;
  fill: string; swatch: string;
}> = [
  { key: 'critical', label: 'Critical', accent: 'critical', fill: 'var(--critical)', swatch: 'bg-critical' },
  { key: 'high',     label: 'High',     accent: 'amber',    fill: 'var(--amber)',    swatch: 'bg-amber' },
  { key: 'medium',   label: 'Medium',   accent: 'warning',  fill: 'var(--warning)',  swatch: 'bg-warning' },
  { key: 'low',      label: 'Low',      accent: 'teal',     fill: 'var(--teal)',     swatch: 'bg-teal' },
];

// ── shared styling ─────────────────────────────────────────────────────────

const FIELD =
  'wd-hover w-full rounded border border-border-color bg-bg-base px-3 py-2 font-mono text-[0.8rem] text-text-primary placeholder:text-text-muted hover:border-text-muted';

const LABEL = 'mb-1 block font-mono text-[0.65rem] uppercase tracking-wide text-text-muted';

const PRIMARY_BTN =
  'wd-hover flex items-center gap-2 rounded bg-success px-5 py-2 font-mono text-[0.8rem] font-bold text-[#06170E] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50';

const GHOST_BTN =
  'wd-hover rounded border border-border-color bg-surface px-2.5 py-1 font-mono text-[0.72rem] text-text-secondary hover:bg-surface-muted hover:text-text-primary';

function Alert({ tone, children }: { tone: 'critical' | 'warning'; children: React.ReactNode }) {
  return (
    <div
      role={tone === 'critical' ? 'alert' : undefined}
      className={cn(
        'flex items-start gap-2 rounded border px-3 py-2.5 text-[0.76rem]',
        tone === 'critical'
          ? 'border-[color-mix(in_srgb,var(--critical)_25%,transparent)] bg-[color-mix(in_srgb,var(--critical)_10%,transparent)] text-critical'
          : 'border-[color-mix(in_srgb,var(--warning)_25%,transparent)] bg-[color-mix(in_srgb,var(--warning)_8%,transparent)] text-warning',
      )}
    >
      <AlertCircle size={14} className="mt-px shrink-0" aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <span className="block font-mono text-[0.62rem] uppercase tracking-wide text-text-muted">{label}</span>
      <p className="m-0 mt-0.5 font-mono text-[0.8rem] font-semibold break-all text-text-primary">{children}</p>
    </div>
  );
}

function SummaryTiles({ summary }: { summary: ScanSummary }) {
  return (
    <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
      {SUMMARY_TILES.map((t) => (
        <StatTile key={t.key} label={t.label} value={summary[t.key]} accent={t.accent} />
      ))}
      <StatTile label="Total findings" value={summary.total} />
    </div>
  );
}

function EngineStatusBar({ engines }: { engines: EngineStatus[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {engines.map((e) => (
        <span
          key={e.engine}
          className={cn(
            'inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[0.68rem]',
            e.status === 'ok'
              ? 'border-[color-mix(in_srgb,var(--success)_25%,transparent)] bg-[color-mix(in_srgb,var(--success)_10%,transparent)] text-success'
              : 'border-border-color bg-surface-muted text-text-muted',
          )}
        >
          {e.status === 'ok' ? <CheckCircle size={10} /> : <XCircle size={10} />}
          {e.engine}
          {e.findings > 0 && <span className="font-bold text-warning">({e.findings})</span>}
        </span>
      ))}
    </div>
  );
}

// ── scan history ───────────────────────────────────────────────────────────

interface RecentResult {
  package: string; version: string; ecosystem: string;
  severity: string; findings_count: number; scanned_at: string;
}

const historyColumns: Array<DataTableColumn<RecentResult>> = [
  { key: 'package', header: 'Package', sortable: true, sortValue: (r) => r.package,
    render: (r) => <span className="font-mono text-text-primary">{r.package}</span> },
  { key: 'version', header: 'Version', sortable: true, sortValue: (r) => r.version,
    render: (r) => <span className="font-mono text-[0.72rem] text-text-muted">{r.version}</span>,
    className: 'w-[120px]' },
  { key: 'ecosystem', header: 'Ecosystem', sortable: true, sortValue: (r) => r.ecosystem,
    render: (r) => <span className="text-[0.72rem] uppercase text-text-muted">{r.ecosystem}</span>,
    className: 'w-[110px]' },
  { key: 'severity', header: 'Severity', sortable: true,
    sortValue: (r) => SEVERITY_ORDER[r.severity] ?? 0,
    render: (r) => <StatusChip tone={r.severity} dot={false} />,
    className: 'w-[110px]' },
  { key: 'count', header: 'Findings', numeric: true, sortable: true, sortValue: (r) => r.findings_count,
    render: (r) => <span className="font-semibold">{r.findings_count}</span>,
    className: 'w-[88px]' },
  { key: 'scanned', header: 'Scanned', numeric: true, sortable: true,
    sortValue: (r) => new Date(r.scanned_at).getTime(),
    render: (r) => (
      <span className="text-[0.72rem] text-text-muted">
        {new Date(r.scanned_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
      </span>
    ),
    className: 'w-[150px]' },
];

function ScanHistory({ onRescan }: { onRescan: (eco: string, name: string, ver: string) => void }) {
  const recent = useQuery({ queryKey: ['recent-scans'], queryFn: () => getRecentResults(10), retry: false });
  const results: RecentResult[] = recent.data?.results ?? [];

  const columns = useMemo<Array<DataTableColumn<RecentResult>>>(() => [
    ...historyColumns,
    {
      key: 'action', header: '', render: (r) => (
        <button
          type="button"
          onClick={() => onRescan(r.ecosystem, r.package, r.version)}
          className={GHOST_BTN}
        >
          Rescan
        </button>
      ),
      className: 'w-[92px] text-right',
    },
  ], [onRescan]);

  return (
    <Card>
      <CardHeader
        icon={Clock}
        title="Recent scans"
        description="Last ten results recorded by the server — pick one to re-run it." />
      <DataTable
        columns={columns}
        rows={results}
        rowKey={(r) => `${r.ecosystem}:${r.package}@${r.version}-${r.scanned_at}`}
        loading={recent.isLoading}
        skeletonRows={4}
        dense
        initialSort={{ key: 'scanned', dir: 'desc' }}
        empty={{
          icon: Search,
          title: 'No scan results yet',
          description: 'Pick a registry package above, or upload an archive — then run a full scan.',
          command: 'cwctl scan .',
        }}
      />
    </Card>
  );
}

// ── project scan results (upload + remote share this shape) ────────────────

function ProjectResults({ result, origin }: { result: ProjectScanResult; origin: React.ReactNode }) {
  const engineData = result.results
    .flatMap((r) => r.findings)
    .reduce<Record<string, number>>((acc, f) => {
      const k = f.source || 'unknown';
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
  const bars = Object.entries(engineData).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader icon={FolderOpen} title="Scan target" />
        <CardBody className="flex flex-wrap gap-x-10 gap-y-3">{origin}</CardBody>
      </Card>

      <SummaryTiles summary={result.summary} />

      {result.missing_tools.length > 0 && (
        <Alert tone="warning">
          Engines unavailable on the scanning server: {result.missing_tools.join(', ')}
        </Alert>
      )}

      {bars.length > 0 && (
        <Card>
          <CardHeader title="Findings by engine" description="Attributed across the scanned manifests" />
          <CardBody>
            <ResponsiveContainer width="100%" height={Math.max(140, bars.length * 30)}>
              <BarChart data={bars} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                <CartesianGrid {...gridProps} horizontal={false} vertical />
                <XAxis type="number" {...axisProps} />
                <YAxis type="category" dataKey="name" {...axisProps} width={84} />
                <RechartsTooltip {...barTooltipProps} />
                <Bar dataKey="count" fill="var(--chart-1)" radius={[0, 4, 4, 0]} barSize={16} isAnimationActive animationDuration={200} />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      )}

      {result.manifests.length === 0 ? (
        <Card>
          <CardBody>
            <Alert tone="warning">No recognised dependency manifests found in this archive.</Alert>
          </CardBody>
        </Card>
      ) : result.summary.total === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={ShieldCheck}
              title={`No findings across ${result.manifests.length} manifest file(s)`}
              description="Every engine came back clean for this target." />
          </CardBody>
        </Card>
      ) : (
        result.results.map((r, i) => (
          r.findings.length === 0 ? null : (
            <Card key={i}>
              <CardHeader
                title={`${r.entry.ecosystem}/${r.entry.name}@${r.entry.version}`}
                description={r.entry.file_path}
              />
              <FindingsTable findings={r.findings} />
            </Card>
          )
        ))
      )}
    </div>
  );
}

// ── page ───────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'registry', label: 'Registry Package', icon: Search },
  { id: 'upload',   label: 'Upload Project',   icon: Upload },
  { id: 'remote',   label: 'Remote Host',      icon: Server },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function ScanPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabId>('registry');

  // Registry scan state
  const [ecosystem, setEcosystem] = useState('npm');
  const [pkg, setPkg] = useState('');
  const [version, setVersion] = useState('');

  // Upload scan state
  const [dragOver, setDragOver] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Remote (SSH) scan state — privateKey is held only in component state,
  // sent once per request, never written anywhere persistent on this side.
  const [remoteTarget, setRemoteTarget] = useState('');
  const [remotePort, setRemotePort] = useState('22');
  const [remotePrivateKey, setRemotePrivateKey] = useState('');
  const [remotePath, setRemotePath] = useState('');
  const [acceptNewHostKey, setAcceptNewHostKey] = useState(false);
  const [remoteJobId, setRemoteJobId] = useState<string | null>(null);

  const [grouped, setGrouped] = useState(true);
  const [jobId, setJobId] = useState<string | null>(null);
  const [uploadJobId, setUploadJobId] = useState<string | null>(null);

  // Client-side result filters — purely narrowing what's already in `result`.
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [onlyFixable, setOnlyFixable] = useState(false);

  const registryScan = useMutation({
    mutationFn: () => triggerScan(ecosystem, pkg, version),
    onSuccess: (job) => setJobId(job.job_id),
  });

  const uploadScan = useMutation({
    mutationFn: () => scanUpload(uploadFile!, uploadFile!.name),
    onSuccess: (job) => setUploadJobId(job.job_id),
  });

  const remoteScan = useMutation({
    mutationFn: () => {
      if (!remoteTarget.includes('@')) {
        throw new Error('Target must be in user@host format (e.g. deploy@10.0.4.12)');
      }
      return triggerRemoteScan({
        target: remoteTarget,
        privateKey: remotePrivateKey,
        port: remotePort ? Number(remotePort) : undefined,
        remotePath: remotePath || undefined,
        acceptNewHostKey,
      });
    },
    onSuccess: (job) => setRemoteJobId(job.job_id),
  });

  const jobPoll = useQuery({
    queryKey: ['scan-job', jobId],
    queryFn: () => getJobStatus(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'complete' || status === 'failed' ? false : 2_000;
    },
  });

  const uploadJobPoll = useQuery({
    queryKey: ['upload-scan-job', uploadJobId],
    queryFn: () => getRemoteScanJobStatus(uploadJobId!),
    enabled: !!uploadJobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'complete' || status === 'failed' ? false : 2_000;
    },
  });

  const remoteJobPoll = useQuery({
    queryKey: ['remote-scan-job', remoteJobId],
    queryFn: () => getRemoteScanJobStatus(remoteJobId!),
    enabled: !!remoteJobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'complete' || status === 'failed' ? false : 2_000;
    },
  });

  const job = jobPoll.data;
  const result = job?.status === 'complete' ? job.result ?? null : null;

  const uploadJob = uploadJobPoll.data;
  const uploadResult = uploadJob?.status === 'complete' ? uploadJob.result ?? null : null;
  const uploadIsPending = uploadScan.isPending
    || (!!uploadJobId && uploadJob?.status !== 'complete' && uploadJob?.status !== 'failed');
  const uploadError = uploadScan.error
    || (uploadJob?.status === 'failed' ? new Error(uploadJob.error || 'upload scan failed') : undefined);

  const remoteJob = remoteJobPoll.data;
  const remoteResult = remoteJob?.status === 'complete' ? remoteJob.result ?? null : null;
  const remoteIsPending = remoteScan.isPending
    || (!!remoteJobId && remoteJob?.status !== 'complete' && remoteJob?.status !== 'failed');
  const remoteError = remoteScan.error
    || (remoteJob?.status === 'failed' ? new Error(remoteJob.error || 'remote scan failed') : undefined);

  // Derived, filtered view of result.findings — never mutates `result` itself.
  const filteredFindings = useMemo(() => {
    if (!result) return [];
    const threshold = SEVERITY_FILTER_THRESHOLD[severityFilter];
    return result.findings.filter((f) => {
      if ((SEVERITY_ORDER[f.severity] ?? 0) < threshold) return false;
      if (onlyFixable && !f.fixed_version) return false;
      return true;
    });
  }, [result, severityFilter, onlyFixable]);

  const groupedFindings = useMemo(() => {
    if (!grouped || !result) return null;
    const map = new Map<string, typeof filteredFindings>();
    for (const f of filteredFindings) {
      const key = f.source || 'unknown';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    }
    return map;
  }, [filteredFindings, grouped, result]);

  const isPending = registryScan.isPending
    || (!!jobId && job?.status !== 'complete' && job?.status !== 'failed');
  const error = registryScan.error
    || (job?.status === 'failed' ? new Error(job.error || 'scan failed') : undefined);

  // Auto-save scan results as sessions
  const saveSession = useSessionStore((s) => s.save);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeId);
  const savedRef = useRef<Set<string>>(new Set());

  const invalidateDashboard = () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-timeline'] });
    queryClient.invalidateQueries({ queryKey: ['monitor-stats'] });
    queryClient.invalidateQueries({ queryKey: ['risks'] });
    queryClient.invalidateQueries({ queryKey: ['recent-results'] });
  };

  useEffect(() => {
    if (result && jobId && !savedRef.current.has(jobId)) {
      savedRef.current.add(jobId);
      const emptySummary: ScanSummary = { critical: 0, high: 0, medium: 0, low: 0, informational: 0, total: 0, highest_sev: 'LOW' };
      saveSession({
        workspace_id: activeWorkspaceId,
        scan_type: 'registry',
        label: `${ecosystem}/${pkg}@${version || 'latest'}`,
        ecosystem,
        package_name: pkg,
        version: version || undefined,
        result,
        project_result: null,
        summary: result.summary || emptySummary,
        findings: result.findings || [],
      });
      invalidateDashboard();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, jobId, ecosystem, pkg, version, saveSession, activeWorkspaceId]);

  useEffect(() => {
    if (uploadResult && uploadJobId && !savedRef.current.has(uploadJobId)) {
      savedRef.current.add(uploadJobId);
      saveSession({
        workspace_id: activeWorkspaceId,
        scan_type: 'upload',
        label: uploadFile?.name || 'Uploaded archive',
        result: null,
        project_result: uploadResult,
        summary: uploadResult.summary,
        findings: uploadResult.results?.flatMap((r) => r.findings || []) || [],
      });
      invalidateDashboard();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadResult, uploadJobId, uploadFile, saveSession, activeWorkspaceId]);

  useEffect(() => {
    if (remoteResult && remoteJobId && !savedRef.current.has(remoteJobId)) {
      savedRef.current.add(remoteJobId);
      saveSession({
        workspace_id: activeWorkspaceId,
        scan_type: 'remote',
        label: remoteTarget || 'Remote scan',
        result: null,
        project_result: remoteResult,
        summary: remoteResult.summary,
        findings: remoteResult.results?.flatMap((r) => r.findings || []) || [],
      });
      invalidateDashboard();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteResult, remoteJobId, remoteTarget, saveSession, activeWorkspaceId]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) setUploadFile(f);
  };

  const sevData = result
    ? SUMMARY_TILES.map((t) => ({ name: t.label, value: result.summary[t.key], fill: t.fill, swatch: t.swatch })).filter((d) => d.value > 0)
    : [];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="m-0 text-[1.05rem] font-semibold text-text-primary">Vulnerability Scanner</h1>
        <p className="m-0 mt-1.5 text-[0.78rem] text-text-secondary">
          Full 8-engine scan — OSV · Grype · Semgrep · Trivy · Behavioral · Malware · AI-Model · MCP
        </p>
      </header>

      {/* Tabs */}
      <div role="tablist" aria-label="Scan source" className="flex gap-1 border-b border-border-color">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'wd-hover -mb-px flex items-center gap-1.5 border-b-2 bg-transparent px-4 py-2 font-mono text-[0.76rem] font-semibold',
              tab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary',
            )}
          >
            <t.icon size={13} aria-hidden="true" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Registry scan form */}
      {tab === 'registry' && (
        <Card>
          <CardHeader
            title="Registry package"
            description="Downloads the package from its registry and runs all engines against the real files." />
          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className={LABEL} htmlFor="scan-ecosystem">Ecosystem</label>
                <select
                  id="scan-ecosystem"
                  value={ecosystem}
                  onChange={(e) => setEcosystem(e.target.value)}
                  className={FIELD}
                >
                  {ECOSYSTEMS.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL} htmlFor="scan-package">Package</label>
                <input
                  id="scan-package"
                  value={pkg}
                  onChange={(e) => setPkg(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && pkg && version && !isPending && registryScan.mutate()}
                  placeholder="e.g. lodash"
                  className={FIELD}
                />
              </div>
              <div>
                <label className={LABEL} htmlFor="scan-version">Version</label>
                <input
                  id="scan-version"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && pkg && version && !isPending && registryScan.mutate()}
                  placeholder="e.g. 4.17.21"
                  className={FIELD}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => registryScan.mutate()}
              disabled={!pkg || !version || isPending}
              className={PRIMARY_BTN}
            >
              {isPending ? <Loader size={14} className="animate-spin" /> : <Search size={14} />}
              {isPending ? 'Scanning…' : 'Run full scan'}
            </button>
          </CardBody>
        </Card>
      )}

      {/* Upload form */}
      {tab === 'upload' && (
        <Card>
          <CardHeader
            title="Upload project"
            description="Upload a project archive (.tar.gz, .zip) or a single file. All engines run against the extracted contents." />
          <CardBody className="space-y-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click(); }}
              role="button"
              tabIndex={0}
              aria-label="Choose an archive to scan"
              className={cn(
                'wd-hover cursor-pointer rounded border-2 border-dashed p-8 text-center',
                dragOver
                  ? 'border-success bg-[color-mix(in_srgb,var(--success)_6%,transparent)]'
                  : 'border-border-color hover:border-text-muted hover:bg-surface-muted/50',
              )}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".tar.gz,.tgz,.zip,.whl,.gem,.jar,.tar"
                className="hidden"
                onChange={(e) => { if (e.target.files?.[0]) setUploadFile(e.target.files[0]); }}
              />
              <Upload size={28} className="mx-auto mb-3 text-text-muted" aria-hidden="true" />
              {uploadFile ? (
                <>
                  <p className="m-0 font-mono text-[0.85rem] font-semibold text-success">{uploadFile.name}</p>
                  <p className="m-0 mt-1 text-[0.72rem] text-text-muted">
                    {(uploadFile.size / 1024 / 1024).toFixed(2)} MB — click to change
                  </p>
                </>
              ) : (
                <>
                  <p className="m-0 text-[0.85rem] text-text-primary">Drop archive here or click to browse</p>
                  <p className="m-0 mt-1 text-[0.72rem] text-text-muted">
                    .tar.gz · .tgz · .zip · .jar · .gem · .whl (max 512 MB)
                  </p>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => uploadScan.mutate()}
              disabled={!uploadFile || uploadIsPending}
              className={PRIMARY_BTN}
            >
              {uploadIsPending ? <Loader size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploadIsPending ? 'Scanning…' : 'Scan uploaded file'}
            </button>

            {uploadError && <Alert tone="critical">{(uploadError as Error).message}</Alert>}
          </CardBody>
        </Card>
      )}

      {/* Remote (SSH) scan form */}
      {tab === 'remote' && (
        <Card>
          <CardHeader
            title="Remote host"
            description="Connects over SSH, discovers dependency manifests and pulls them to scan locally. Nothing is installed on the target — only read-only find/cat commands run remotely." />
          <CardBody className="space-y-4">
            <Alert tone="warning">
              <Lock size={12} className="mr-1 inline align-[-1px]" aria-hidden="true" />
              The private key below is sent once for this scan and is never written to disk or stored
              by the server. Key-based auth only — no passwords.
            </Alert>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="md:col-span-2">
                <label className={LABEL} htmlFor="remote-target">Target (user@host)</label>
                <input
                  id="remote-target"
                  value={remoteTarget}
                  onChange={(e) => setRemoteTarget(e.target.value)}
                  placeholder="e.g. deploy@10.0.4.12"
                  className={FIELD}
                />
              </div>
              <div>
                <label className={LABEL} htmlFor="remote-port">Port</label>
                <input
                  id="remote-port"
                  value={remotePort}
                  onChange={(e) => setRemotePort(e.target.value)}
                  placeholder="22"
                  className={FIELD}
                />
              </div>
            </div>

            <div>
              <label className={LABEL} htmlFor="remote-key">Private key (PEM)</label>
              <textarea
                id="remote-key"
                value={remotePrivateKey}
                onChange={(e) => setRemotePrivateKey(e.target.value)}
                placeholder={'-----BEGIN OPENSSH PRIVATE KEY-----\n...\n-----END OPENSSH PRIVATE KEY-----'}
                rows={5}
                className={cn(FIELD, 'resize-y text-[0.72rem]')}
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <div>
              <label className={LABEL} htmlFor="remote-path">
                Remote path <span className="opacity-60">(optional — default: remote $HOME)</span>
              </label>
              <input
                id="remote-path"
                value={remotePath}
                onChange={(e) => setRemotePath(e.target.value)}
                placeholder="/opt/app"
                className={FIELD}
              />
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-[0.78rem] text-text-secondary">
              <input
                type="checkbox"
                checked={acceptNewHostKey}
                onChange={(e) => setAcceptNewHostKey(e.target.checked)}
                className="h-3.5 w-3.5 accent-[var(--primary)]" />
              Trust this host&apos;s key if not already known to the server (does not persist it)
            </label>

            <button
              type="button"
              onClick={() => remoteScan.mutate()}
              disabled={!remoteTarget || !remotePrivateKey || remoteIsPending}
              className={PRIMARY_BTN}
            >
              {remoteIsPending ? <Loader size={14} className="animate-spin" /> : <Server size={14} />}
              {remoteIsPending ? 'Scanning…' : 'Scan remote host'}
            </button>

            {remoteError && <Alert tone="critical">{(remoteError as Error).message}</Alert>}
          </CardBody>
        </Card>
      )}

      {error && <Alert tone="critical">{(error as Error).message}</Alert>}

      {/* Upload results */}
      {uploadResult && (
        <ProjectResults
          result={uploadResult}
          origin={
            <>
              <Field label="Source">{uploadFile?.name ?? 'Uploaded archive'}</Field>
              <Field label="Scan type">Upload / project scan</Field>
              {uploadResult.root_dir && <Field label="Scanned directory">{uploadResult.root_dir}</Field>}
              <Field label="Manifests found">{uploadResult.manifests.length}</Field>
            </>
          }
        />
      )}

      {/* Remote results */}
      {remoteResult && (
        <ProjectResults
          result={remoteResult}
          origin={
            <>
              <Field label="Remote host">{remoteTarget}</Field>
              <Field label="Remote path">{remotePath || '~ (home)'}</Field>
              <Field label="Scan type">Remote SSH scan</Field>
              {remoteResult.root_dir && <Field label="Scanned directory">{remoteResult.root_dir}</Field>}
              <Field label="Manifests found">{remoteResult.manifests.length}</Field>
            </>
          }
        />
      )}

      {/* Empty state + scan history */}
      {!result && !isPending && !error && !uploadResult && !remoteResult && (
        <div className="space-y-5">
          <Card>
            <CardBody>
              <EmptyState
                icon={Search}
                title="Nothing scanned yet in this view"
                description="Pick a registry package, upload an archive, or point at a remote host above."
                command="cwctl scan ." />
            </CardBody>
          </Card>
          <ScanHistory
            onRescan={(eco, name, ver) => { setEcosystem(eco); setPkg(name); setVersion(ver); setTab('registry'); }}
          />
        </div>
      )}

      {/* Registry results */}
      {result && (
        <div className="space-y-5">
          <Card>
            <CardHeader icon={Package} title="Scan target" />
            <CardBody className="flex flex-wrap gap-x-10 gap-y-3">
              <Field label="Package">{result.package}</Field>
              <Field label="Ecosystem">{ecosystem}</Field>
              <Field label="Scan type">Registry package</Field>
              {result.sha256 && <Field label="SHA-256">{result.sha256}</Field>}
              <div className="min-w-0">
                <span className="block font-mono text-[0.62rem] uppercase tracking-wide text-text-muted">Status</span>
                <p className="m-0 mt-1">
                  <StatusChip
                    tone={result.downloaded ? 'GREEN' : 'AMBER'}
                    label={result.downloaded ? 'Artifact downloaded' : 'Partial scan'}
                  />
                </p>
              </div>
            </CardBody>
          </Card>

          {result.engines && result.engines.length > 0 && (
            <Card>
              <CardHeader
                icon={RefreshCw}
                title="Engines"
                description={result.downloaded
                  ? 'Artifact downloaded — full scan'
                  : 'Download failed — OSV + behavioral only'}
              />
              <CardBody>
                <EngineStatusBar engines={result.engines} />
              </CardBody>
            </Card>
          )}

          <SummaryTiles summary={result.summary} />

          {(result.summary.total > 0 || (result.engines && result.engines.length > 0)) && (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {result.summary.total > 0 && (
                <Card>
                  <CardHeader title="Severity distribution" />
                  <CardBody className="flex flex-wrap items-center gap-4">
                    <ResponsiveContainer width={150} height={150}>
                      <PieChart>
                        <Pie
                          data={sevData} dataKey="value" cx="50%" cy="50%"
                          innerRadius={38} outerRadius={58} paddingAngle={2} stroke="none"
                          isAnimationActive animationDuration={200}
                        >
                          {sevData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                        </Pie>
                        <RechartsTooltip {...tooltipProps} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-1 flex-col gap-1.5">
                      {sevData.map((d) => (
                        <div key={d.name} className="flex items-center gap-2 text-[0.75rem]">
                          <span aria-hidden="true" className={cn('h-2 w-2 shrink-0 rounded-full', d.swatch)} />
                          <span className="flex-1 text-text-muted">{d.name}</span>
                          <span className="font-mono font-semibold tabular-nums text-text-primary">{d.value}</span>
                        </div>
                      ))}
                    </div>
                  </CardBody>
                </Card>
              )}

              {result.engines && result.engines.length > 0 && (() => {
                const engineData = result.engines
                  .filter((e) => e.status === 'ok')
                  .map((e) => ({ name: e.engine, findings: e.findings }))
                  .sort((a, b) => b.findings - a.findings);
                if (engineData.length === 0) return null;
                return (
                  <Card>
                    <CardHeader title="Findings by engine" />
                    <CardBody>
                      <ResponsiveContainer width="100%" height={150}>
                        <BarChart data={engineData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                          <CartesianGrid {...gridProps} horizontal={false} vertical />
                          <XAxis type="number" {...axisProps} />
                          <YAxis type="category" dataKey="name" {...axisProps} width={84} />
                          <RechartsTooltip {...barTooltipProps} />
                          <Bar dataKey="findings" fill="var(--chart-1)" radius={[0, 4, 4, 0]} barSize={16} isAnimationActive animationDuration={200} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardBody>
                  </Card>
                );
              })()}
            </div>
          )}

          {/* Highest-severity banner — mirrors what --fail-on would act on */}
          {result.summary.highest_sev && (
            <Card>
              <CardBody className="flex flex-wrap items-center gap-2 text-[0.78rem] text-text-secondary">
                <AlertCircle size={13} className="shrink-0 text-text-muted" aria-hidden="true" />
                <span>This scan&apos;s highest severity:</span>
                <StatusChip tone={result.summary.highest_sev} dot={false} />
                <span>— would fail CI with</span>
                <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-[0.72rem] text-text-primary">
                  --fail-on={result.summary.highest_sev.toLowerCase()}
                </code>
                <span>or lower.</span>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader
              icon={ShieldCheck}
              title={`Findings — ${result.package}`}
              description={result.sha256 ? `sha256:${result.sha256.slice(0, 12)}…` : undefined}
              action={
                <div className="flex items-center gap-2">
                  {result.summary.highest_sev && <StatusChip tone={result.summary.highest_sev} dot={false} />}
                  <button type="button" onClick={() => setGrouped((g) => !g)} className={GHOST_BTN}>
                    {grouped ? 'Flat' : 'Grouped'}
                  </button>
                </div>
              }
            />
            <CardBody className="flex flex-wrap items-center gap-4 border-b border-border-color">
              <div className="flex items-center gap-2">
                <label className="font-mono text-[0.65rem] uppercase tracking-wide text-text-muted" htmlFor="sev-filter">
                  Severity
                </label>
                <select
                  id="sev-filter"
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)}
                  className={cn(FIELD, 'w-auto py-1 text-[0.76rem]')}
                >
                  <option value="all">All severities</option>
                  <option value="critical">Critical+</option>
                  <option value="high">High+</option>
                  <option value="medium">Medium+</option>
                </select>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-[0.76rem] text-text-secondary">
                <input
                  type="checkbox"
                  checked={onlyFixable}
                  onChange={(e) => setOnlyFixable(e.target.checked)}
                  className="h-3.5 w-3.5 accent-[var(--primary)]" />
                Only show fixable findings
              </label>
              {(severityFilter !== 'all' || onlyFixable) && (
                <span className="text-[0.72rem] tabular-nums text-text-muted">
                  Showing {filteredFindings.length} of {result.findings.length} findings
                </span>
              )}
            </CardBody>

            {filteredFindings.length === 0 ? (
              <CardBody>
                <EmptyState
                  icon={ShieldCheck}
                  title={result.findings.length === 0 ? 'No findings — package looks clean' : 'No findings match the current filters'}
                  description={result.findings.length === 0
                    ? 'Every engine ran and nothing matched.'
                    : 'Widen the severity filter or turn off “only fixable”.'}
                />
              </CardBody>
            ) : groupedFindings ? (
              <div>
                {Array.from(groupedFindings.entries()).map(([key, group]) => (
                  <div key={key} className="border-b border-border-color/60 last:border-b-0">
                    <div className="bg-bg-base px-4 py-1.5 font-mono text-[0.72rem] font-bold text-text-muted">
                      {key} <span className="text-text-primary">({group.length})</span>
                    </div>
                    <FindingsTable findings={group} />
                  </div>
                ))}
              </div>
            ) : (
              <FindingsTable findings={filteredFindings} />
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

import { useMemo, useState } from 'react';
import {
  ArrowLeft, FileJson, FileSpreadsheet, FileText,
  Shield, Clock, Target, Layers, GitBranch,
  ChevronRight, ChevronDown, Eye,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  Tooltip as RechartsTooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Treemap,
} from 'recharts';
import { useSessionStore, type ScanSession } from '../store/sessions';
import { useUIStore } from '../store/ui';
import { StatusChip } from '../components/ui/status-chip';
import { FindingsTable } from '../components/FindingsTable';
import { Card, CardHeader, CardBody, CardFooter } from '../components/ui/card';
import { StatTile, type StatTileAccent } from '../components/ui/stat-tile';
import { EmptyState } from '../components/EmptyState';
import { cn } from '../components/ui/utils';
import { CyberKicker } from '../components/cyber/CyberViz';
import type { Finding } from '../types/api';
import {
  axisProps, barTooltipProps, gridProps, seriesProps, tooltipProps, CHART_CATEGORICAL,
} from '../lib/chartTheme';

const SEV_ORDER: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, INFORMATIONAL: 0 };

const SEVERITY_TILES: Array<{
  key: 'critical' | 'high' | 'medium' | 'low'; label: string;
  fill: string; swatch: string; accent: StatTileAccent;
}> = [
  { key: 'critical', label: 'Critical', fill: 'var(--critical)', swatch: 'bg-critical', accent: 'critical' },
  { key: 'high',     label: 'High',     fill: 'var(--amber)',    swatch: 'bg-amber',    accent: 'amber' },
  { key: 'medium',   label: 'Medium',   fill: 'var(--warning)',  swatch: 'bg-warning',  accent: 'warning' },
  { key: 'low',      label: 'Low',      fill: 'var(--teal)',     swatch: 'bg-teal',     accent: 'teal' },
];

const SEV_COLORS: Record<string, string> = {
  CRITICAL: 'var(--critical)', HIGH: 'var(--amber)', MEDIUM: 'var(--warning)', LOW: 'var(--teal)',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── mindmap ────────────────────────────────────────────────────────────────

function FindingsMindmap({ findings }: { findings: Finding[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const tree = useMemo(() => {
    const byType: Record<string, Record<string, Finding[]>> = {};
    for (const f of findings) {
      const type = f.type || 'Unknown';
      const sev = f.severity;
      if (!byType[type]) byType[type] = {};
      if (!byType[type][sev]) byType[type][sev] = [];
      byType[type][sev].push(f);
    }
    return Object.entries(byType)
      .map(([type, sevs]) => ({
        type,
        total: Object.values(sevs).reduce((s, v) => s + v.length, 0),
        severities: Object.entries(sevs)
          .sort(([a], [b]) => (SEV_ORDER[b] ?? 0) - (SEV_ORDER[a] ?? 0))
          .map(([sev, items]) => ({ sev, items })),
      }))
      .sort((a, b) => b.total - a.total);
  }, [findings]);

  const toggle = (type: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  };

  if (tree.length === 0) {
    return (
      <Card className="cyber-lift">
        <CardHeader icon={GitBranch} title="Findings mindmap" />
        <CardBody>
          <EmptyState
            icon={GitBranch}
            title="Nothing to map"
            description="This session recorded no findings, so there is no category tree to draw." />
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="cyber-lift">
      <CardHeader icon={GitBranch} title="Findings mindmap" description="Grouped by category, then severity" />
      <CardBody className="pl-6">
        <div className="relative">
          <div aria-hidden="true" className="absolute bottom-0 left-[7px] top-0 w-px bg-border-color" />
          {tree.map((node) => {
            const isOpen = expanded.has(node.type);
            return (
              <div key={node.type} className="mb-1.5">
                <button
                  type="button"
                  onClick={() => toggle(node.type)}
                  className="wd-hover flex w-full items-center gap-1.5 rounded bg-transparent px-2 py-1 text-left hover:bg-surface-muted hover:text-neon" >
                  <span aria-hidden="true" className="relative -ml-[calc(1rem+1px)] h-px w-4 bg-border-color" />
                  {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  <span className="text-[0.75rem] font-medium text-text-primary">{node.type}</span>
                  <span className="ml-auto font-mono text-[0.65rem] tabular-nums text-text-muted">{node.total}</span>
                </button>
                {isOpen && (
                  <div className="relative pl-8">
                    <div aria-hidden="true" className="absolute bottom-0 left-[calc(1.5rem+7px)] top-0 w-px bg-[color-mix(in_srgb,var(--border-color)_50%,transparent)]" />
                    {node.severities.map(({ sev, items }) => (
                      <div key={sev} className="relative flex items-start gap-2 py-1">
                        <span aria-hidden="true" className="absolute left-[calc(-0.5rem+7px)] top-[0.65rem] h-px w-3 bg-[color-mix(in_srgb,var(--border-color)_50%,transparent)]" />
                        <StatusChip tone={sev} dot={false} />
                        <div className="flex flex-wrap gap-1">
                          {items.slice(0, 5).map((f, i) => (
                            <span
                              key={i}
                              className="max-w-[200px] truncate rounded bg-surface-muted px-1.5 py-0.5 text-[0.65rem] text-text-secondary" >
                              {f.title || f.id}
                            </span>
                          ))}
                          {items.length > 5 && (
                            <span className="text-[0.65rem] text-text-muted">+{items.length - 5} more</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}

// ── treemap ────────────────────────────────────────────────────────────────

function CategoryTreemap({ findings }: { findings: Finding[] }) {
  const data = useMemo(() => {
    const bySource: Record<string, number> = {};
    for (const f of findings) {
      const src = f.source || 'unknown';
      bySource[src] = (bySource[src] || 0) + 1;
    }
    return Object.entries(bySource).map(([name, size]) => ({ name, size }));
  }, [findings]);

  return (
    <Card className="cyber-lift">
      <CardHeader icon={Layers} title="Source distribution" description="Findings per detection engine" />
      <CardBody>
        {data.length === 0 ? (
          <EmptyState icon={Layers} title="No engine attribution" description="Nothing was attributed to a detection engine in this session." />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <Treemap
              data={data}
              dataKey="size"
              nameKey="name"
              stroke="var(--border-color)"
              isAnimationActive
              animationDuration={200}
              content={(({ x, y, width, height, name, index }: {
                x: number; y: number; width: number; height: number; name: string; index: number;
              }) => {
                const w = Number(width) || 0;
                const h = Number(height) || 0;
                if (w < 30 || h < 20) return <g />;
                return (
                  <g>
                    <rect
                      x={x} y={y} width={w} height={h}
                      fill={CHART_CATEGORICAL[(index as number) % CHART_CATEGORICAL.length]}
                      rx={4}
                      opacity={0.85}
                    />
                    {w > 50 && h > 30 && (
                      <text
                        x={Number(x) + w / 2} y={Number(y) + h / 2}
                        textAnchor="middle" dominantBaseline="central"
                        fill="#fff" fontSize={10} fontFamily="monospace"
                      >
                        {String(name)}
                      </text>
                    )}
                  </g>
                );
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
              }) as any}
            />
          </ResponsiveContainer>
        )}
      </CardBody>
    </Card>
  );
}

// ── severity trend ─────────────────────────────────────────────────────────

function SeverityTrendChart({ sessions, currentId }: { sessions: ScanSession[]; currentId: string }) {
  const data = useMemo(() => sessions
    .slice()
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((s) => ({
      date: new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      critical: s.summary.critical,
      high: s.summary.high,
      medium: s.summary.medium,
      low: s.summary.low,
      total: s.summary.total,
      isCurrent: s.id === currentId,
    })), [sessions, currentId]);

  if (data.length < 2) return null;

  return (
    <Card className="cyber-lift">
      <CardHeader icon={Target} title="Blast trend" description="Every recorded sweep for the same target" />
      <CardBody>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="date" {...axisProps} />
            <YAxis {...axisProps} width={36} />
            <RechartsTooltip {...tooltipProps} />
            <Line type="monotone" dataKey="critical" name="Critical" {...seriesProps(0)} />
            <Line type="monotone" dataKey="high" name="High" {...seriesProps(1)} />
            <Line type="monotone" dataKey="medium" name="Medium" {...seriesProps(2)} />
            <Line type="monotone" dataKey="low" name="Low" stroke="var(--teal)" strokeWidth={2} dot={false} animationDuration={200} />
          </LineChart>
        </ResponsiveContainer>
        <div className="mt-2 flex items-center justify-center gap-4">
          {SEVERITY_TILES.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5">
              <span aria-hidden="true" className={cn('h-2 w-2 rounded-full', s.swatch)} />
              <span className="text-[0.65rem] text-text-muted">{s.label}</span>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

// ── exports ────────────────────────────────────────────────────────────────

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportSessionJSON(session: ScanSession) {
  const blob = new Blob([JSON.stringify({
    id: session.id,
    scan_type: session.scan_type,
    label: session.label,
    ecosystem: session.ecosystem,
    package_name: session.package_name,
    version: session.version,
    summary: session.summary,
    findings: session.findings,
    result: session.result,
    project_result: session.project_result,
    created_at: session.created_at,
  }, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `scan-${session.id}.json`);
}

function csvCell(s: string): string {
  return `"${s.replace(/"/g, '""')}"`;
}

function exportSessionCSV(session: ScanSession) {
  const header = 'ID,Severity,Type,Title,Source,Fixed Version,Description\n';
  const rows = session.findings.map((f) =>
    [csvCell(f.id), csvCell(f.severity), csvCell(f.type || ''), csvCell(f.title || ''),
      csvCell(f.source || ''), csvCell(f.fixed_version || ''), csvCell((f.description || '').slice(0, 200))].join(','),
  ).join('\n');
  downloadBlob(new Blob([header + rows], { type: 'text/csv' }), `scan-${session.id}.csv`);
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function exportSessionHTML(session: ScanSession) {
  const sevCounts = SEVERITY_TILES.map((s) => ({ label: s.label, count: session.summary[s.key], color: s.fill }));
  const findingsRows = session.findings
    .slice()
    .sort((a, b) => (SEV_ORDER[b.severity] ?? 0) - (SEV_ORDER[a.severity] ?? 0))
    .map((f) => `<tr>
      <td><span style="color:${SEV_COLORS[f.severity] || '#6B7280'};font-weight:600">${esc(f.severity)}</span></td>
      <td><code>${esc(f.id)}</code></td>
      <td>${esc(f.title || '')}</td>
      <td>${esc(f.source || '')}</td>
      <td>${esc(f.fixed_version || '—')}</td>
    </tr>`).join('\n');

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>ChainWarden Scan Report — ${esc(session.label)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;background:#F4F5F9;color:#15161D;padding:2rem}
h1{font-size:1.4rem;margin-bottom:0.5rem}
.meta{color:#575C72;font-size:0.8rem;margin-bottom:1.5rem}
.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:0.75rem;margin-bottom:2rem}
.card{background:#FFFFFF;border:1px solid #DDDFEA;border-radius:4px;padding:1rem;box-shadow:0 1px 2px rgba(16,18,27,0.04)}
.card-label{font-size:0.65rem;text-transform:uppercase;color:#8A90A8;letter-spacing:0.05em}
.card-value{font-size:1.5rem;font-weight:600;font-variant-numeric:tabular-nums;margin-top:0.25rem}
table{width:100%;border-collapse:collapse;font-size:0.8rem;background:#FFFFFF}
th{text-align:left;padding:0.5rem 0.75rem;border-bottom:1px solid #DDDFEA;color:#8A90A8;font-size:0.7rem;text-transform:uppercase;letter-spacing:0.04em}
td{padding:0.5rem 0.75rem;border-bottom:1px solid #EDEFF6}
code{background:#EDEFF6;padding:0.15rem 0.4rem;border-radius:4px;font-size:0.72rem}
.footer{margin-top:2rem;text-align:center;font-size:0.7rem;color:#8A90A8}
</style></head><body>
<h1>ChainWarden Scan Report</h1>
<p class="meta">${esc(session.label)} &middot; ${esc(session.ecosystem || '')} &middot; ${formatDate(session.created_at)}</p>
<div class="cards">
${sevCounts.map((s) => `<div class="card"><div class="card-label">${s.label}</div><div class="card-value" style="color:${s.color}">${s.count}</div></div>`).join('\n')}
</div>
<table>
<thead><tr><th>Severity</th><th>ID</th><th>Title</th><th>Source</th><th>Fix</th></tr></thead>
<tbody>${findingsRows}</tbody>
</table>
<div class="footer">Generated by ChainWarden &middot; ${new Date().toISOString()}</div>
</body></html>`;

  downloadBlob(new Blob([html], { type: 'text/html' }), `scan-report-${session.id}.html`);
}

// ── page ───────────────────────────────────────────────────────────────────

const TABS = ['overview', 'findings', 'mindmap'] as const;
type Tab = (typeof TABS)[number];

const EXPORT_BTN =
  'wd-hover flex items-center gap-1.5 rounded border border-border-color bg-surface px-2.5 py-1.5 font-mono text-[0.7rem] font-bold uppercase tracking-wider text-text-secondary hover:border-neon hover:text-neon';

export default function SessionDetailPage({ sessionId }: { sessionId: string }) {
  const navigate = useUIStore((s) => s.navigate);
  const session = useSessionStore((s) => s.get(sessionId));
  const allSessions = useSessionStore((s) => s.sessions);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const relatedSessions = useMemo(() => {
    if (!session?.package_name) return [];
    return allSessions.filter((s) => s.package_name === session.package_name && s.ecosystem === session.ecosystem);
  }, [allSessions, session]);

  const findings = session?.findings ?? [];
  const summary = session?.summary ?? { critical: 0, high: 0, medium: 0, low: 0, informational: 0, total: 0, highest_sev: 'LOW' };

  const engineData = useMemo(() => {
    const byEngine: Record<string, number> = {};
    for (const f of findings) {
      const engine = f.source || 'unknown';
      byEngine[engine] = (byEngine[engine] || 0) + 1;
    }
    return Object.entries(byEngine).map(([engine, count]) => ({ engine, count })).sort((a, b) => b.count - a.count);
  }, [findings]);

  const categoryData = useMemo(() => {
    const byType: Record<string, number> = {};
    for (const f of findings) {
      const type = f.type || 'Unknown';
      byType[type] = (byType[type] || 0) + 1;
    }
    return Object.entries(byType).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [findings]);

  if (!session) {
    return (
      <Card className="cyber-lift">
        <CardBody>
          <EmptyState
            icon={Shield}
            title="Session not found"
            description="This scan session is no longer in the local store — it may have been cleared."
            command="cwctl scan ."
            action={{ label: 'Back to sessions', onClick: () => navigate('/sessions') }}
          />
        </CardBody>
      </Card>
    );
  }

  const sevPieData = SEVERITY_TILES
    .map((s) => ({ name: s.label, value: summary[s.key], fill: s.fill, swatch: s.swatch }))
    .filter((d) => d.value > 0);

  const fixableCount = findings.filter((f) => f.fixed_version).length;
  const uniqueSources = new Set(findings.map((f) => f.source)).size;

  return (
    <div className="space-y-5">
      {/* Header */}
      <CyberKicker index="R-09" label="recon // sweep debrief" />
      <div className="flex flex-wrap items-start gap-3">
        <button
          type="button"
          onClick={() => navigate('/sessions')}
          aria-label="Back to sweep logs"
          className="wd-hover rounded border border-transparent bg-transparent p-1.5 text-text-muted hover:border-neon hover:text-neon" >
          <ArrowLeft size={16} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="m-0 truncate text-[1.15rem] font-bold tracking-tight text-text-primary">{session.label}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-[0.72rem] text-text-muted">
            <span className="flex items-center gap-1"><Clock size={11} /> {formatDate(session.created_at)}</span>
            <StatusChip
              tone={session.scan_type === 'registry' ? 'INFO' : session.scan_type === 'upload' ? 'LOW' : 'GREEN'}
              label={session.scan_type}
              dot={false}
            />
            {session.ecosystem && <span className="font-mono">{session.ecosystem}</span>}
            {session.version && <span className="font-mono">v{session.version}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => exportSessionJSON(session)} className={EXPORT_BTN} title="Export JSON">
            <FileJson size={13} /> JSON
          </button>
          <button type="button" onClick={() => exportSessionCSV(session)} className={EXPORT_BTN} title="Export CSV">
            <FileSpreadsheet size={13} /> CSV
          </button>
          <button type="button" onClick={() => exportSessionHTML(session)} className={EXPORT_BTN} title="Export HTML report">
            <FileText size={13} /> Report
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-4 lg:grid-cols-5">
        {SEVERITY_TILES.map((s) => (
          <StatTile key={s.key} label={s.label} value={summary[s.key]} accent={s.accent} className="cyber-lift" />
        ))}
        <StatTile label="Total findings" value={summary.total} className="cyber-lift" />
      </div>

      {/* Metrics strip */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <StatTile
          label="Fixable"
          value={`${fixableCount} / ${findings.length}`}
          icon={Shield}
          accent="success"
          hint="Findings with a known upgrade path" className="cyber-lift" />
        <StatTile
          label="Engines"
          value={uniqueSources}
          icon={Layers}
          accent="primary"
          hint="Distinct engines that reported" className="cyber-lift" />
        <StatTile
          label="Categories"
          value={categoryData.length}
          icon={Eye}
          accent="teal"
          hint="Distinct finding types" className="cyber-lift" />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border-color">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            aria-current={activeTab === tab ? 'page' : undefined}
            className={cn(
              'wd-hover -mb-px border-b-2 bg-transparent px-4 py-2 text-[0.78rem] font-medium capitalize',
              activeTab === tab
                ? 'border-neon text-neon drop-shadow-[0_0_8px_var(--neon)]'
                : 'border-transparent text-text-secondary hover:text-neon',
            )}
          >
            {tab === 'findings' ? `Findings (${findings.length})` : tab}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card className="cyber-lift">
            <CardHeader title="Blast distribution" description="Findings in this sweep" />
            <CardBody>
              {sevPieData.length === 0 ? (
                <EmptyState icon={Shield} title="No findings detected" description="This scan came back clean across every engine." />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={sevPieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                        dataKey="value" paddingAngle={2} stroke="none"
                        isAnimationActive animationDuration={200}
                      >
                        {sevPieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                      </Pie>
                      <RechartsTooltip {...tooltipProps} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-1 flex flex-wrap items-center justify-center gap-4">
                    {sevPieData.map((d) => (
                      <div key={d.name} className="flex items-center gap-1.5">
                        <span aria-hidden="true" className={cn('h-2.5 w-2.5 rounded-full', d.swatch)} />
                        <span className="text-[0.68rem] tabular-nums text-text-muted">{d.name}: {d.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardBody>
          </Card>

          <Card className="cyber-lift">
            <CardHeader title="Findings by engine" description="Which detector fired most" />
            <CardBody>
              {engineData.length === 0 ? (
                <EmptyState icon={Layers} title="No engine data" description="Nothing was attributed to a detection engine." />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={engineData} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                    <CartesianGrid {...gridProps} horizontal={false} vertical />
                    <XAxis type="number" {...axisProps} />
                    <YAxis type="category" dataKey="engine" {...axisProps} width={88} />
                    <RechartsTooltip {...barTooltipProps} />
                    <Bar dataKey="count" fill="var(--chart-1)" radius={[0, 4, 4, 0]} barSize={16} isAnimationActive animationDuration={200} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardBody>
          </Card>

          <Card className="cyber-lift">
            <CardHeader title="Findings by category" description="Top 10 finding types" />
            <CardBody>
              {categoryData.length === 0 ? (
                <EmptyState icon={Target} title="No categories" description="No finding types were recorded in this session." />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={categoryData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid {...gridProps} />
                    <XAxis
                      dataKey="type" {...axisProps} interval={0} angle={-30}
                      textAnchor="end" height={56}
                    />
                    <YAxis {...axisProps} width={36} />
                    <RechartsTooltip {...barTooltipProps} />
                    <Bar dataKey="count" fill="var(--chart-2)" radius={[4, 4, 0, 0]} barSize={22} isAnimationActive animationDuration={200} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardBody>
          </Card>

          <CategoryTreemap findings={findings} />

          <div className="lg:col-span-2">
            <SeverityTrendChart sessions={relatedSessions} currentId={session.id} />
          </div>
        </div>
      )}

      {activeTab === 'findings' && (
        <Card className="cyber-lift">
          <CardHeader
            title="Findings"
            description={`${findings.length} finding${findings.length === 1 ? '' : 's'} — click a row for full metadata`}
          />
          {findings.length > 0 ? (
            <FindingsTable findings={findings} />
          ) : (
            <CardBody>
              <EmptyState
                icon={Shield}
                title="No findings detected"
                description="Every engine came back clean for this target."
                command={`cwctl scan ${session.package_name || '.'}`}
              />
            </CardBody>
          )}
        </Card>
      )}

      {activeTab === 'mindmap' && (
        <div className="grid grid-cols-1 gap-5">
          <FindingsMindmap findings={findings} />

          {session.result?.engines && session.result.engines.length > 0 && (
            <Card className="cyber-lift">
              <CardHeader icon={Target} title="Engine effectiveness" description="Per-engine outcome for this sweep" />
              <CardBody className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {session.result.engines.map((eng) => (
                  <div key={eng.engine} className="rounded border border-border-color bg-bg-base p-3">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="truncate text-[0.75rem] font-medium text-text-primary">{eng.engine}</span>
                      <StatusChip tone={eng.status === 'ok' ? 'GREEN' : 'LEARNING'} label={eng.status} dot={false} />
                    </div>
                    <p className="m-0 font-mono text-[1.05rem] font-semibold tabular-nums text-text-primary">
                      {eng.findings}
                    </p>
                    <p className="m-0 text-[0.65rem] text-text-muted">findings</p>
                    {eng.error && <p className="m-0 mt-1 truncate text-[0.65rem] text-critical">{eng.error}</p>}
                  </div>
                ))}
              </CardBody>
            </Card>
          )}
        </div>
      )}

      <Card className="cyber-lift">
        <CardFooter>
          <span className="truncate font-mono">sweep {session.id}</span>
          <span className="font-mono">sealed in local storage</span>
        </CardFooter>
      </Card>
    </div>
  );
}

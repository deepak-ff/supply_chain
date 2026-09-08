import { useMemo, useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts';
import { axisProps, tooltipProps } from '../lib/chartTheme';
import {
  Network, Package, ShieldAlert, ShieldCheck,
  Target, AlertTriangle, X, Crosshair,
} from 'lucide-react';
import { getDependencyGraph, getActiveRisks } from '../lib/api';
import { NetworkGraph, type NetworkGraphNode } from '../components/NetworkGraph';
import { Card, CardHeader, CardBody } from '../components/ui/card';
import { StatTile } from '../components/ui/stat-tile';
import { EmptyState } from '../components/EmptyState';
import { ExposureBars, CyberKicker } from '../components/cyber/CyberViz';
import { cn } from '../components/ui/utils';
import { useWorkspaceStore } from '../store/workspace';

const SEV = {
  critical: { hex: '#FF4D5E', label: 'Critical', swatch: 'bg-critical' },
  high:     { hex: '#FF8A3D', label: 'High',     swatch: 'bg-warning' },
  medium:   { hex: '#FFB224', label: 'Medium',   swatch: 'bg-amber' },
  low:      { hex: '#00E5FF', label: 'Low',      swatch: 'bg-neon' },
  none:     { hex: '#5E6F93', label: 'Healthy',  swatch: 'bg-text-muted' },
} as const;

const ECO_COLORS: Record<string, string> = {
  NPM: '#00E5FF', PYPI: '#FF2BD1', GO: '#2FD4C2', DOCKER: '#FFB224',
  HUGGINGFACE: '#FF8A3D', MCP: '#FF4D5E', RUBYGEMS: '#F472B6',
  CRATES: '#7C6CFF', MAVEN: '#A3E635',
};

const ECO_TONES = ['neon', 'teal', 'amber', 'warning', 'critical'] as const;

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function AttackSurfacePage() {
  const wsName = useWorkspaceStore(s => s.getActive()).name;
  const [selected, setSelected] = useState<NetworkGraphNode | null>(null);
  const graphContainerRef = useRef<HTMLDivElement>(null);
  const [graphSize, setGraphSize] = useState({ w: 540, h: 460 });

  useEffect(() => {
    const el = graphContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      if (width > 0) setGraphSize({ w: Math.floor(width), h: Math.min(Math.max(Math.floor(width * 0.7), 300), 520) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const graph = useQuery({
    queryKey: ['dependency-graph', 'attack-surface', wsName],
    queryFn: () => getDependencyGraph(100, wsName),
    retry: false,
    staleTime: 60_000,
  });

  const risks = useQuery({
    queryKey: ['attack-surface-risks'],
    queryFn: getActiveRisks,
    refetchInterval: 60_000,
    retry: false,
  });

  const liveData = graph.data && graph.data.nodes.length > 1
    ? {
        nodes: graph.data.nodes.map(n => ({
          ...n,
          name: n.id === 'root' ? wsName : n.name,
          severity: (n.severity || 'none') as NetworkGraphNode['severity'],
        })),
        links: graph.data.links,
      }
    : { nodes: [], links: [] };

  const allRisks = risks.data?.risks ?? [];
  const isEmpty = liveData.nodes.length === 0;

  const summary = useMemo(() => {
    const assetNodes = liveData.nodes.filter(n => n.id !== 'root');
    const bySev = { critical: 0, high: 0, medium: 0, low: 0, none: 0 };
    for (const n of assetNodes) {
      const sev = (n.severity ?? 'none') as keyof typeof bySev;
      bySev[sev] = (bySev[sev] ?? 0) + 1;
    }
    return {
      total: assetNodes.length,
      critical: bySev.critical,
      high: bySev.high,
      medium: bySev.medium,
      low: bySev.low,
      healthy: bySev.none,
      exposed: bySev.critical + bySev.high + bySev.medium + bySev.low,
    };
  }, [liveData.nodes]);

  const sevDonut = useMemo(() => {
    return [
      { name: 'Critical', value: summary.critical, color: SEV.critical.hex },
      { name: 'High', value: summary.high, color: SEV.high.hex },
      { name: 'Medium', value: summary.medium, color: SEV.medium.hex },
      { name: 'Low', value: summary.low, color: SEV.low.hex },
      { name: 'Healthy', value: summary.healthy, color: SEV.none.hex },
    ].filter(s => s.value > 0);
  }, [summary]);

  const ecoBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of allRisks) {
      const key = r.ecosystem.toUpperCase();
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([eco, count]) => ({ eco, count, color: ECO_COLORS[eco] ?? '#5E6F93' }));
  }, [allRisks]);
  const ecoMax = ecoBreakdown[0]?.count ?? 1;

  const topExposed = useMemo(() => {
    return [...allRisks]
      .sort((a, b) => {
        const order: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        return (order[a.top_severity] ?? 4) - (order[b.top_severity] ?? 4) || b.finding_count - a.finding_count;
      })
      .slice(0, 8);
  }, [allRisks]);

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div>
        <CyberKicker index="O-02" label="overwatch // exposure map" />
        <h1 className="m-0 flex items-center gap-2 text-[1.15rem] font-bold tracking-tight text-text-primary">
          <Crosshair size={18} className="text-magenta" aria-hidden="true" /> Exposure Map
        </h1>
        <p className="m-0 mt-1 text-[0.78rem] text-text-secondary">
          Dependency blast radius derived from probe results — every package and its risk exposure.
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Assets" value={summary.total} icon={Package} className="cyber-lift fg-entrance" />
        <StatTile label="Critical" value={summary.critical} icon={ShieldAlert} accent="critical" className="cyber-lift fg-entrance fg-entrance-delay-1" />
        <StatTile label="High" value={summary.high} icon={AlertTriangle} accent="warning" className="cyber-lift fg-entrance fg-entrance-delay-2" />
        <StatTile label="Exposed" value={summary.exposed} icon={Target} accent="amber" className="cyber-lift fg-entrance fg-entrance-delay-3" />
        <StatTile label="Healthy" value={summary.healthy} icon={ShieldCheck} accent="success" className="cyber-lift fg-entrance fg-entrance-delay-4" />
      </div>

      {/* Graph + sidebar */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[3fr_1fr]">
        {/* Topology graph */}
        <Card className="cyber-lift relative">
          <CardHeader
            title="Blast topology"
            description="Click any node to interrogate it"
            action={
              <span className="rounded border border-[color-mix(in_srgb,var(--neon)_35%,transparent)] bg-[color-mix(in_srgb,var(--neon)_10%,transparent)] px-2 py-0.5 font-mono text-[0.62rem] font-bold text-neon">
                {summary.total} nodes
              </span>
            }
          />
          <CardBody>
            <div className="mb-2 flex flex-wrap gap-4">
              {Object.entries(SEV).map(([key, s]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <span aria-hidden="true" className={cn('h-2 w-2 shrink-0 rounded-full', s.swatch)} style={{ boxShadow: `0 0 6px ${s.hex}` }} />
                  <span className="font-mono text-[0.64rem] uppercase tracking-wider text-text-secondary">{s.label}</span>
                </div>
              ))}
            </div>
            <div ref={graphContainerRef} className="flex w-full items-center justify-center overflow-hidden rounded border border-border-color bg-bg-base">
              {graph.isLoading ? (
                <div className="w-full py-20 text-center">
                  <Network size={24} className="mx-auto mb-2 animate-pulse text-neon" />
                  <p className="m-0 font-mono text-[0.78rem] text-text-secondary">mapping the grid…</p>
                </div>
              ) : isEmpty ? (
                <div className="w-full px-4 py-10">
                  <EmptyState
                    icon={Network}
                    title="No exposure data yet"
                    description="The topology is built from probe output — run one probe to map it."
                    command="cwctl scan ."
                  />
                </div>
              ) : (
                <NetworkGraph
                  mode="data"
                  data={liveData}
                  width={graphSize.w}
                  height={graphSize.h}
                  onNodeClick={(node) => setSelected(node)}
                />
              )}
            </div>
          </CardBody>

          {/* Node detail popover */}
          {selected && (
            <div className="cw-brackets absolute right-3 top-14 z-10 w-64 max-w-[calc(100vw-3rem)] rounded border border-neon bg-surface p-4 shadow-glow">
              <div className="flex items-start justify-between">
                <div className="min-w-0 pr-2">
                  <p className="m-0 truncate font-mono text-[0.78rem] font-bold text-text-primary">
                    {selected.name}
                  </p>
                  {selected.version && (
                    <p className="m-0 mt-0.5 font-mono text-[0.65rem] text-neon">@{selected.version}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  aria-label="Close node details"
                  className="wd-hover grid h-6 w-6 shrink-0 place-items-center rounded border border-transparent bg-transparent text-text-muted hover:border-neon hover:text-neon"
                >
                  <X size={13} />
                </button>
              </div>
              <div className="mt-2">
                {selected.id === 'root' ? (
                  <span className="font-mono text-[0.68rem] text-text-secondary">// application root node</span>
                ) : (
                  <span
                    className="rounded border px-2 py-0.5 font-mono text-[0.62rem] font-bold uppercase tracking-wider"
                    style={{
                      borderColor: `color-mix(in srgb, ${SEV[(selected.severity ?? 'none') as keyof typeof SEV]?.hex ?? '#5E6F93'} 45%, transparent)`,
                      background: `color-mix(in srgb, ${SEV[(selected.severity ?? 'none') as keyof typeof SEV]?.hex ?? '#5E6F93'} 12%, transparent)`,
                      color: SEV[(selected.severity ?? 'none') as keyof typeof SEV]?.hex ?? '#5E6F93',
                    }}
                  >
                    {(selected.severity ?? 'none').toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* Sidebar — severity donut + ecosystem bars */}
        <div className="flex flex-col gap-5">
          <Card className="cyber-lift">
            <CardHeader title="Exposure split" description="Assets by state" />
            <CardBody className="flex flex-col items-center">
              <div className="relative">
                <ResponsiveContainer width={128} height={128}>
                  <PieChart>
                    <Pie
                      data={sevDonut.length > 0 ? sevDonut : [{ name: 'none', value: 1, color: 'var(--border-color)' }]}
                      innerRadius={42} outerRadius={58} dataKey="value"
                      paddingAngle={3} startAngle={90} endAngle={-270}
                      stroke="var(--surface)" strokeWidth={2}
                    >
                      {(sevDonut.length > 0 ? sevDonut : [{ color: 'var(--border-color)' }]).map((s, i) => (
                        <Cell key={i} fill={s.color} style={{ filter: `drop-shadow(0 0 6px ${s.color})` }} />
                      ))}
                    </Pie>
                    <RechartsTooltip {...tooltipProps} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                  <div className="neon-text font-mono text-[1.2rem] font-bold leading-none tabular-nums">{summary.total}</div>
                  <div className="mt-0.5 font-mono text-[0.52rem] uppercase tracking-[0.2em] text-text-muted">assets</div>
                </div>
              </div>
              <div className="mt-2 flex w-full flex-col gap-1.5">
                {sevDonut.map(s => (
                  <div key={s.name} className="flex items-center gap-2">
                    <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-[3px]" style={{ background: s.color, boxShadow: `0 0 6px ${s.color}` }} />
                    <span className="flex-1 font-mono text-[0.68rem] uppercase tracking-wider text-text-secondary">{s.name}</span>
                    <span className="font-mono text-[0.74rem] font-bold tabular-nums text-text-primary">{s.value}</span>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          <Card className="cyber-lift">
            <CardHeader title="By ecosystem" description="Hot zones per registry" />
            <CardBody>
              {ecoBreakdown.length > 0 ? (
                <ExposureBars
                  rows={ecoBreakdown.slice(0, 6).map((e, i) => ({
                    label: e.eco,
                    value: e.count,
                    max: ecoMax,
                    tone: ECO_TONES[i % ECO_TONES.length],
                  }))}
                />
              ) : (
                <p className="m-0 py-2 text-center font-mono text-[0.72rem] text-text-muted">// no signals yet</p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Most exposed packages + findings by ecosystem */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[3fr_2fr]">
        <Card className="cyber-lift">
          <CardHeader title="Most exposed packages" description="Highest blast radius first" />
          <CardBody>
            {topExposed.length === 0 ? (
              <EmptyState
                icon={ShieldCheck}
                title="No exposed packages"
                description="Nothing is currently above your severity threshold."
                command="cwctl scan . --fail-on=high"
              />
            ) : (
              <div className="flex flex-col">
                {topExposed.map((r, i) => {
                  const sevKey = r.top_severity?.toLowerCase() as keyof typeof SEV;
                  const sev = SEV[sevKey] ?? SEV.none;
                  const gradeColor = r.risk_grade === 'F' ? 'var(--critical)' : r.risk_grade === 'D' ? '#FF8A3D' :
                    r.risk_grade === 'C' ? 'var(--warning)' : 'var(--success)';
                  return (
                    <div
                      key={`${r.package_name}-${i}`}
                      className={cn('flex items-center gap-2.5 py-2', i < topExposed.length - 1 && 'border-b border-border-color')}
                    >
                      <span
                        className="w-12 shrink-0 rounded border px-1.5 py-0.5 text-center font-mono text-[0.6rem] font-bold uppercase tracking-wide"
                        style={{
                          borderColor: `color-mix(in srgb, ${sev.hex} 40%, transparent)`,
                          background: `color-mix(in srgb, ${sev.hex} 12%, transparent)`,
                          color: sev.hex,
                        }}
                      >
                        {r.top_severity === 'CRITICAL' ? 'crit' : r.top_severity?.toLowerCase().slice(0, 4)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="block truncate font-mono text-[0.72rem] text-text-primary">
                          {r.package_name}
                        </span>
                        <span className="font-mono text-[0.6rem] text-neon">@{r.version}</span>
                      </div>
                      <span className="shrink-0 rounded border border-border-color bg-surface-muted px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider text-text-muted">
                        {r.ecosystem.toLowerCase()}
                      </span>
                      <div className="flex shrink-0 items-center gap-1">
                        <span className="font-mono text-[0.6rem] uppercase tracking-wider text-text-muted">grade</span>
                        <span className="font-mono text-[0.72rem] font-bold" style={{ color: gradeColor, textShadow: `0 0 8px ${gradeColor}` }}>{r.risk_grade}</span>
                      </div>
                      <span className="w-8 shrink-0 text-right font-mono text-[0.7rem] font-bold tabular-nums text-text-secondary">
                        {r.finding_count}
                      </span>
                      <span className="w-14 shrink-0 text-right font-mono text-[0.6rem] text-text-muted">
                        {relativeTime(r.first_seen)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>

        <Card className="cyber-lift">
          <CardHeader title="Findings by ecosystem" description="Where the hits land" />
          <CardBody>
            {ecoBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={ecoBreakdown} layout="vertical" margin={{ top: 4, right: 20, left: 10, bottom: 0 }}>
                  <XAxis type="number" {...axisProps} />
                  <YAxis type="category" dataKey="eco" {...axisProps} width={72} />
                  <RechartsTooltip {...tooltipProps} />
                  <Bar dataKey="count" name="Packages" radius={[0, 4, 4, 0]} barSize={18}>
                    {ecoBreakdown.map((e, i) => (
                      <Cell key={i} fill={e.color} style={{ filter: `drop-shadow(0 0 5px ${e.color})` }} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-64 items-center justify-center">
                <p className="m-0 font-mono text-[0.78rem] text-text-muted">// no ecosystem data</p>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

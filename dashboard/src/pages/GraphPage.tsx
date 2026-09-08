import { useMemo, useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Network, X, Package, ShieldAlert, ShieldCheck, ZoomIn, Move, MousePointer } from 'lucide-react'
import { getDependencyGraph } from '../lib/api'
import { NetworkGraph, type NetworkGraphNode } from '../components/NetworkGraph'
import { StatusBadge, type StatusBadgeStatus } from '../components/StatusBadge'
import { CyberKicker } from '../components/cyber/CyberViz'

function severityToStatus(sev: string): StatusBadgeStatus {
  switch (sev) {
    case 'critical': return 'critical'
    case 'high': return 'high'
    case 'medium': return 'medium'
    case 'low': return 'low'
    default: return 'healthy'
  }
}

export function GraphPage() {
  const [selected, setSelected] = useState<NetworkGraphNode | null>(null)

  const graph = useQuery({
    queryKey: ['dependency-graph', 'full'],
    queryFn: () => getDependencyGraph(200),
    retry: false,
    staleTime: 60_000,
  })

  const liveData = graph.data && graph.data.nodes.length > 1
    ? {
        nodes: graph.data.nodes.map(n => ({ ...n, severity: (n.severity || 'none') as NetworkGraphNode['severity'] })),
        links: graph.data.links,
      }
    : { nodes: [], links: [] }

  const isEmpty = liveData.nodes.length === 0

  const summary = useMemo(() => {
    const assetNodes = liveData.nodes.filter(n => n.id !== 'root')
    const bySeverity = { critical: 0, high: 0, medium: 0, low: 0, none: 0 }
    for (const n of assetNodes) {
      const sev = (n.severity ?? 'none') as keyof typeof bySeverity
      bySeverity[sev] = (bySeverity[sev] ?? 0) + 1
    }
    return {
      total: assetNodes.length,
      critical: bySeverity.critical,
      high: bySeverity.high,
      medium: bySeverity.medium,
      low: bySeverity.low,
      healthy: bySeverity.none,
    }
  }, [liveData.nodes])

  const handleNodeClick = useCallback((node: NetworkGraphNode) => {
    setSelected(node)
  }, [])

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col overflow-hidden">
      <div className="shrink-0 px-6 pt-4">
        <CyberKicker index="X-05" label="archives // blast graph" />
      </div>
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-3 px-6 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Network size={18} className="text-neon drop-shadow-[0_0_8px_var(--neon)]" />
            <h1 className="text-[1.15rem] font-bold tracking-tight text-text-primary">Blast Graph</h1>
          </div>
          <p className="mt-0.5 text-[0.78rem] text-text-secondary">
            Your dependency tree as a live blast radius. Click any node to interrogate it.
          </p>
        </div>

        {/* Summary chips */}
        <div className="flex items-center gap-2">
          <SummaryChip icon={Package} label="Nodes" value={summary.total} color="var(--neon)" />
          {summary.critical > 0 && <SummaryChip icon={ShieldAlert} label="Critical" value={summary.critical} color="#FF4D5E" />}
          {summary.high > 0 && <SummaryChip icon={ShieldAlert} label="High" value={summary.high} color="#FF8A3D" />}
          {summary.medium > 0 && <SummaryChip icon={ShieldAlert} label="Medium" value={summary.medium} color="#FFB224" />}
          <SummaryChip icon={ShieldCheck} label="Clean" value={summary.healthy} color="var(--success)" />
        </div>
      </div>

      {/* Controls bar */}
      <div className="flex shrink-0 items-center justify-between border-y border-border-color bg-surface px-6 py-2">
        <div className="flex gap-4">
          {[
            { label: 'Critical', color: '#FF4D5E' },
            { label: 'High', color: '#FF8A3D' },
            { label: 'Medium', color: '#FFB224' },
            { label: 'Low', color: '#00E5FF' },
            { label: 'Clean', color: '#5E6F93' },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: l.color, boxShadow: `0 0 6px ${l.color}` }} />
              <span className="font-mono text-[0.7rem] text-text-secondary">{l.label}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 font-mono text-[0.65rem] text-text-muted">
          <span className="flex items-center gap-1"><MousePointer size={10} /> Click node to interrogate</span>
          <span className="flex items-center gap-1"><ZoomIn size={10} /> Scroll to zoom</span>
          <span className="flex items-center gap-1"><Move size={10} /> Drag to pan</span>
        </div>
      </div>

      {/* Graph area — fills remaining space */}
      <div className="relative min-h-0 flex-1">
        {graph.isLoading ? (
          <div className="flex h-full items-center justify-center">
            <p className="font-mono text-[0.8rem] text-text-secondary">Charting the blast radius…</p>
          </div>
        ) : isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <Network size={48} className="text-text-muted opacity-30" />
            <p className="text-[0.85rem] font-bold text-text-primary">No blast graph charted yet</p>
            <p className="font-mono text-[0.72rem] text-text-muted">Run a sweep to light up the grid</p>
            <code className="mt-2 rounded border border-border-color bg-surface px-3 py-1.5 font-mono text-[0.74rem] text-neon">cwctl scan npm/lodash@4.17.21</code>
          </div>
        ) : (
          <FullScreenGraph data={liveData} onNodeClick={handleNodeClick} />
        )}

        {/* Node detail panel */}
        {selected && (
          <div className="cyber-panel absolute right-4 top-4 z-10 w-72 rounded border border-border-color p-4 shadow-card">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1 pr-2">
                <p className="truncate font-mono text-[0.85rem] font-bold text-neon">
                  {selected.name}
                </p>
                {selected.version && (
                  <p className="mt-0.5 font-mono text-[0.72rem] text-text-muted">@{selected.version}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="wd-hover shrink-0 rounded border border-transparent bg-transparent p-1 text-text-muted hover:border-neon hover:text-neon"
                aria-label="Close" >
                <X size={14} />
              </button>
            </div>
            <div className="mt-3 border-t border-border-color pt-3">
              {selected.id === 'root' ? (
                <div className="flex flex-col gap-1">
                  <span className="text-[0.76rem] font-bold text-text-primary">Ground zero</span>
                  <span className="font-mono text-[0.68rem] text-text-muted">Every swept dependency detonates from here</span>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[0.76rem] text-text-secondary">Blast rating</span>
                    <StatusBadge status={severityToStatus(selected.severity ?? 'none')} label={(selected.severity ?? 'none').toUpperCase()} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[0.76rem] text-text-secondary">Ecosystem</span>
                    <span className="font-mono text-[0.76rem] text-text-primary">
                      {selected.id.split('/')[0] || 'unknown'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SummaryChip({ icon: Icon, label, value, color }: { icon: typeof Package; label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded border border-border-color bg-surface px-2.5 py-1">
      <Icon size={12} style={{ color }} />
      <span className="font-mono text-[0.66rem] uppercase tracking-wider text-text-secondary">{label}</span>
      <span className="font-mono text-[0.78rem] font-bold tabular-nums" style={{ color }}>{value}</span>
    </div>
  )
}

function FullScreenGraph({ data, onNodeClick }: { data: { nodes: NetworkGraphNode[]; links: { source: string; target: string }[] }; onNodeClick: (node: NetworkGraphNode) => void }) {
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })

  const containerRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setDimensions({
          width: Math.floor(entry.contentRect.width),
          height: Math.floor(entry.contentRect.height),
        })
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={containerRef} className="h-full w-full">
      <NetworkGraph
        mode="data"
        data={data}
        width={dimensions.width}
        height={dimensions.height}
        onNodeClick={onNodeClick}
      />
    </div>
  )
}

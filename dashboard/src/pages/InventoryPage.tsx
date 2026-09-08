import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Package, Search, Boxes, ChevronLeft, ChevronRight } from 'lucide-react'
import { listPackages, getDashboardStats } from '../lib/api'
import { Skeleton } from '../components/ui/skeleton'
import { Card, CardHeader, CardBody } from '../components/ui/card'
import { StatTile } from '../components/ui/stat-tile'
import { EmptyState } from '../components/EmptyState'
import { CyberKicker } from '../components/cyber/CyberViz'
import { cn } from '../components/ui/utils'

const ECOSYSTEMS = ['npm', 'pypi', 'go', 'rubygems', 'crates', 'maven', 'huggingface', 'mcp']

export default function InventoryPage() {
  const [search, setSearch] = useState('')
  const [eco, setEco] = useState('')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 50

  const stats = useQuery({ queryKey: ['dashboard-stats'], queryFn: () => getDashboardStats(), retry: false })
  const packages = useQuery({
    queryKey: ['packages', eco, page],
    queryFn: () => listPackages({ page, page_size: PAGE_SIZE, ecosystem: eco || undefined }),
    retry: false,
  })

  const filtered = (packages.data?.packages ?? []).filter(p =>
    !search || p.name?.toLowerCase().includes(search.toLowerCase())
  )

  const total = packages.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="flex flex-col gap-5">
      <div>
        <CyberKicker index="A-02" label="arsenal // supply vault" />
        <div className="flex items-center gap-2.5">
          <Boxes size={20} className="text-neon drop-shadow-[0_0_8px_var(--neon)]" aria-hidden="true" />
          <div>
            <h1 className="m-0 text-[1.15rem] font-bold tracking-tight text-text-primary">Supply Vault</h1>
            <p className="m-0 mt-0.5 text-[0.78rem] text-text-secondary">
              Every package and dependency ever swept from your projects — sealed in one vault.
            </p>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Packages sealed" value={stats.data?.total_packages ?? '—'} icon={Package} accent="success" loading={stats.isLoading} className="cyber-lift" />
        <StatTile label="Versions" value={stats.data?.total_versions ?? '—'} icon={Package} loading={stats.isLoading} className="cyber-lift" />
        <StatTile label="Findings" value={stats.data?.total_findings ?? '—'} icon={Package} accent="warning" loading={stats.isLoading} className="cyber-lift" />
        <StatTile label="Ecosystems" value={stats.data?.ecosystems_covered?.length ?? '—'} icon={Package} accent="teal" loading={stats.isLoading} className="cyber-lift" />
      </div>

      {/* Ecosystem breakdown */}
      <Card className="cyber-lift">
        <CardHeader title="Ecosystem cordon" description="Tap an ecosystem to isolate its stock" />
        <CardBody className="flex flex-wrap gap-2">
          {(stats.data?.ecosystems_covered ?? ECOSYSTEMS).map(e => (
            <button
              key={e}
              type="button"
              onClick={() => setEco(prev => prev === e ? '' : e)}
              aria-pressed={eco === e}
              className={cn(
                'wd-hover rounded border px-2.5 py-1 font-mono text-[0.72rem] font-bold',
                eco === e
                  ? 'border-neon bg-[color-mix(in_srgb,var(--neon)_12%,transparent)] text-neon shadow-glow'
                  : 'border-border-color bg-bg-base text-text-secondary hover:border-neon hover:text-neon',
              )}
            >
              {e}
            </button>
          ))}
        </CardBody>
      </Card>

      {/* Package table */}
      <Card className="cyber-lift overflow-hidden">
        <CardHeader
          icon={Package}
          title={`${total} sealed package${total === 1 ? '' : 's'}`}
          description={eco ? `Cordoned to ${eco}` : 'All ecosystems'}
          action={
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Search the vault…"
                aria-label="Search packages"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-[190px] rounded border border-border-color bg-bg-base py-1.5 pl-7 pr-2 text-xs text-text-primary"
              />
            </div>
          }
        />

        {packages.isLoading ? (
          <CardBody className="flex flex-col gap-2">
            {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
          </CardBody>
        ) : filtered.length === 0 ? (
          <CardBody>
            <EmptyState
              icon={Boxes}
              title="Vault is empty"
              description="Sweep a project and its stock will be sealed in here."
              command="cwctl scan ."
            />
          </CardBody>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-[0.8rem]" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr className="border-b border-border-color bg-bg-base">
                    {['Package', 'Ecosystem', 'Versions'].map(h => (
                      <th key={h} className="px-3.5 py-2.5 text-left font-mono text-[0.64rem] font-bold uppercase tracking-[0.14em] text-text-muted">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(pkg => (
                    <tr key={`${pkg.ecosystem}/${pkg.name}`} className="border-b border-border-color last:border-b-0">
                      <td className="px-3.5 py-2.5 font-mono text-[0.8rem] font-bold text-neon">{pkg.name}</td>
                      <td className="px-3.5 py-2.5">
                        <span className="rounded border border-border-color bg-bg-base px-1.5 py-0.5 font-mono text-[0.68rem] text-text-secondary">
                          {pkg.ecosystem}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-[0.76rem] tabular-nums text-text-secondary">
                        {pkg.versions?.length ?? 1} version{(pkg.versions?.length ?? 1) !== 1 ? 's' : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-end gap-2 border-t border-border-color bg-surface px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="wd-hover flex items-center gap-1 rounded border border-border-color bg-transparent px-2.5 py-1 font-mono text-[0.7rem] font-bold uppercase tracking-wider text-text-secondary hover:border-neon hover:text-neon disabled:cursor-default disabled:opacity-40 disabled:hover:border-border-color disabled:hover:text-text-secondary"
                >
                  <ChevronLeft size={12} /> Prev
                </button>
                <span className="font-mono text-[0.7rem] tabular-nums text-text-muted">{page} / {totalPages}</span>
                <button
                  type="button"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="wd-hover flex items-center gap-1 rounded border border-border-color bg-transparent px-2.5 py-1 font-mono text-[0.7rem] font-bold uppercase tracking-wider text-text-secondary hover:border-neon hover:text-neon disabled:cursor-default disabled:opacity-40 disabled:hover:border-border-color disabled:hover:text-text-secondary"
                >
                  Next <ChevronRight size={12} />
                </button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  )
}

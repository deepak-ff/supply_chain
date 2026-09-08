import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { cn } from './utils'
import { Skeleton } from './skeleton'
import { EmptyState } from '../EmptyState'

/**
 * DataTable — the one table primitive.
 *
 * Sticky header, 12px uppercase column labels, hairline row separators,
 * hover row tint, right-aligned tabular numerics, click-to-sort columns and
 * built-in loading / empty states (the empty state carries the exact CLI
 * command that fills the table).
 */

export interface DataTableColumn<T> {
  key: string
  header: string
  /** Cells render right-aligned with tabular-nums. */
  numeric?: boolean
  sortable?: boolean
  /** Value used for sorting. Defaults to `sortValue ?? render` output. */
  sortValue?: (row: T) => string | number
  render: (row: T) => React.ReactNode
  /** Tailwind width class, e.g. 'w-[120px]'. */
  className?: string
  headerClassName?: string
}

export interface DataTableSort {
  key: string
  dir: 'asc' | 'desc'
}

export interface DataTableProps<T> {
  columns: Array<DataTableColumn<T>>
  rows: T[]
  rowKey: (row: T) => string
  /** Query in flight — renders `rows` worth of skeleton lines (or 5). */
  loading?: boolean
  skeletonRows?: number
  /** Shown when there are no rows. */
  empty?: {
    icon?: React.ElementType
    title: string
    description?: string
    /** The exact CLI command that fixes it. */
    command?: string
    action?: { label: string; onClick: () => void }
  }
  onRowClick?: (row: T) => void
  rowClassName?: (row: T) => string | undefined
  initialSort?: DataTableSort
  /** Scroll viewport height, e.g. 'max-h-[420px]'. Header stays pinned. */
  maxHeightClass?: string
  dense?: boolean
  className?: string
}

function SortIndicator({ state }: { state: 'asc' | 'desc' | null }) {
  if (state === 'asc') return <ArrowUp size={11} className="shrink-0" aria-hidden="true" />
  if (state === 'desc') return <ArrowDown size={11} className="shrink-0" aria-hidden="true" />
  return <ChevronsUpDown size={11} className="shrink-0 opacity-40" aria-hidden="true" />
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  skeletonRows = 5,
  empty,
  onRowClick,
  rowClassName,
  initialSort,
  maxHeightClass,
  dense = false,
  className,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<DataTableSort | null>(initialSort ?? null)

  const sorted = useMemo(() => {
    if (!sort) return rows
    const col = columns.find((c) => c.key === sort.key)
    if (!col) return rows
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const av = col.sortValue ? col.sortValue(a) : String(col.render(a) ?? '')
      const bv = col.sortValue ? col.sortValue(b) : String(col.render(b) ?? '')
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av).localeCompare(String(bv), undefined, { numeric: true }) * dir
    })
  }, [rows, sort, columns])

  const toggleSort = (key: string) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' }
      if (prev.dir === 'asc') return { key, dir: 'desc' }
      return null
    })
  }

  const cellPad = dense ? 'px-3 py-1.5' : 'px-3 py-2.5'

  if (loading) {
    return (
      <div className={cn('w-full', className)}>
        <div className="border-b border-border-color px-3 py-2.5">
          <Skeleton className="h-3 w-40" />
        </div>
        {Array.from({ length: skeletonRows }).map((_, i) => (
          <div key={i} className="flex items-center gap-6 border-b border-[color-mix(in_srgb,var(--border-color)_60%,transparent)] px-3 py-3">
            <Skeleton className="h-3.5 w-1/4" />
            <Skeleton className="h-3.5 w-1/6" />
            <Skeleton className="h-3.5 w-1/6" />
            <Skeleton className="h-3.5 flex-1" />
          </div>
        ))}
      </div>
    )
  }

  if (rows.length === 0) {
    if (empty) {
      return (
        <EmptyState
          icon={empty.icon}
          title={empty.title}
          description={empty.description}
          command={empty.command}
          action={empty.action}
          className={cn('py-12', className)}
        />
      )
    }
    return (
      <p className={cn('px-3 py-10 text-center text-[0.78rem] text-text-muted', className)}>
        Nothing to show.
      </p>
    )
  }

  return (
    <div className={cn('dt-scroll w-full overflow-auto', maxHeightClass, className)}>
      <table className="w-full border-collapse text-[0.78rem]">
        <thead className="sticky top-0 z-10">
          <tr className="bg-surface">
            {columns.map((col) => {
              const active = sort?.key === col.key ? sort.dir : null
              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={active ? (active === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className={cn(
                    'border-b border-border-color bg-surface px-3 py-2 text-[12px] font-semibold uppercase tracking-[0.04em] text-text-muted',
                    col.numeric ? 'text-right' : 'text-left',
                    col.sortable && 'cursor-pointer select-none',
                    col.headerClassName,
                  )}
                  onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleSort(col.key)
                      }}
                      className={cn(
                        'wd-hover -mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 font-semibold uppercase tracking-[0.04em] text-text-muted',
                        'hover:bg-surface-muted hover:text-text-secondary',
                        active && 'text-text-primary',
                      )}
                    >
                      {col.header}
                      <SortIndicator state={active} />
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                'wd-hover border-b border-[color-mix(in_srgb,var(--border-color)_60%,transparent)] last:border-b-0',
                'hover:bg-[var(--row-hover)]',
                onRowClick && 'cursor-pointer',
                rowClassName?.(row),
              )}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(
                    cellPad,
                    'align-middle text-text-primary',
                    col.numeric && 'text-right tabular-nums',
                    col.className,
                  )}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

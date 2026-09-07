import { cn } from '../../lib/utils'

/**
 * Skeleton — the only loading affordance. Text strings like "Loading…" are
 * not used anywhere in the migrated pages; they render this instead.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded bg-skeleton', className)} />
}

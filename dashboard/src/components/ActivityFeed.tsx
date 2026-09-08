import { useQuery } from '@tanstack/react-query'
import { getDashboardActivity } from '../lib/api'
import type { ActivityEvent } from '../types/api'
import { Skeleton } from './ui/skeleton'
import { cn } from './ui/utils'

function severityTone(severity: string): string {
  switch (severity) {
    case 'CRITICAL': return 'bg-critical shadow-[0_0_8px_var(--critical)]'
    case 'HIGH':     return 'bg-warning shadow-[0_0_8px_var(--warning)]'
    case 'MEDIUM':   return 'bg-amber shadow-[0_0_8px_var(--amber)]'
    case 'LOW':      return 'bg-neon shadow-[0_0_8px_var(--neon)]'
    default:         return 'bg-text-muted'
  }
}

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)  return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

interface Props {
  limit?: number
  className?: string
}

export function ActivityFeed({ limit = 20, className }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-activity', limit],
    queryFn: () => getDashboardActivity(limit),
    refetchInterval: 15_000,
    retry: false,
  })

  const events: ActivityEvent[] = data?.events ?? []

  return (
    <div
      className={cn('flex max-h-[320px] flex-col gap-1 overflow-y-auto rounded border border-border-color bg-bg-base p-3', className)}
    >
      <p className="m-0 mb-1 flex items-center gap-2 font-mono text-[0.6rem] font-bold uppercase tracking-[0.2em] text-neon">
        <span aria-hidden="true" className="sonar h-1.5 w-1.5 rounded-full bg-neon text-neon" />
        live wire
      </p>

      {isLoading && (
        <div className="flex flex-col gap-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
        </div>
      )}

      {!isLoading && events.length === 0 && (
        <p className="m-0 py-4 text-center font-mono text-[0.7rem] text-text-muted">
          {'// wire is quiet — run a probe to see signals here.'}
        </p>
      )}

      {events.map((event) => (
        <div
          key={event.id}
          className="flex items-start gap-2 border-b border-[color-mix(in_srgb,var(--border-color)_50%,transparent)] py-1.5 last:border-0"
        >
          <span
            aria-hidden="true"
            className={cn('mt-1 h-[7px] w-[7px] shrink-0 rounded-full', severityTone(event.severity))}
          />
          <p className="m-0 min-w-0 flex-1 break-words text-[0.72rem] leading-snug text-text-primary">
            {event.message}
          </p>
          <span className="shrink-0 font-mono text-[0.62rem] text-text-muted">
            {relativeTime(event.occurred_at)}
          </span>
        </div>
      ))}
    </div>
  )
}

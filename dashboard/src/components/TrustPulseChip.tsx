import { useQuery } from '@tanstack/react-query'
import { Radar } from 'lucide-react'
import { listTrust } from '../lib/api'
import { cn } from './ui/utils'

const STATE_RANK: Record<string, number> = { LEARNING: 0, GREEN: 1, AMBER: 2, RED: 3 }

/** Worst trust state across the ledger, plus the matching token classes. */
function worstState(states: string[]): string {
  let worst = 'LEARNING'
  for (const s of states) {
    if ((STATE_RANK[s] ?? 0) > (STATE_RANK[worst] ?? 0)) worst = s
  }
  return worst
}

const CHIP_TONE: Record<string, { dot: string; text: string; ring: string }> = {
  RED: {
    dot: 'bg-critical',
    text: 'text-critical',
    ring: 'border-[color-mix(in_srgb,var(--critical)_28%,transparent)]',
  },
  AMBER: {
    dot: 'bg-warning',
    text: 'text-warning',
    ring: 'border-[color-mix(in_srgb,var(--warning)_28%,transparent)]',
  },
  GREEN: {
    dot: 'bg-success',
    text: 'text-success',
    ring: 'border-[color-mix(in_srgb,var(--success)_28%,transparent)]',
  },
  LEARNING: {
    dot: 'bg-text-muted',
    text: 'text-text-muted',
    ring: 'border-border-color',
  },
}

/**
 * Trust Pulse — live behavioural-trust status for the whole ledger, shown in
 * the top bar. Average trust score across the tracked ledger, coloured by the
 * WORST package state. Clicking it jumps to the Trust page.
 */
export function TrustPulseChip({
  onNavigate,
  className,
}: {
  onNavigate: (path: string) => void
  className?: string
}) {
  const trust = useQuery({
    queryKey: ['trust-pulse'],
    queryFn: listTrust,
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 1,
  })

  const pkgs = trust.data?.packages ?? []
  const worst = worstState(pkgs.map((p) => p.state))
  const tone = CHIP_TONE[worst] ?? CHIP_TONE.LEARNING
  const average = trust.data?.average_score ?? null

  const label = trust.isError
    ? 'Trust — API unreachable'
    : pkgs.length === 0
      ? 'Trust — no data yet'
      : `Trust ${average ?? '—'} · ${worst.toLowerCase()}`

  return (
    <button
      type="button"
      onClick={() => onNavigate('/trust')}
      title="Trust Pulse — click to open the Trust Pulse page"
      className={cn(
        'wd-hover flex h-7 shrink-0 items-center gap-1.5 rounded border bg-[color-mix(in_srgb,var(--surface-muted)_60%,transparent)] px-2',
        'text-[0.7rem] font-medium hover:bg-surface-muted',
        tone.text,
        tone.ring,
        className,
      )}
    >
      <Radar size={12} aria-hidden="true" />
      <span aria-hidden="true" className={cn('h-1.5 w-1.5 shrink-0 rounded-full', tone.dot)} />
      <span className="hidden truncate sm:inline">{label}</span>
    </button>
  )
}

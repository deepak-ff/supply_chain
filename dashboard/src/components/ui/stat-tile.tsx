import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import { cn } from './utils'
import { Skeleton } from './skeleton'

/**
 * StatTile — the single KPI primitive.
 *
 * label · value (28px / 600 / tabular-nums) · optional delta chip · optional
 * icon · optional 3px accent rail. Replaces the ad-hoc KPI tiles that used to
 * be copy-pasted per page.
 *
 * Accents are token names, not raw colours, so a tile is dark-mode correct by
 * construction and never needs an inline style.
 */

export type StatTileAccent =
  | 'primary'
  | 'teal'
  | 'amber'
  | 'success'
  | 'warning'
  | 'critical'
  | 'neutral'

const ACCENT: Record<StatTileAccent, { rail: string; value: string }> = {
  primary:  { rail: 'bg-primary',       value: 'text-text-primary' },
  teal:     { rail: 'bg-teal',          value: 'text-teal' },
  amber:    { rail: 'bg-amber',         value: 'text-amber' },
  success:  { rail: 'bg-success',       value: 'text-success' },
  warning:  { rail: 'bg-warning',       value: 'text-warning' },
  critical: { rail: 'bg-critical',      value: 'text-critical' },
  neutral:  { rail: 'bg-border-color',  value: 'text-text-primary' },
}

export type DeltaDirection = 'up' | 'down' | 'flat'

export interface StatTileDelta {
  /** Pre-formatted delta text, e.g. "+12" or "3.4%". */
  value: string
  direction: DeltaDirection
  /**
   * Whether "up" is good. Findings going up is bad; a trust score going up is
   * good. Defaults to false (up = bad), which is right for every severity
   * count in this app.
   */
  upIsGood?: boolean
}

const DELTA_ICON = { up: ArrowUp, down: ArrowDown, flat: Minus } as const

const DELTA_TONE = {
  good: 'text-success',
  bad: 'text-critical',
  neutral: 'text-text-muted',
} as const

function deltaTone(delta: StatTileDelta): keyof typeof DELTA_TONE {
  if (delta.direction === 'flat') return 'neutral'
  const rising = delta.direction === 'up'
  return rising === !!delta.upIsGood ? 'good' : 'bad'
}

export function DeltaChip({ delta, className }: { delta: StatTileDelta; className?: string }) {
  const Icon = DELTA_ICON[delta.direction]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-[0.68rem] font-semibold tabular-nums',
        DELTA_TONE[deltaTone(delta)],
        className,
      )}
    >
      <Icon size={11} aria-hidden="true" />
      {delta.value}
    </span>
  )
}

/** Tiny inline sparkline — pure SVG, no chart library, no animation. */
export function Sparkline({ data, className }: { data: number[]; className?: string }) {
  if (data.length < 2) return null
  const w = 72
  const h = 22
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`)
    .join(' ')
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className={cn('mt-2 block overflow-visible', className)}
    >
      <polyline
        points={`${pts} ${w},${h} 0,${h}`}
        className="fill-current opacity-[0.09]"
        stroke="none" />
      <polyline
        points={pts}
        fill="none"
        strokeWidth={1.5}
        strokeLinejoin="round"
        className="stroke-current" />
    </svg>
  )
}

export interface StatTileProps {
  label: string
  value: React.ReactNode
  icon?: React.ElementType
  accent?: StatTileAccent
  delta?: StatTileDelta
  hint?: string
  sparkline?: number[]
  /** Shows a placeholder skeleton instead of the value (query in flight). */
  loading?: boolean
  className?: string
}

export function StatTile({
  label,
  value,
  icon: Icon,
  accent = 'neutral',
  delta,
  hint,
  sparkline,
  loading = false,
  className,
}: StatTileProps) {
  const tone = ACCENT[accent] ?? ACCENT.neutral
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded border border-border-color bg-surface shadow-card',
        className,
      )}
    >
      {accent !== 'neutral' && (
        <span
          aria-hidden="true"
          className={cn('absolute bottom-2.5 left-0 top-2.5 w-[3px] rounded-r-sm', tone.rail)}
        />
      )}
      <div className={cn('px-4 py-3', accent !== 'neutral' && 'pl-[19px]')}>
        <div className="flex items-center gap-1.5">
          {Icon && <Icon size={13} className="shrink-0 text-text-muted" aria-hidden="true" />}
          <span className="truncate text-[0.7rem] font-medium text-text-secondary">{label}</span>
        </div>
        {loading ? (
          <Skeleton className="mt-2 h-7 w-16" />
        ) : (
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className={cn('text-[28px] font-semibold leading-none tabular-nums', tone.value)}>
              {value}
            </span>
            {delta && <DeltaChip delta={delta} />}
          </div>
        )}
        {hint && <p className="m-0 mt-1.5 text-[0.68rem] leading-snug text-text-muted">{hint}</p>}
        {sparkline && sparkline.length > 1 && !loading && (
          <Sparkline data={sparkline} className={tone.value} />
        )}
      </div>
    </div>
  )
}

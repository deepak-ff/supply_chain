import { cn } from './utils'

/**
 * StatusChip — one component for every state/severity label in the app.
 *
 * Two vocabularies, one visual language:
 *   trust states  : GREEN · AMBER · RED · LEARNING
 *   severities    : CRITICAL · HIGH · MEDIUM · LOW
 *
 * Tinted background via color-mix over the matching token, 11px semibold,
 * uppercase, tabular spacing. Never colour-only — the label text is always
 * rendered, so severity is readable without perceiving hue.
 */

export type StatusTone =
  | 'GREEN'
  | 'AMBER'
  | 'RED'
  | 'LEARNING'
  | 'CRITICAL'
  | 'HIGH'
  | 'MEDIUM'
  | 'LOW'
  | 'INFO'

interface ToneStyle {
  fg: string
  bg: string
  dot: string
}

// NOTE: these class strings are written out in full on purpose — Tailwind's
// scanner reads the raw source, so a template-built class name would never be
// generated. Keep them literal.
const TONES: Record<StatusTone, ToneStyle> = {
  GREEN: {
    fg: 'text-success',
    dot: 'bg-success',
    bg: 'bg-[color-mix(in_srgb,var(--success)_14%,transparent)]',
  },
  AMBER: {
    fg: 'text-warning',
    dot: 'bg-warning',
    bg: 'bg-[color-mix(in_srgb,var(--warning)_14%,transparent)]',
  },
  RED: {
    fg: 'text-critical',
    dot: 'bg-critical',
    bg: 'bg-[color-mix(in_srgb,var(--critical)_14%,transparent)]',
  },
  LEARNING: {
    fg: 'text-text-muted',
    dot: 'bg-text-muted',
    bg: 'bg-[color-mix(in_srgb,var(--text-muted)_14%,transparent)]',
  },
  CRITICAL: {
    fg: 'text-critical',
    dot: 'bg-critical',
    bg: 'bg-[color-mix(in_srgb,var(--critical)_14%,transparent)]',
  },
  HIGH: {
    fg: 'text-amber',
    dot: 'bg-amber',
    bg: 'bg-[color-mix(in_srgb,var(--amber)_14%,transparent)]',
  },
  MEDIUM: {
    fg: 'text-warning',
    dot: 'bg-warning',
    bg: 'bg-[color-mix(in_srgb,var(--warning)_14%,transparent)]',
  },
  LOW: {
    fg: 'text-teal',
    dot: 'bg-teal',
    bg: 'bg-[color-mix(in_srgb,var(--teal)_14%,transparent)]',
  },
  INFO: {
    fg: 'text-text-secondary',
    dot: 'bg-text-muted',
    bg: 'bg-[color-mix(in_srgb,var(--text-muted)_14%,transparent)]',
  },
}

/** Anything we have not mapped renders as a quiet neutral chip, never blank. */
const FALLBACK: ToneStyle = TONES.INFO

/** Map an arbitrary backend string onto a tone. */
function toTone(raw: string | undefined | null): StatusTone {
  const k = (raw ?? '').toString().trim().toUpperCase()
  switch (k) {
    case 'GREEN':
    case 'SAFE':
    case 'OK':
    case 'PASS':
    case 'HEALTHY':
      return 'GREEN'
    case 'AMBER':
    case 'WARN':
    case 'WARNING':
    case 'DEGRADED':
      return 'AMBER'
    case 'RED':
    case 'FAIL':
    case 'BLOCKED':
    case 'MALICIOUS':
      return 'RED'
    case 'LEARNING':
    case 'UNKNOWN':
      return 'LEARNING'
    case 'CRITICAL':
      return 'CRITICAL'
    case 'HIGH':
      return 'HIGH'
    case 'MEDIUM':
    case 'MODERATE':
      return 'MEDIUM'
    case 'LOW':
    case 'INFORMATIONAL':
    case 'INFO':
      return 'LOW'
    default:
      return 'INFO'
  }
}

export interface StatusChipProps {
  /** Raw backend value — matched case-insensitively via `toTone`. */
  tone: string | StatusTone
  /** Override the visible text (defaults to the tone name, e.g. "GREEN"). */
  label?: string
  /** Render the leading state dot. On by default for trust states. */
  dot?: boolean
  className?: string
}

export function StatusChip({ tone: rawTone, label, dot, className }: StatusChipProps) {
  const key = toTone(typeof rawTone === 'string' ? rawTone : String(rawTone))
  const style = TONES[key] ?? FALLBACK
  const text = label ?? key
  const showDot = dot ?? (key === 'GREEN' || key === 'AMBER' || key === 'RED' || key === 'LEARNING')

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded px-1.5 py-[3px]',
        'text-[11px] font-semibold uppercase leading-none tracking-[0.02em]',
        'border border-transparent',
        style.fg,
        style.bg,
        className,
      )}
      title={text}
    >
      {showDot && (
        <span aria-hidden="true" className={cn('h-1.5 w-1.5 shrink-0 rounded-full', style.dot)} />
      )}
      {text}
    </span>
  )
}

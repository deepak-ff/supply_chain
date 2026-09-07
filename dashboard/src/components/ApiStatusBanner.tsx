import { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getHealth } from '../lib/api'

function Cmd({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded border border-[color-mix(in_srgb,var(--warning)_35%,transparent)] bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] px-1.5 py-0.5 font-mono text-[0.72rem] text-text-primary">
      {children}
    </code>
  )
}

export function ApiStatusBanner() {
  const [dismissed, setDismissed] = useState(false)

  const { isError, isLoading, failureCount } = useQuery({
    queryKey: ['api-health'],
    queryFn: getHealth,
    retry: 3,
    retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 10_000),
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  })

  const isReconnecting = isLoading && failureCount > 0

  if (isLoading || !isError || dismissed) return null

  return (
    <div
      role="alert"
      className="flex shrink-0 flex-wrap items-center gap-3 border-b border-[color-mix(in_srgb,var(--warning)_40%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] px-6 py-2.5 text-[0.78rem] text-warning" >
      <AlertTriangle size={14} className="shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <strong className="font-semibold uppercase tracking-wide">
          {isReconnecting ? '[Reconnecting…]' : '[Warn]'}
        </strong>{' '}
        ChainWarden API offline — start the backend with <Cmd>make api</Cmd> or{' '}
        <Cmd>docker compose -f docker-compose.minimal.yml up -d</Cmd>
      </span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="wd-hover shrink-0 rounded border border-transparent bg-transparent p-1 text-warning hover:bg-[color-mix(in_srgb,var(--warning)_18%,transparent)]" >
        <X size={14} />
      </button>
    </div>
  )
}

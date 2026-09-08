import { useMutation } from '@tanstack/react-query'
import { Puzzle, ShieldCheck, GitMerge, Webhook, CheckCircle2, Loader2, XCircle, Satellite } from 'lucide-react'
import { testWebhook } from '../lib/api'
import { useUIStore } from '../store/ui'
import { Card, CardBody } from '../components/ui/card'
import { CyberKicker } from '../components/cyber/CyberViz'
import { cn } from '../components/ui/utils'

type IntegrationStatus = 'available' | 'optional'

interface IntegrationCard {
  icon: React.ElementType
  name: string
  description: string
  status: IntegrationStatus
  statusLabel: string
}

// Scan engines — optional CLI tools auto-detected at scan time
// (see ScanPage.tsx's EngineStatusBar / result.engines). This page has no
// live scan result in context, so we describe them honestly as
// "optional — auto-detected" rather than fabricating a live
// installed/not-installed check with no data behind it.
const SCAN_ENGINES: IntegrationCard[] = [
  {
    icon: ShieldCheck,
    name: 'Grype',
    description: 'Vulnerability scanner for container images and filesystems — matches packages against known CVE databases.',
    status: 'optional',
    statusLabel: 'Optional — auto-detected',
  },
  {
    icon: ShieldCheck,
    name: 'Trivy',
    description: 'Comprehensive scanner covering OS packages, language dependencies, misconfigurations, and secrets.',
    status: 'optional',
    statusLabel: 'Optional — auto-detected',
  },
  {
    icon: ShieldCheck,
    name: 'Semgrep',
    description: 'Static analysis engine — pattern-based rules for finding insecure code and known vulnerable code paths.',
    status: 'optional',
    statusLabel: 'Optional — auto-detected',
  },
]

const CICD: IntegrationCard[] = [
  {
    icon: GitMerge,
    name: 'GitHub Actions',
    description: 'Run cwctl scan in CI, emit SARIF, and upload findings to the GitHub Security tab. See Pipeline Sentry for the exact workflow snippet.',
    status: 'available',
    statusLabel: 'Available',
  },
]

function IntegrationTile({ card }: { card: IntegrationCard }) {
  return (
    <Card className="cyber-lift">
      <CardBody className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <card.icon size={18} className="shrink-0 text-neon" />
            <span className="text-[0.85rem] font-bold text-text-primary">{card.name}</span>
          </div>
          <span
            className={cn(
              'shrink-0 rounded-full border px-2 py-0.5 font-mono text-[0.62rem] font-bold uppercase tracking-wider',
              card.status === 'available'
                ? 'border-[color-mix(in_srgb,var(--neon)_40%,transparent)] bg-[color-mix(in_srgb,var(--neon)_10%,transparent)] text-neon'
                : 'border-border-color bg-bg-base text-text-muted',
            )}
          >
            {card.statusLabel}
          </span>
        </div>
        <p className="m-0 text-[0.76rem] leading-relaxed text-text-secondary">{card.description}</p>
      </CardBody>
    </Card>
  )
}

function NotificationsCard() {
  const navigate = useUIStore(s => s.navigate)
  const test = useMutation({ mutationFn: testWebhook })

  return (
    <Card className="cyber-lift sm:col-span-2">
      <CardBody className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Webhook size={18} className="shrink-0 text-magenta" />
            <span className="text-[0.85rem] font-bold text-text-primary">Slack / Discord / Generic webhook</span>
          </div>
          <span className="shrink-0 rounded-full border border-border-color bg-bg-base px-2 py-0.5 font-mono text-[0.62rem] font-bold uppercase tracking-wider text-text-muted">
            Optional — armed locally
          </span>
        </div>
        <p className="m-0 text-[0.76rem] leading-relaxed text-text-secondary">
          Push red alerts to a tripwire URL you arm via <code className="font-mono text-[0.7rem] text-neon">cwctl config set notify.slack_webhook_url=&lt;url&gt;</code>
          {' '}(or the Discord / generic equivalents). This is an armed URL, not an OAuth-style link —
          there is nothing to "connect" beyond setting it.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => test.mutate()}
            disabled={test.isPending}
            className="wd-hover flex items-center gap-1.5 rounded border border-neon bg-[color-mix(in_srgb,var(--neon)_10%,transparent)] px-3 py-1.5 font-mono text-[0.7rem] font-bold uppercase tracking-widest text-neon hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-50"
          >
            {test.isPending && <Loader2 size={12} className="animate-spin" />}
            Test tripwire
          </button>
          <button
            type="button"
            onClick={() => navigate('/webhooks')}
            className="wd-hover border-none bg-transparent font-mono text-[0.72rem] font-bold text-magenta hover:underline"
          >
            Full tripwire rigging →
          </button>
        </div>
        {test.isSuccess && test.data.status === 'ok' && (
          <p className="m-0 flex items-center gap-1.5 font-mono text-[0.74rem] text-success">
            <CheckCircle2 size={12} /> {test.data.message}
          </p>
        )}
        {test.isSuccess && test.data.status === 'not_configured' && (
          <p className="m-0 flex items-center gap-1.5 font-mono text-[0.74rem] text-text-secondary">
            <Webhook size={12} /> {test.data.message}
          </p>
        )}
        {test.isSuccess && test.data.status === 'failed' && (
          <div className="flex flex-col gap-1 rounded border border-[color-mix(in_srgb,var(--critical)_30%,transparent)] bg-[color-mix(in_srgb,var(--critical)_10%,transparent)] px-3 py-2 font-mono text-[0.74rem] text-critical">
            <span className="flex items-center gap-1.5 font-bold"><XCircle size={12} /> Delivery failed:</span>
            {test.data.errors?.map((e, i) => <span key={i} className="ml-4">{e}</span>)}
          </div>
        )}
        {test.isError && (
          <p className="m-0 flex items-center gap-1.5 font-mono text-[0.74rem] text-critical">
            <XCircle size={12} /> {(test.error as Error).message}
          </p>
        )}
      </CardBody>
    </Card>
  )
}

export function IntegrationsPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <CyberKicker index="U-01" label="uplinks // mesh links" />
        <div className="flex items-center gap-2.5">
          <Satellite size={20} className="text-magenta drop-shadow-[0_0_8px_var(--magenta)]" aria-hidden="true" />
          <div>
            <h1 className="m-0 text-[1.15rem] font-bold tracking-tight text-text-primary">Mesh Links</h1>
            <p className="m-0 mt-0.5 text-[0.78rem] text-text-secondary">
              Real links only — engine auto-detection and locally-armed tripwires. No fake OAuth theatre.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="m-0 flex items-center gap-2 font-mono text-[0.72rem] font-bold uppercase tracking-[0.18em] text-text-muted">
          <Puzzle size={13} className="text-neon" /> Sensor engines
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {SCAN_ENGINES.map(c => <IntegrationTile key={c.name} card={c} />)}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="m-0 flex items-center gap-2 font-mono text-[0.72rem] font-bold uppercase tracking-[0.18em] text-text-muted">
          <GitMerge size={13} className="text-neon" /> Pipeline mesh
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {CICD.map(c => <IntegrationTile key={c.name} card={c} />)}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="m-0 flex items-center gap-2 font-mono text-[0.72rem] font-bold uppercase tracking-[0.18em] text-text-muted">
          <Webhook size={13} className="text-neon" /> Alarm mesh
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <NotificationsCard />
        </div>
      </div>
    </div>
  )
}

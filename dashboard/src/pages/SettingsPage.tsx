import { useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import {
  Info, Server, ShieldCheck, LogOut, Webhook, KeyRound,
  Users, CreditCard, ScrollText, Clock, Lock, Loader, CheckCircle, Bot,
} from 'lucide-react'
import { getAuthStatus, logout, changePassword, getAIStatus } from '../lib/api'
import { useUIStore } from '../store/ui'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { CyberKicker } from '../components/cyber/CyberViz'

function SectionCard({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="cyber-lift rounded border border-border-color bg-surface p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} className="text-neon" />
        <h2 className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.18em] text-text-muted">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function ComingSoonBadge() {
  return (
    <span className="shrink-0 rounded-full border border-border-color bg-bg-base px-2 py-0.5 font-mono text-[0.62rem] font-bold uppercase tracking-widest text-text-muted">
      Queued
    </span>
  )
}

function GeneralSection() {
  return (
    <SectionCard title="General" icon={Server}>
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">API URL</label>
        <div className="rounded-md border border-border-color bg-bg-base px-3 py-2 text-sm font-mono text-text-primary">
          {import.meta.env.VITE_API_URL ?? 'http://localhost:8080'}
        </div>
        <p className="text-xs text-text-muted mt-1.5">
          Set <code className="font-mono">VITE_API_URL</code> in <code className="font-mono">.env</code> to change the API server address.
        </p>
      </div>
    </SectionCard>
  )
}

function SecuritySection() {
  const qc = useQueryClient()
  const navigate = useUIStore(s => s.navigate)
  const auth = useQuery({ queryKey: ['auth-me'], queryFn: getAuthStatus, retry: false })

  const logoutMutation = useMutation({
    mutationFn: () => logout(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth-me'] })
      navigate('/')
    },
  })

  return (
    <SectionCard title="Security" icon={ShieldCheck}>
      {auth.isLoading ? (
        <p className="text-xs text-text-secondary">Checking auth status…</p>
      ) : auth.isError ? (
        <p className="text-xs text-critical">Could not reach the API to check auth status.</p>
      ) : (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-text-primary">
              Login {auth.data?.auth_enabled ? 'enabled' : 'disabled'}
            </p>
            <p className="text-xs text-text-secondary mt-0.5">
              {auth.data?.auth_enabled
                ? auth.data.authenticated
                  ? `Signed in as ${auth.data.email ?? 'admin'}.`
                  : 'Not currently signed in.'
                : 'CW_API_KEY / session auth is not configured on this server — the dashboard is unauthenticated.'}
            </p>
          </div>
          {auth.data?.auth_enabled && auth.data.authenticated && (
            <button
              type="button"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              className="flex items-center gap-1.5 text-xs font-medium rounded-md border border-border-color px-3 py-1.5 text-text-primary hover:bg-surface-muted shrink-0 disabled:opacity-50" >
              {logoutMutation.isPending ? <Loader size={12} className="animate-spin" /> : <LogOut size={12} />}
              {logoutMutation.isPending ? 'Logging out…' : 'Log out'}
            </button>
          )}
        </div>
      )}
    </SectionCard>
  )
}

function ChangePasswordSection() {
  const auth = useQuery({ queryKey: ['auth-me'], queryFn: getAuthStatus, retry: false })
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [success, setSuccess] = useState(false)

  const mutation = useMutation({
    mutationFn: () => changePassword(currentPw, newPw),
    onSuccess: () => {
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
      setSuccess(true)
      setTimeout(() => setSuccess(false), 4000)
    },
  })

  if (!auth.data?.auth_enabled || !auth.data?.authenticated) return null

  const mismatch = confirmPw !== '' && newPw !== confirmPw
  const tooShort = newPw !== '' && newPw.length < 8
  const canSubmit = currentPw && newPw && confirmPw && !mismatch && !tooShort && !mutation.isPending

  return (
    <SectionCard title="Change Password" icon={Lock}>
      <form
        onSubmit={e => {
          e.preventDefault()
          if (canSubmit) mutation.mutate()
        }}
        className="space-y-3 max-w-sm" >
        <div>
          <label className="block text-xs font-mono text-text-secondary mb-1">CURRENT PASSWORD</label>
          <Input
            type="password"
            value={currentPw}
            onChange={e => setCurrentPw(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password" />
        </div>
        <div>
          <label className="block text-xs font-mono text-text-secondary mb-1">NEW PASSWORD</label>
          <Input
            type="password"
            value={newPw}
            onChange={e => setNewPw(e.target.value)}
            placeholder="Min. 8 characters"
            autoComplete="new-password" />
          {tooShort && <p className="text-[0.65rem] text-critical mt-1">Must be at least 8 characters.</p>}
        </div>
        <div>
          <label className="block text-xs font-mono text-text-secondary mb-1">CONFIRM NEW PASSWORD</label>
          <Input
            type="password"
            value={confirmPw}
            onChange={e => setConfirmPw(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password" />
          {mismatch && <p className="text-[0.65rem] text-critical mt-1">Passwords do not match.</p>}
        </div>

        {mutation.isError && (
          <p className="text-xs text-critical">{(mutation.error as Error).message}</p>
        )}

        {success && (
          <div className="flex items-center gap-1.5 text-xs text-success">
            <CheckCircle size={13} /> Password changed successfully.
          </div>
        )}

        <Button
          type="submit"
          disabled={!canSubmit}
          className="bg-neon font-mono text-void hover:shadow-glow text-xs font-bold uppercase tracking-widest" >
          {mutation.isPending ? <Loader size={13} className="animate-spin" /> : null}
          {mutation.isPending ? 'Re-sealing…' : 'Re-seal password'}
        </Button>
      </form>
    </SectionCard>
  )
}

function NotificationsSection() {
  const navigate = useUIStore(s => s.navigate)
  return (
    <SectionCard title="Notifications" icon={Webhook}>
      <p className="text-sm text-text-primary">
        Configure Slack, Discord, or generic webhook alerts via <code className="font-mono text-xs">cwctl config set</code>.
      </p>
      <div className="flex gap-3 mt-2">
        <button type="button" onClick={() => navigate('/webhooks')} className="wd-hover border-none bg-transparent font-mono text-[0.72rem] font-bold text-neon hover:underline">
          Tripwire rigging →
        </button>
        <button type="button" onClick={() => navigate('/integrations')} className="wd-hover border-none bg-transparent font-mono text-[0.72rem] font-bold text-neon hover:underline">
          Mesh links →
        </button>
      </div>
    </SectionCard>
  )
}

function ApiKeysSection() {
  const navigate = useUIStore(s => s.navigate)
  const configured = (import.meta.env.VITE_API_KEY ?? '') !== ''
  return (
    <SectionCard title="API keys" icon={KeyRound}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-text-primary">Dashboard API key</p>
          <p className="text-xs text-text-secondary mt-0.5">
            ChainWarden uses a single shared static key (server-side <code className="font-mono">CW_API_KEY</code>,
            client-side <code className="font-mono">VITE_API_KEY</code>) — there is no multi-key create/list/revoke
            system yet.
          </p>
        </div>
        <span
          className="text-[0.65rem] font-medium px-2 py-0.5 rounded-full shrink-0"
          style={{
            background: configured ? 'color-mix(in srgb, var(--neon) 12%, transparent)' : 'var(--surface-muted)',
            color: configured ? 'var(--neon)' : 'var(--text-secondary)',
          }}
        >
          {configured ? 'Configured' : 'Not configured'}
        </span>
      </div>
      <div className="mt-2">
        <button type="button" onClick={() => navigate('/api-reference')} className="wd-hover border-none bg-transparent font-mono text-[0.72rem] font-bold text-neon hover:underline">
          REST API reference →
        </button>
      </div>
    </SectionCard>
  )
}

function PlaceholderSection({
  title,
  icon,
  reason,
}: {
  title: string
  icon: React.ElementType
  reason: string
}) {
  const Icon = icon
  return (
    <div className="rounded border border-dashed border-border-color bg-[color-mix(in_srgb,var(--surface-muted)_40%,transparent)] p-5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon size={14} className="text-text-muted" />
          <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">{title}</h2>
        </div>
        <ComingSoonBadge />
      </div>
      <p className="text-xs text-text-secondary">{reason}</p>
    </div>
  )
}

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  bedrock: 'AWS Bedrock',
  gemini: 'Google Gemini',
  ollama: 'Ollama (Local)',
}

function AIProviderSection() {
  const ai = useQuery({ queryKey: ['ai-status'], queryFn: getAIStatus, retry: false, staleTime: 60_000 })

  return (
    <SectionCard title="AI Provider" icon={Bot}>
      {ai.isLoading ? (
        <p className="text-xs text-text-secondary">Checking AI provider…</p>
      ) : ai.isError ? (
        <p className="text-xs text-text-secondary">
          AI status unavailable — the server may not support the <code className="font-mono">/ai/status</code> endpoint yet.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-primary font-medium">
                {ai.data?.configured
                  ? `Active: ${PROVIDER_LABELS[ai.data.provider] ?? ai.data.provider}`
                  : 'No AI provider configured'}
              </p>
              {ai.data?.configured && ai.data?.model && (
                <p className="text-xs text-text-secondary mt-0.5 font-mono">{ai.data.model}</p>
              )}
              {ai.data?.error && (
                <p className="text-xs text-critical mt-0.5">{ai.data.error}</p>
              )}
            </div>
            <span
              className="text-[0.65rem] font-medium px-2 py-0.5 rounded-full shrink-0"
              style={{
                background: ai.data?.configured ? 'color-mix(in srgb, var(--neon) 12%, transparent)' : 'var(--surface-muted)',
                color: ai.data?.configured ? 'var(--neon)' : 'var(--text-secondary)',
              }}
            >
              {ai.data?.configured ? 'Active' : 'Not configured'}
            </span>
          </div>

          <div className="rounded-md border border-border-color bg-bg-base p-3 space-y-1.5">
            <p className="text-[0.65rem] font-mono font-semibold text-text-muted uppercase tracking-wide">Supported Providers</p>
            {ai.data?.available_providers?.map(p => (
              <div key={p.id} className="flex items-center justify-between text-xs">
                <span className="text-text-primary">{p.name}</span>
                <code className="text-text-muted font-mono text-[0.65rem]">{p.env}</code>
              </div>
            ))}
          </div>

          <p className="text-xs text-text-muted">
            Set <code className="font-mono">CW_AI_PROVIDER</code> to switch providers.
            Use <code className="font-mono">CW_AI_MODEL</code> to override the default model.
            For Ollama, set <code className="font-mono">CW_AI_BASE_URL</code> (default: <code className="font-mono">http://localhost:11434</code>).
          </p>
        </div>
      )}
    </SectionCard>
  )
}

export function SettingsPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <CyberKicker index="X-07" label="archives // war-room tuning" />
        <h1 className="m-0 text-[1.15rem] font-bold tracking-tight text-text-primary">War-Room Tuning</h1>
      </div>

      <GeneralSection />
      <AIProviderSection />
      <SecuritySection />
      <ChangePasswordSection />
      <NotificationsSection />
      <ApiKeysSection />

      <PlaceholderSection
        title="Team"
        icon={Users}
        reason="No multi-user backend yet — ChainWarden currently runs as a single-tenant, single-credential deployment. Team member management is planned for a future release." />
      <PlaceholderSection
        title="Billing"
        icon={CreditCard}
        reason="No billing system exists yet. ChainWarden's core is free and open source; Pro-tier billing infrastructure is not yet built." />
      <PlaceholderSection
        title="Audit Log"
        icon={ScrollText}
        reason="No persisted audit trail exists server-side yet. Recent activity (scans, findings) is visible on the Host Inspect page, but a durable, queryable audit log is not yet implemented." />

      <div className="cyber-lift rounded border border-border-color bg-surface p-4 flex items-start gap-3">
        <Info size={14} className="text-text-muted mt-0.5" />
        <div className="space-y-0.5">
          <p className="text-xs text-text-secondary">
            ChainWarden Dashboard · Local-first AI-native Supply Chain Security
          </p>
          <p className="text-xs text-text-secondary flex items-center gap-1">
            <Clock size={11} /> Run <code className="font-mono">cwctl version</code> for CLI version info.
          </p>
        </div>
      </div>
    </div>
  )
}

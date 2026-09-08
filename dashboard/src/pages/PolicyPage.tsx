import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Shield, CheckCircle, XCircle, AlertTriangle, Scroll } from 'lucide-react'
import { getPolicyStatus, savePolicy } from '../lib/api'
import { Skeleton } from '../components/ui/skeleton'
import { Switch } from '../components/ui/switch'
import { TagInput } from '../components/TagInput'
import { Card, CardHeader, CardBody } from '../components/ui/card'
import { CyberKicker } from '../components/cyber/CyberViz'
import { cn } from '../components/ui/utils'
import type { Policy } from '../types/api'

const DEFAULT_POLICY: Policy = {
  version: 1,
  fail_on: '',
  deny_packages: [],
  allow_licenses: [],
  max_package_age_days: 0,
  block_typosquatting: false,
  block_abandoned: false,
  require_signing: false,
}

const FAIL_ON_OPTIONS = ['', 'critical', 'high', 'medium', 'low']

const FIELD = 'rounded border border-border-color bg-bg-base px-3 py-2 font-mono text-[0.8rem] text-text-primary'
const LABEL = 'mb-1 block font-mono text-[0.62rem] font-bold uppercase tracking-[0.14em] text-text-muted'

export default function PolicyPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['policy-status'],
    queryFn: getPolicyStatus,
    refetchInterval: 30_000,
    retry: false,
  })

  const [form, setForm] = useState<Policy>(DEFAULT_POLICY)
  const [savedMsg, setSavedMsg] = useState('')

  // Seed local form state from the loaded policy (or defaults if unconfigured).
  useEffect(() => {
    if (data) {
      setForm(data.configured ? data.policy : DEFAULT_POLICY)
    }
  }, [data])

  const save = useMutation({
    mutationFn: () => savePolicy(form),
    onSuccess: (saved) => {
      setForm(saved)
      setSavedMsg('Doctrine sealed.')
      qc.invalidateQueries({ queryKey: ['policy-status'] })
      setTimeout(() => setSavedMsg(''), 3000)
    },
  })

  const rules = [
    {
      label: 'fail_on severity',
      value: data?.policy.fail_on || 'not set',
      active: !!data?.policy.fail_on,
      description: 'Exit code 2 if findings meet this severity threshold',
    },
    {
      label: 'block_typosquatting',
      value: data?.policy.block_typosquatting ? 'enabled' : 'disabled',
      active: !!data?.policy.block_typosquatting,
      description: 'Fail the sweep if typosquatting is detected',
    },
    {
      label: 'deny_packages',
      value: (data?.policy.deny_packages?.length ?? 0) > 0
        ? `${data?.policy.deny_packages?.length} package(s) denied`
        : 'none',
      active: (data?.policy.deny_packages?.length ?? 0) > 0,
      description: 'Explicitly denied package names',
    },
  ]

  const bannerTone = !data?.configured || data?.violations == null
    ? 'idle' : data.violations === 0 ? 'clean' : 'violated'

  return (
    <div className="flex flex-col gap-5">
      <div>
        <CyberKicker index="D-01" label="doctrine // directives" />
        <div className="flex items-center gap-2.5">
          <Scroll size={20} className="text-neon drop-shadow-[0_0_8px_var(--neon)]" aria-hidden="true" />
          <div>
            <h1 className="m-0 text-[1.15rem] font-bold tracking-tight text-text-primary">Directives</h1>
            <p className="m-0 mt-0.5 text-[0.78rem] text-text-secondary">
              Doctrine-as-code enforcement — inscribe below, or issue <code className="font-mono text-neon">cwctl policy set</code>
            </p>
          </div>
        </div>
      </div>

      {/* Status banner — three real states: unconfigured, not-yet-evaluated
          (violations is null — no aggregation query exists yet), or a real
          count. Never show a fabricated "no violations" all-clear. */}
      {!isLoading && (
        <Card className="cyber-lift">
          <CardBody className="flex items-center gap-3">
            {bannerTone === 'clean'
              ? <CheckCircle size={18} className="shrink-0 text-success drop-shadow-[0_0_8px_var(--success)]" />
              : bannerTone === 'violated'
                ? <AlertTriangle size={18} className="shrink-0 text-warning drop-shadow-[0_0_8px_var(--warning)]" />
                : <AlertTriangle size={18} className="shrink-0 text-text-muted" />}
            <div>
              <p className={cn(
                'm-0 text-[0.85rem] font-bold',
                bannerTone === 'clean' ? 'text-success' : bannerTone === 'violated' ? 'text-warning' : 'text-text-primary',
              )}>
                {!data?.configured
                  ? 'No doctrine inscribed yet — showing defaults'
                  : data?.violations == null
                    ? 'Breach count not yet tallied'
                    : data.violations === 0 ? 'Perimeter holds — no doctrine breaches' : `${data.violations} doctrine breach(es)`}
              </p>
              <p className="m-0 mt-0.5 font-mono text-[0.7rem] text-text-muted">
                Last tribunal: {data?.last_evaluated ? new Date(data.last_evaluated).toLocaleTimeString() : '—'}
              </p>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Policy rules (read-only summary) */}
      <Card className="cyber-lift overflow-hidden">
        <CardHeader icon={Shield} title="Articles of enforcement" description="The live doctrine, as the grid reads it" />
        {isLoading ? (
          <CardBody className="flex flex-col gap-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </CardBody>
        ) : (
          <div>
            {rules.map((rule, i) => (
              <div key={rule.label} className={cn('flex items-center gap-4 px-4 py-3.5', i < rules.length - 1 && 'border-b border-border-color')}>
                {rule.active
                  ? <CheckCircle size={15} className="shrink-0 text-success" />
                  : <XCircle size={15} className="shrink-0 text-text-muted" />
                }
                <div className="min-w-0 flex-1">
                  <code className="font-mono text-[0.78rem] font-bold text-neon">{rule.label}</code>
                  <p className="m-0 mt-0.5 text-[0.74rem] text-text-secondary">{rule.description}</p>
                </div>
                <span className={cn(
                  'shrink-0 rounded border px-2 py-0.5 font-mono text-[0.7rem] font-bold',
                  rule.active
                    ? 'border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_10%,transparent)] text-success'
                    : 'border-border-color bg-bg-base text-text-muted',
                )}>
                  {rule.value}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Edit policy */}
      {!isLoading && (
        <Card className="cyber-lift">
          <CardHeader title="Inscribe doctrine" description="Rewrite the articles — they bind on save" />
          <CardBody className="flex flex-col gap-4">
            <div>
              <label className={LABEL} htmlFor="doctrine-failon">Fail-on severity</label>
              <select
                id="doctrine-failon"
                value={form.fail_on}
                onChange={e => setForm(f => ({ ...f, fail_on: e.target.value }))}
                className={`${FIELD} w-full max-w-[240px]`}
              >
                {FAIL_ON_OPTIONS.map(o => <option key={o} value={o}>{o || '(not set)'}</option>)}
              </select>
            </div>

            <div>
              <label className={LABEL} htmlFor="doctrine-age">Max package age (days, 0 = unlimited)</label>
              <input
                id="doctrine-age"
                type="number"
                min={0}
                value={form.max_package_age_days}
                onChange={e => setForm(f => ({ ...f, max_package_age_days: Number(e.target.value) || 0 }))}
                className={`${FIELD} w-full max-w-[160px]`}
              />
            </div>

            <div className="flex flex-col gap-3">
              {[
                { key: 'block_typosquatting' as const, label: 'Deny typosquats', description: 'Fail the sweep if typosquatting is detected' },
                { key: 'block_abandoned' as const, label: 'Deny abandoned stock', description: 'Fail the sweep if a dependency is abandoned/unmaintained' },
                { key: 'require_signing' as const, label: 'Demand sealed prints', description: 'Fail the sweep if artifacts lack a valid Sigstore attestation' },
              ].map(({ key, label, description }) => (
                <div key={key} className="flex items-center justify-between gap-4">
                  <div>
                    <p className="m-0 text-[0.82rem] font-bold text-text-primary">{label}</p>
                    <p className="m-0 mt-0.5 text-[0.74rem] text-text-secondary">{description}</p>
                  </div>
                  <Switch checked={form[key]} onCheckedChange={v => setForm(f => ({ ...f, [key]: v }))} />
                </div>
              ))}
            </div>

            <div>
              <label className={LABEL}>Denied packages</label>
              <TagInput
                value={form.deny_packages}
                onChange={v => setForm(f => ({ ...f, deny_packages: v }))}
                placeholder="package-name, press Enter"
                color="#FF3D3D" />
            </div>

            <div>
              <label className={LABEL}>Sanctioned licenses</label>
              <TagInput
                value={form.allow_licenses}
                onChange={v => setForm(f => ({ ...f, allow_licenses: v }))}
                placeholder="MIT, Apache-2.0, …"
                color="#00FF87" />
            </div>

            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => save.mutate()}
                disabled={save.isPending}
                className="wd-hover rounded bg-neon px-5 py-2.5 font-mono text-[0.76rem] font-bold uppercase tracking-widest text-void hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-50"
              >
                {save.isPending ? 'Sealing…' : 'Seal doctrine'}
              </button>
              {savedMsg && (
                <span className="font-mono text-[0.74rem] font-bold text-success">{savedMsg}</span>
              )}
              {save.isError && (
                <span className="font-mono text-[0.74rem] text-critical">
                  {(save.error as Error).message}
                </span>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Denied packages (from server state) */}
      {!isLoading && (data?.policy.deny_packages?.length ?? 0) > 0 && (
        <Card className="cyber-lift">
          <CardHeader title="Denied stock" description="Live from the sealed doctrine" />
          <CardBody className="flex flex-wrap gap-2">
            {data?.policy.deny_packages?.map(pkg => (
              <span key={pkg} className="rounded border border-[color-mix(in_srgb,var(--critical)_40%,transparent)] bg-[color-mix(in_srgb,var(--critical)_10%,transparent)] px-2.5 py-1 font-mono text-[0.72rem] font-bold text-critical">
                {pkg}
              </span>
            ))}
          </CardBody>
        </Card>
      )}
    </div>
  )
}

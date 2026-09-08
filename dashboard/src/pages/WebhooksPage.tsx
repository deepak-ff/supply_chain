import { useMutation } from '@tanstack/react-query';
import { Webhook, Bell, Slack, CheckCircle2, XCircle, Loader2, Zap } from 'lucide-react';
import { testWebhook } from '../lib/api';
import { Card, CardHeader, CardBody } from '../components/ui/card';
import { CyberKicker } from '../components/cyber/CyberViz';

const CHANNELS = [
  { icon: Slack,   label: 'Slack',            hint: 'cwctl config set notify.slack_webhook_url=https://hooks.slack.com/...' },
  { icon: Webhook, label: 'Generic webhook',  hint: 'cwctl config set notify.webhook_url=https://your-endpoint.com/hook' },
  { icon: Bell,    label: 'Discord',          hint: 'cwctl config set notify.discord_webhook_url=https://discord.com/api/webhooks/...' },
  { icon: Bell,    label: 'Severity threshold', hint: 'cwctl config set notify.on_severity=high' },
];

export function WebhooksPage() {
  const test = useMutation({ mutationFn: testWebhook });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <CyberKicker index="U-03" label="uplinks // tripwires" />
        <div className="flex items-center gap-2.5">
          <Zap size={20} className="text-magenta drop-shadow-[0_0_8px_var(--magenta)]" aria-hidden="true" />
          <div>
            <h1 className="m-0 text-[1.15rem] font-bold tracking-tight text-text-primary">Tripwires</h1>
            <p className="m-0 mt-0.5 text-[0.78rem] text-text-secondary">
              Rig outbound tripwires — the grid screams at you the instant something burns.
            </p>
          </div>
        </div>
      </div>

      <Card className="cyber-lift">
        <CardHeader
          icon={Bell}
          title="Armed on the server, not here"
          description="Tripwires live on the machine running the API"
        />
        <CardBody>
          <p className="m-0 text-[0.78rem] leading-relaxed text-text-secondary">
            Tripwires fire on sweep completion, critical findings and directive violations — armed on the
            machine running the command uplink via <code className="font-mono text-[0.74rem] text-neon">cwctl config set</code>{' '}
            (sealed into <code className="font-mono text-[0.74rem] text-neon">~/.chainwarden/config.yaml</code>).
            There is no dashboard form for this yet — run the orders below, then trip the test wire.
          </p>
        </CardBody>
      </Card>

      <div className="flex flex-col gap-2.5">
        {CHANNELS.map(w => (
          <Card key={w.label} className="cyber-lift">
            <CardBody className="flex items-center gap-3.5">
              <w.icon size={16} className="shrink-0 text-magenta" />
              <div className="min-w-0 flex-1">
                <p className="m-0 text-[0.8rem] font-bold text-text-primary">{w.label}</p>
                <code className="mt-0.5 block truncate font-mono text-[0.7rem] text-neon">{w.hint}</code>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card className="cyber-lift">
        <CardHeader title="Trip the test wire" description="A live fire across every armed channel" />
        <CardBody className="flex flex-col gap-3">
          <p className="m-0 text-[0.76rem] leading-relaxed text-text-secondary">
            Hits the uplink's <code className="font-mono text-neon">POST /api/v1/webhooks/test</code> — it
            reads whatever is currently sealed in <code className="font-mono text-neon">config.yaml</code> on
            that machine and attempts a real delivery.
          </p>
          <div>
            <button
              type="button"
              onClick={() => test.mutate()}
              disabled={test.isPending}
              className="wd-hover flex items-center gap-2 rounded bg-neon px-5 py-2.5 font-mono text-[0.76rem] font-bold uppercase tracking-widest text-void hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-50"
            >
              {test.isPending && <Loader2 size={13} className="animate-spin" />}
              {test.isPending ? 'Tripping…' : 'Test tripwire'}
            </button>
          </div>

          {test.isSuccess && test.data.status === 'ok' && (
            <p className="m-0 flex items-center gap-1.5 font-mono text-[0.76rem] text-success">
              <CheckCircle2 size={13} /> {test.data.message}
            </p>
          )}
          {test.isSuccess && test.data.status === 'not_configured' && (
            <p className="m-0 flex items-center gap-1.5 font-mono text-[0.76rem] text-text-secondary">
              <Webhook size={13} /> {test.data.message}
            </p>
          )}
          {test.isSuccess && test.data.status === 'failed' && (
            <div className="flex flex-col gap-1 rounded border border-[color-mix(in_srgb,var(--critical)_30%,transparent)] bg-[color-mix(in_srgb,var(--critical)_10%,transparent)] px-3 py-2.5 font-mono text-[0.76rem] text-critical">
              <span className="flex items-center gap-1.5 font-bold"><XCircle size={13} /> Delivery failed:</span>
              {test.data.errors?.map((e, i) => <span key={i} className="ml-4">{e}</span>)}
            </div>
          )}
          {test.isError && (
            <p className="m-0 flex items-center gap-1.5 font-mono text-[0.76rem] text-critical">
              <XCircle size={13} /> {(test.error as Error).message}
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

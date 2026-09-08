import { useQuery } from '@tanstack/react-query';
import { Bot, AlertTriangle, Server, ShieldAlert } from 'lucide-react';
import { listPackages } from '../lib/api';
import { Card, CardHeader, CardBody } from '../components/ui/card';
import { StatTile } from '../components/ui/stat-tile';
import { CyberKicker } from '../components/cyber/CyberViz';

export function AiSecurityPage() {
  const hf = useQuery({ queryKey: ['pkgs-hf'],  queryFn: () => listPackages({ page_size: 1, ecosystem: 'huggingface' }), staleTime: 120_000 });
  const mcp = useQuery({ queryKey: ['pkgs-mcp'], queryFn: () => listPackages({ page_size: 1, ecosystem: 'mcp' }),         staleTime: 120_000 });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <CyberKicker index="R-02" label="recon // neural shield" />
        <div className="flex items-center gap-2.5">
          <Bot size={20} className="text-magenta drop-shadow-[0_0_8px_var(--magenta)]" aria-hidden="true" />
          <div>
            <h1 className="m-0 text-[1.15rem] font-bold tracking-tight text-text-primary">Neural Shield</h1>
            <p className="m-0 mt-0.5 text-[0.78rem] text-text-secondary">
              Unsafe model weights, poisoned pickles, rogue MCP servers and agentic risk — under one shield.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <StatTile
          label="AI model dependencies"
          value={hf.data?.total ?? '—'}
          icon={Bot}
          accent="primary"
          hint="HuggingFace + ONNX models in the vault"
          loading={hf.isLoading}
          className="cyber-lift fg-entrance"
        />
        <StatTile
          label="MCP server packages"
          value={mcp.data?.total ?? '—'}
          icon={Server}
          accent="warning"
          hint="Model Context Protocol servers"
          loading={mcp.isLoading}
          className="cyber-lift fg-entrance fg-entrance-delay-1"
        />
        <StatTile
          label="Unsafe pickle files"
          value={0}
          icon={AlertTriangle}
          accent="critical"
          hint="unsafe_pickle.load() sinks detected"
          className="cyber-lift fg-entrance fg-entrance-delay-2"
        />
      </div>

      <Card className="cyber-lift">
        <CardHeader title="Strike commands" description="Probe the neural front from your terminal" />
        <CardBody className="flex flex-col gap-2">
          {['cwctl scan . --ai', 'cwctl scan huggingface/bert-base-uncased', 'cwctl scan mcp/filesystem@1.0.0'].map(c => (
            <code key={c} className="rounded border border-border-color bg-bg-base px-3 py-2 font-mono text-[0.74rem] text-neon">
              <span className="mr-2 select-none text-magenta">$</span>{c}
            </code>
          ))}
        </CardBody>
      </Card>

      <Card className="cyber-lift border-critical">
        <CardHeader
          icon={ShieldAlert}
          title="Unsafe pickle detection"
          description="Deserialization is remote code execution wearing a lab coat"
        />
        <CardBody>
          <p className="m-0 text-[0.78rem] leading-relaxed text-text-secondary">
            Pickle files loaded with <code className="rounded bg-surface-muted px-1 py-0.5 font-mono text-[0.72rem] text-warning">unsafe_pickle.load()</code> can
            execute arbitrary code during deserialization. The shield flags these patterns in model
            weights and Python scripts before they ever load.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

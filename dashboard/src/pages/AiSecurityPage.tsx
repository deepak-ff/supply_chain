import { useQuery } from '@tanstack/react-query';
import { Bot, AlertTriangle, Server } from 'lucide-react';
import { listPackages } from '../lib/api';

export function AiSecurityPage() {
  const hf = useQuery({ queryKey: ['pkgs-hf'],  queryFn: () => listPackages({ page_size: 1, ecosystem: 'huggingface' }), staleTime: 120_000 });
  const mcp = useQuery({ queryKey: ['pkgs-mcp'], queryFn: () => listPackages({ page_size: 1, ecosystem: 'mcp' }),         staleTime: 120_000 });

  const stats = [
    { label: 'AI Model Dependencies',  value: hf.data?.total  ?? '—', icon: Bot,          color: 'var(--color-indigo)',   desc: 'HuggingFace + ONNX models tracked in inventory' },
    { label: 'MCP Server Packages',    value: mcp.data?.total ?? '—', icon: Server,        color: 'var(--color-warn)',     desc: 'Model Context Protocol server packages' },
    { label: 'Unsafe Pickle Files',    value: 0,                        icon: AlertTriangle, color: 'var(--color-critical)', desc: 'Files with unsafe_pickle.load() detected' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Bot className="text-primary" size={22} />
        <div>
          <h1 className="text-xl font-bold font-mono text-text-primary">AI Security</h1>
          <p className="text-sm text-text-secondary">
            Detect unsafe AI model usage, pickle files, MCP servers, and agentic risk.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {stats.map(s => (
          <div
            key={s.label}
            className="rounded-lg p-4 bg-surface border border-border-color"

          >
            <s.icon size={16} style={{ color: s.color, marginBottom: '0.5rem' }} />
            <div style={{ fontSize: '1.75rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: s.color }}>
              {s.value}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--fg)', fontWeight: 600, marginTop: '0.25rem' }}>{s.label}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--color-muted)', marginTop: '0.2rem' }}>{s.desc}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg p-4 space-y-2 bg-surface border border-border-color">
        <p className="text-xs font-mono font-bold text-text-secondary">CLI COMMANDS</p>
        <code className="text-xs block text-success">cwctl scan . --ai</code>
        <code className="text-xs block text-success">cwctl scan huggingface/bert-base-uncased</code>
        <code className="text-xs block text-success">cwctl scan mcp/filesystem@1.0.0</code>
      </div>

      <div className="rounded-lg p-4 space-y-2" style={{ background: 'rgba(255,61,61,0.06)', border: '1px solid rgba(255,61,61,0.15)' }}>
        <p className="text-xs font-mono font-bold text-critical">UNSAFE PICKLE DETECTION</p>
        <p className="text-xs text-text-secondary">
          Pickle files loaded with <code className="text-warning">unsafe_pickle.load()</code> can execute arbitrary code during deserialization.
          ChainWarden detects these patterns in AI model weights and Python scripts.
        </p>
      </div>
    </div>
  );
}

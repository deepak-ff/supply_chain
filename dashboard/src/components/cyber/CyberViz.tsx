import { useMemo } from 'react';
import { cn } from '../ui/utils';

/* ──────────────────────────────────────────────────────────────────────────
   NEON SENTRY visual primitives — pure SVG + CSS, zero new dependencies.
   ThreatTicker · ThreatRadar · ThreatMap · PostureRing · ExposureBars
   ────────────────────────────────────────────────────────────────────────── */

// ── Threat level ───────────────────────────────────────────────────────────

export type ThreatLevel = 'LOW' | 'GUARDED' | 'ELEVATED' | 'SEVERE';

export function threatLevelFor(critical: number, high: number, total: number): ThreatLevel {
  if (critical > 0) return 'SEVERE';
  if (high > 0) return 'ELEVATED';
  if (total > 0) return 'GUARDED';
  return 'LOW';
}

export const THREAT_TONE: Record<ThreatLevel, { text: string; bar: string; glow: string }> = {
  SEVERE:   { text: 'text-critical', bar: 'bg-critical', glow: 'shadow-[0_0_18px_var(--critical)]' },
  ELEVATED: { text: 'text-warning',  bar: 'bg-warning',  glow: 'shadow-[0_0_18px_var(--warning)]' },
  GUARDED:  { text: 'text-amber',    bar: 'bg-amber',    glow: 'shadow-[0_0_18px_var(--amber)]' },
  LOW:      { text: 'text-success',  bar: 'bg-success',  glow: 'shadow-[0_0_18px_var(--success)]' },
};

// ── Threat ticker — infinite marquee of live signals ───────────────────────

export interface TickerItem {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  text: string;
}

const TICKER_DOT: Record<string, string> = {
  CRITICAL: 'bg-critical shadow-[0_0_8px_var(--critical)]',
  HIGH: 'bg-warning shadow-[0_0_8px_var(--warning)]',
  MEDIUM: 'bg-amber shadow-[0_0_8px_var(--amber)]',
  LOW: 'bg-teal shadow-[0_0_8px_var(--teal)]',
  INFO: 'bg-neon shadow-[0_0_8px_var(--neon)]',
};

export function ThreatTicker({ items }: { items: TickerItem[] }) {
  const feed = items.length > 0 ? items : [
    { id: 't0', severity: 'INFO' as const, text: 'sentry grid armed — awaiting first sweep' },
    { id: 't1', severity: 'INFO' as const, text: '8 engines online · 223 threat prints loaded' },
    { id: 't2', severity: 'LOW' as const, text: 'tip: run `cwctl scan .` to light up the grid' },
  ];
  const doubled = [...feed, ...feed];
  return (
    <div
      aria-label="Live threat signals"
      className="relative overflow-hidden rounded border border-border-color bg-surface"
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-surface to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-surface to-transparent" />
      <div className="flex items-stretch">
        <div className="z-20 flex shrink-0 items-center gap-1.5 border-r border-border-color bg-bg-base px-3 py-2 font-mono text-[0.6rem] font-bold uppercase tracking-[0.2em] text-neon">
          <span aria-hidden="true" className="sonar h-1.5 w-1.5 rounded-full bg-neon text-neon" />
          live wire
        </div>
        <div className="relative flex-1 overflow-hidden">
          <div className="cyber-ticker-track items-center gap-8 py-2 pl-6">
            {doubled.map((t, i) => (
              <span key={`${t.id}-${i}`} className="flex shrink-0 items-center gap-2 font-mono text-[0.68rem] text-text-secondary">
                <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', TICKER_DOT[t.severity] ?? TICKER_DOT.INFO)} />
                <span className="font-bold text-text-muted">[{t.severity}]</span>
                <span className="max-w-[420px] truncate">{t.text}</span>
                <span aria-hidden="true" className="pl-6 text-border-color">///</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Posture ring — glowing grade dial ──────────────────────────────────────

export function scoreToGrade(score: number): { letter: string; label: string } {
  if (score >= 95) return { letter: 'A+', label: 'Fortress' };
  if (score >= 90) return { letter: 'A', label: 'Fortress' };
  if (score >= 85) return { letter: 'B+', label: 'Shielded' };
  if (score >= 80) return { letter: 'B', label: 'Shielded' };
  if (score >= 75) return { letter: 'B-', label: 'Guarded' };
  if (score >= 70) return { letter: 'C+', label: 'Guarded' };
  if (score >= 60) return { letter: 'C', label: 'Exposed' };
  if (score >= 50) return { letter: 'D', label: 'Breached-risk' };
  return { letter: 'F', label: 'Critical' };
}

export function PostureRing({ score, size = 104 }: { score: number; size?: number }) {
  const grade = scoreToGrade(score);
  const r = 40;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const stroke = score >= 85 ? 'var(--success)' : score >= 70 ? 'var(--amber)' : score >= 50 ? 'var(--warning)' : 'var(--critical)';
  return (
    <div className="cyber-breathe relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Security grade ${grade.letter}, ${grade.label}, score ${score} of 100`}>
      <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
        <circle cx={50} cy={50} r={r} fill="none" stroke="var(--border-color)" strokeWidth={8} opacity={0.5} />
        {/* tick marks */}
        {Array.from({ length: 36 }, (_, i) => {
          const a = (i / 36) * Math.PI * 2;
          const inner = i % 9 === 0 ? 30 : 32.5;
          return (
            <line
              key={i}
              x1={50 + Math.cos(a) * inner} y1={50 + Math.sin(a) * inner}
              x2={50 + Math.cos(a) * 35} y2={50 + Math.sin(a) * 35}
              stroke="var(--text-muted)" strokeWidth={i % 9 === 0 ? 1.4 : 0.8} opacity={0.6}
            />
          );
        })}
        <circle
          cx={50} cy={50} r={r} fill="none" stroke={stroke} strokeWidth={8} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
          transform="rotate(-90 50 50)"
          style={{ filter: `drop-shadow(0 0 6px ${stroke})`, transition: 'stroke-dashoffset 600ms ease' }}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-center">
        <span>
          <span className="block font-mono text-[1.7rem] font-bold leading-none text-text-primary">{grade.letter}</span>
          <span className="mt-1 block font-mono text-[0.55rem] uppercase tracking-[0.2em] text-text-muted">{pct}/100</span>
        </span>
      </span>
    </div>
  );
}

// ── Threat radar — hexagon risk matrix ─────────────────────────────────────

export interface RadarAxis {
  key: string;
  label: string;
  value: number; // 0..100
}

const RADAR_SEGS = 4;

function radarPoint(center: number, radius: number, angle: number, frac: number): [number, number] {
  const r = radius * Math.max(0, Math.min(1, frac));
  return [center + r * Math.cos(angle - Math.PI / 2), center + r * Math.sin(angle - Math.PI / 2)];
}

export function ThreatRadar({ axes, size = 260 }: { axes: RadarAxis[]; size?: number }) {
  const center = 150;
  const radius = 104;
  const n = axes.length;
  const poly = axes
    .map((a, i) => radarPoint(center, radius, (i / n) * Math.PI * 2, a.value / 100).join(','))
    .join(' ');
  const rings = useMemo(() => Array.from({ length: RADAR_SEGS }, (_, ri) => {
    const frac = (ri + 1) / RADAR_SEGS;
    return Array.from({ length: n }, (_, i) => radarPoint(center, radius, (i / n) * Math.PI * 2, frac).join(',')).join(' ');
  }), [n]);

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }} role="img" aria-label="Threat matrix radar">
      <svg viewBox="0 0 300 300" width={size} height={size} aria-hidden="true">
        {rings.map((pts, i) => (
          <polygon key={i} points={pts} fill="none" stroke="var(--border-color)" strokeWidth={1} opacity={0.7} />
        ))}
        {axes.map((a, i) => {
          const [x, y] = radarPoint(center, radius, (i / n) * Math.PI * 2, 1);
          return <line key={a.key} x1={center} y1={center} x2={x} y2={y} stroke="var(--border-color)" strokeWidth={1} opacity={0.7} />;
        })}
        <polygon
          points={poly}
          fill="color-mix(in srgb, var(--neon) 18%, transparent)"
          stroke="var(--neon)" strokeWidth={2} strokeLinejoin="round"
          style={{ filter: 'drop-shadow(0 0 8px var(--neon))' }}
        />
        {axes.map((a, i) => {
          const [x, y] = radarPoint(center, radius, (i / n) * Math.PI * 2, a.value / 100);
          const hot = a.value >= 70;
          return (
            <g key={a.key}>
              <circle cx={x} cy={y} r={hot ? 5 : 4} fill={hot ? 'var(--critical)' : 'var(--neon)'} stroke="var(--surface)" strokeWidth={1.5} style={{ filter: hot ? 'drop-shadow(0 0 6px var(--critical))' : 'drop-shadow(0 0 6px var(--neon))' }} />
            </g>
          );
        })}
        {axes.map((a, i) => {
          const [x, y] = radarPoint(center, radius + 26, (i / n) * Math.PI * 2, 1);
          return (
            <g key={`lbl-${a.key}`}>
              <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fill="var(--text-secondary)" fontSize={10.5} fontFamily="var(--font-mono)" fontWeight={700}>
                {a.label}
              </text>
              <text x={x} y={y + 13} textAnchor="middle" dominantBaseline="middle" fill={a.value >= 70 ? 'var(--critical)' : 'var(--text-muted)'} fontSize={9} fontFamily="var(--font-mono)">
                {a.value}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Exposure bars — neon horizontal meters ────────────────────────────────

export interface ExposureRow {
  label: string;
  value: number;
  max: number;
  tone: 'critical' | 'warning' | 'amber' | 'teal' | 'neon';
}

const EXPOSURE_FILL: Record<ExposureRow['tone'], string> = {
  critical: 'var(--critical)',
  warning: 'var(--warning)',
  amber: 'var(--amber)',
  teal: 'var(--teal)',
  neon: 'var(--neon)',
};

export function ExposureBars({ rows }: { rows: ExposureRow[] }) {
  return (
    <div className="flex flex-col gap-3">
      {rows.map((r) => {
        const pct = r.max > 0 ? Math.min(100, (r.value / r.max) * 100) : 0;
        const fill = EXPOSURE_FILL[r.tone];
        return (
          <div key={r.label}>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="font-mono text-[0.68rem] font-semibold uppercase tracking-wider text-text-secondary">{r.label}</span>
              <span className="font-mono text-[0.72rem] font-bold tabular-nums text-text-primary">{r.value}<span className="font-normal text-text-muted">/{r.max}</span></span>
            </div>
            <svg viewBox="0 0 100 6" preserveAspectRatio="none" className="h-1.5 w-full" aria-hidden="true">
              <rect x={0} y={0} width={100} height={6} rx={3} fill="var(--surface-muted)" />
              <rect x={0} y={0} width={pct} height={6} rx={3} fill={fill} style={{ filter: `drop-shadow(0 0 4px ${fill})` }} />
            </svg>
          </div>
        );
      })}
    </div>
  );
}

// ── Threat map — stylized ops-grid with attack arcs ───────────────────────
// A schematic "world grid" (dotted lat/long bands + hub nodes + animated
// attack arcs). Schematic on purpose: no geo data, no heavy libs.

interface MapHub {
  id: string;
  x: number; // 0..100
  y: number; // 0..56
  hot: boolean;
  label: string;
}

const HUBS: MapHub[] = [
  { id: 'us-e', x: 22, y: 22, hot: true, label: 'US-E' },
  { id: 'us-w', x: 10, y: 28, hot: false, label: 'US-W' },
  { id: 'eu', x: 50, y: 18, hot: true, label: 'EU' },
  { id: 'ap-s', x: 72, y: 34, hot: false, label: 'AP-S' },
  { id: 'ap-ne', x: 84, y: 22, hot: true, label: 'AP-NE' },
  { id: 'sa', x: 30, y: 44, hot: false, label: 'SA' },
  { id: 'home', x: 46, y: 30, hot: false, label: 'YOU' },
];

const ARCS: Array<[string, string, boolean]> = [
  ['us-e', 'home', true],
  ['eu', 'home', true],
  ['ap-ne', 'home', true],
  ['us-w', 'home', false],
  ['ap-s', 'home', false],
  ['sa', 'home', false],
];

function arcPath(a: MapHub, b: MapHub): string {
  const mx = (a.x + b.x) / 2;
  const my = Math.min(a.y, b.y) - Math.abs(a.x - b.x) * 0.18 - 4;
  return `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`;
}

export function ThreatMap({ blocked = 0, probing = 0 }: { blocked?: number; probing?: number }) {
  const byId = useMemo(() => Object.fromEntries(HUBS.map((h) => [h.id, h])), []);
  return (
    <div className="relative overflow-hidden rounded border border-border-color bg-bg-base" role="img" aria-label={`Threat map: ${blocked} blocked, ${probing} probing`}>
      <svg viewBox="0 0 100 56" className="block h-auto w-full" aria-hidden="true">
        {/* dotted grid bands */}
        {Array.from({ length: 9 }, (_, r) =>
          Array.from({ length: 26 }, (_, c) => (
            <circle key={`${r}-${c}`} cx={2 + c * 3.7} cy={3 + r * 6} r={0.32} fill="var(--grid-line)" stroke="none" />
          )),
        )}
        {/* equator bands */}
        <line x1={0} y1={28} x2={100} y2={28} stroke="var(--border-color)" strokeWidth={0.25} opacity={0.6} />
        <line x1={0} y1={14} x2={100} y2={14} stroke="var(--border-color)" strokeWidth={0.15} opacity={0.4} />
        <line x1={0} y1={42} x2={100} y2={42} stroke="var(--border-color)" strokeWidth={0.15} opacity={0.4} />

        {/* arcs */}
        {ARCS.map(([from, to, hostile]) => {
          const a = byId[from];
          const b = byId[to];
          return (
            <g key={`${from}-${to}`}>
              <path d={arcPath(a, b)} fill="none" stroke={hostile ? 'var(--critical)' : 'var(--neon)'} strokeWidth={hostile ? 0.55 : 0.4} opacity={hostile ? 0.75 : 0.5} className={hostile ? 'cyber-flow' : undefined} />
              {hostile && (
                <circle cx={b.x} cy={b.y} r={1.6} fill="none" stroke="var(--critical)" strokeWidth={0.4} opacity={0.8}>
                  <animate attributeName="r" values="0.8;2.6" dur="1.6s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.9;0" dur="1.6s" repeatCount="indefinite" />
                </circle>
              )}
            </g>
          );
        })}

        {/* hubs */}
        {HUBS.map((h) => (
          <g key={h.id}>
            {h.hot && <circle cx={h.x} cy={h.y} r={2.2} fill="var(--critical)" opacity={0.18} />}
            <circle
              cx={h.x} cy={h.y} r={h.id === 'home' ? 1.5 : 1.1}
              fill={h.id === 'home' ? 'var(--neon)' : h.hot ? 'var(--critical)' : 'var(--surface-muted)'}
              stroke={h.id === 'home' ? 'var(--neon)' : h.hot ? 'var(--critical)' : 'var(--text-muted)'}
              strokeWidth={0.4}
            />
            <text x={h.x} y={h.y + 4.4} textAnchor="middle" fontSize={2.6} fontFamily="var(--font-mono)" fill={h.id === 'home' ? 'var(--neon)' : 'var(--text-muted)'} fontWeight={700}>
              {h.label}
            </text>
          </g>
        ))}
      </svg>
      {/* legend */}
      <div className="flex items-center gap-4 border-t border-border-color bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] px-3 py-2 font-mono text-[0.62rem] backdrop-blur">
        <span className="flex items-center gap-1.5 text-text-secondary">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-critical shadow-[0_0_6px_var(--critical)]" />
          hostile · {probing} probing
        </span>
        <span className="flex items-center gap-1.5 text-text-secondary">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-neon shadow-[0_0_6px_var(--neon)]" />
          trusted · {blocked} blocked
        </span>
        <span className="ml-auto uppercase tracking-[0.18em] text-text-muted">global grid</span>
      </div>
    </div>
  );
}

// ── Section number chip — "01 // POSTURE" ──────────────────────────────────

export function CyberKicker({ index, label }: { index: string; label: string }) {
  return (
    <p className="m-0 mb-3 flex items-center gap-2 font-mono text-[0.62rem] font-bold uppercase tracking-[0.24em]">
      <span className="text-magenta">{index}</span>
      <span aria-hidden="true" className="text-border-color">//</span>
      <span className="text-neon">{label}</span>
      <span aria-hidden="true" className="cyber-divider ml-1 flex-1" />
    </p>
  );
}

/**
 * Shared Recharts theming.
 *
 * Every chart in the dashboard imports from this one module instead of
 * re-declaring `tick={{ fontSize: 10 }}` / `contentStyle={{...}}` inline, so
 * the whole surface reads as one system:
 *
 *   - grid: horizontal rules only, 1px, var(--border-color) — never vertical
 *   - axes: 10px var(--text-muted), no axis line, no tick line
 *   - tooltip: surface card, hairline border, 4px radius, 12px text
 *   - series: violet / teal / amber, 2px stroke, no dots, 200ms animation
 *
 * Usage:
 *   <LineChart data={d} margin={chartMargin}>
 *     <CartesianGrid {...gridProps} />
 *     <XAxis dataKey="x" {...axisProps} />
 *     <YAxis {...axisProps} width={36} />
 *     <RechartsTooltip {...tooltipProps} />
 *     <Line dataKey="a" {...seriesProps(0)} />
 *   </LineChart>
 */
import { createElement, type CSSProperties } from 'react';

/** Ordered series palette — violet, teal, amber. */
export const CHART_SERIES = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)'] as const;

/** Categorical palette for charts with more than three series (treemaps, donuts). */
export const CHART_CATEGORICAL = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--primary)',
  'var(--teal)',
  'var(--success)',
  'var(--critical)',
  'var(--text-muted)',
] as const;

/** Pick a series colour by index, wrapping around the palette. */
export function seriesColor(i: number): string {
  return CHART_SERIES[((i % CHART_SERIES.length) + CHART_SERIES.length) % CHART_SERIES.length];
}

/** 200ms for every entry animation — long enough to read, short enough to ignore. */
export const CHART_ANIMATION_MS = 200;

/** Horizontal gridlines only, 1px, hairline border colour. */
export const gridProps = {
  horizontal: true,
  vertical: false,
  stroke: 'var(--border-color)',
  strokeWidth: 1,
  strokeDasharray: undefined as string | undefined,
} as const;

/** 10px muted ticks, no axis line and no tick line. */
export const axisTick = { fontSize: 10, fill: 'var(--text-muted)' } as const;

export const axisProps = {
  tick: axisTick,
  tickLine: false,
  axisLine: false,
  tickMargin: 8,
} as const;

/** Default chart margins — keeps the Y axis labels inside the card padding. */
export const chartMargin = { top: 8, right: 8, left: -16, bottom: 0 } as const;

/** Props shared by every series primitive (Line / Area / Bar). */
export const seriesBase = {
  strokeWidth: 2,
  dot: false,
  activeDot: { r: 3, strokeWidth: 0 },
  isAnimationActive: true,
  animationDuration: CHART_ANIMATION_MS,
} as const;

/** Full prop bundle for the i-th series of a chart. */
export function seriesProps(i: number) {
  return {
    ...seriesBase,
    stroke: seriesColor(i),
    fill: seriesColor(i),
  };
}

export const legendProps = {
  wrapperStyle: { fontSize: 11, color: 'var(--text-secondary)', paddingTop: 8 },
  iconType: 'plainline' as const,
  iconSize: 10,
};

/* ── Tooltip ─────────────────────────────────────────────────────────── */

const tooltipCard: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border-color)',
  borderRadius: 4,
  boxShadow: 'var(--shadow-card)',
  padding: '8px 10px',
  fontSize: 12,
  lineHeight: 1.5,
  color: 'var(--text-primary)',
};

const tooltipLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-secondary)',
  margin: 0,
  marginBottom: 4,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const tooltipItem: CSSProperties = {
  fontSize: 12,
  color: 'var(--text-primary)',
  padding: 0,
  margin: 0,
  fontVariantNumeric: 'tabular-nums',
};

interface TooltipEntry {
  name?: string | number;
  value?: string | number | Array<string | number>;
  color?: string;
  dataKey?: string | number;
}

interface TooltipPayloadProps {
  active?: boolean;
  label?: string | number;
  payload?: TooltipEntry[];
}

/**
 * Surface-card tooltip. Passed to Recharts as `content={<ChartTooltip />}`.
 */
export function ChartTooltip({ active, payload, label }: TooltipPayloadProps) {
  if (!active || !payload || payload.length === 0) return null;
  return createElement(
    'div',
    { style: tooltipCard },
    label === undefined || label === null || label === ''
      ? null
      : createElement('p', { style: tooltipLabel }, String(label)),
    payload.map((entry, i) =>
      createElement(
        'div',
        {
          key: `${String(entry.dataKey ?? entry.name ?? i)}`,
          style: { display: 'flex', alignItems: 'center', gap: 6 },
        },
        createElement('span', {
          style: {
            width: 8,
            height: 8,
            borderRadius: 2,
            flex: '0 0 auto',
            background: entry.color ?? seriesColor(i),
          },
        }),
        createElement(
          'span',
          { style: { ...tooltipItem, color: 'var(--text-secondary)' } },
          String(entry.name ?? entry.dataKey ?? ''),
        ),
        createElement(
          'span',
          { style: { ...tooltipItem, marginLeft: 'auto', fontWeight: 600 } },
          Array.isArray(entry.value) ? entry.value.join(' – ') : String(entry.value ?? ''),
        ),
      ),
    ),
  );
}

/** Drop-in props for `<Tooltip {...tooltipProps} />`. */
export const tooltipProps = {
  content: createElement(ChartTooltip),
  cursor: { stroke: 'var(--border-color)', strokeWidth: 1 },
} as const;

/** Drop-in props for `<Tooltip {...tooltipProps} />` on bar charts (tinted cursor). */
export const barTooltipProps = {
  content: createElement(ChartTooltip),
  cursor: { fill: 'var(--row-hover)' },
} as const;

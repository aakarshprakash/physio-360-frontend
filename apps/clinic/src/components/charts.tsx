import type { ReactNode } from 'react';
import { useChartPalette } from '../lib/chart';

interface TooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ dataKey?: unknown; name?: unknown; value?: unknown; color?: string }>;
  label?: unknown;
  formatValue: (v: number) => ReactNode;
  formatLabel?: (l: string) => ReactNode;
}

/** Shared tooltip: surface card, text in text tokens, colour swatch carries identity. */
export function ChartTooltip({ active, payload, label, formatValue, formatLabel }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-pop">
      <p className="mb-1 font-semibold text-fg">{formatLabel ? formatLabel(String(label)) : String(label ?? '')}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2 text-fg-muted">
          <span aria-hidden className="size-2.5 rounded-sm" style={{ background: p.color }} />
          {String(p.name)}: <span className="tabular font-semibold text-fg">{formatValue(Number(p.value))}</span>
        </p>
      ))}
    </div>
  );
}

export function useAxisProps() {
  const palette = useChartPalette();
  return {
    palette,
    axis: { stroke: palette.grid, tick: { fill: palette.axis, fontSize: 11 }, tickLine: false, axisLine: false } as const,
  };
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm" style={{ background: i.color }} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

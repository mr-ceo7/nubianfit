import React, { useState } from 'react';
import { formatMoney } from '../../utils/money';

interface RevenueChartProps {
  data: { month: string; revenue: number }[];
  currency: string;
}

const W = 560;
const H = 220;
const PAD = { top: 16, right: 8, bottom: 28, left: 56 };

/** Revenue per month: a single-series bar chart with hover tooltips and a table for screen readers. */
export const RevenueChart: React.FC<RevenueChartProps> = ({ data, currency }) => {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data.map(d => d.revenue), 0);
  // Round the axis up to a tidy number so ticks read cleanly.
  const step = max <= 0 ? 1000 : Math.pow(10, Math.floor(Math.log10(max)));
  const top = max <= 0 ? 4000 : Math.ceil(max / step) * step;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => f * top);
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / data.length;
  const barW = Math.min(36, slot - 12);
  const y = (v: number) => PAD.top + innerH - (v / top) * innerH;
  const label = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString(undefined, { month: 'short' });
  const compact = (v: number) => (v >= 1_000_000 ? `${v / 1_000_000}M` : v >= 1000 ? `${v / 1000}k` : `${v}`);

  return (
    <figure className="relative max-w-3xl">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-w-3xl" role="img" aria-label={`Revenue per month, last ${data.length} months`}>
        {ticks.map(t => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--app-border-light)" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="var(--app-muted)">
              {compact(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = PAD.left + i * slot + (slot - barW) / 2;
          const h = Math.max(0, PAD.top + innerH - y(d.revenue));
          const r = Math.min(4, h);
          return (
            <g key={d.month} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              {/* Rounded top, square base anchored to the baseline. */}
              {h > 0 && (
                <path
                  d={`M${x},${y(0)} V${y(d.revenue) + r} Q${x},${y(d.revenue)} ${x + r},${y(d.revenue)} H${x + barW - r} Q${x + barW},${y(d.revenue)} ${x + barW},${y(d.revenue) + r} V${y(0)} Z`}
                  fill="var(--chart-1)"
                  opacity={hover === null || hover === i ? 1 : 0.55}
                />
              )}
              <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--app-muted)">{label(d.month)}</text>
              {/* Hit target larger than the bar. */}
              <rect x={PAD.left + i * slot} y={PAD.top} width={slot} height={innerH} fill="transparent" />
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div
          role="tooltip"
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs shadow-lg"
          style={{ left: `${((PAD.left + hover * slot + slot / 2) / W) * 100}%`, top: `${(y(data[hover].revenue) / H) * 100}%` }}
        >
          <p className="text-slate-400">{new Date(`${data[hover].month}-01T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</p>
          <p className="font-bold text-white">{formatMoney(data[hover].revenue, currency)}</p>
        </div>
      )}
      <table className="sr-only">
        <caption>Revenue per month</caption>
        <thead><tr><th>Month</th><th>Revenue</th></tr></thead>
        <tbody>{data.map(d => <tr key={d.month}><td>{d.month}</td><td>{formatMoney(d.revenue, currency)}</td></tr>)}</tbody>
      </table>
    </figure>
  );
};

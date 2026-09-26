import React from 'react';
import { Nutrients } from '../../types';
import { DayTargets } from '../../utils/nutrition';

const Bar: React.FC<{ label: string; value: number; target?: number | null; unit: string; color: string }> = ({ label, value, target, unit, color }) => {
  const pct = target ? Math.min(100, (value / target) * 100) : 0;
  const over = !!target && value > target * 1.05;
  return (
    <div>
      <p className="text-[11px] font-semibold text-slate-300">{label}</p>
      <p className={`text-sm font-bold whitespace-nowrap ${over ? 'text-amber-400' : 'text-white'}`}>
        {Math.round(value)}{unit}{target ? <span className="text-xs text-slate-400 font-normal"> / {Math.round(target)}{unit}</span> : null}
      </p>
      <div className="mt-1 h-2 rounded-full bg-slate-800 overflow-hidden" role="progressbar" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemax={target ?? undefined}>
        <div className={`h-full rounded-full ${over ? 'bg-amber-400' : color}`} style={{ width: `${target ? pct : 0}%` }} />
      </div>
    </div>
  );
};

/** Calories remaining plus protein/carbs/fat bars against the day's targets. */
export const MacroSummary: React.FC<{ totals: Nutrients; targets: DayTargets; compact?: boolean }> = ({ totals, targets, compact }) => {
  const remaining = targets.calories ? Math.round(targets.calories - totals.calories) : null;
  return (
    <div className={`rounded-2xl bg-slate-900 border border-slate-800 ${compact ? 'p-3.5' : 'p-4 md:p-5'} space-y-3`}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            {targets.isRestDay ? 'Rest day' : 'Training day'}
          </p>
          <p className="text-2xl font-extrabold text-white">
            {Math.round(totals.calories)}
            <span className="text-sm font-semibold text-slate-400">{targets.calories ? ` / ${Math.round(targets.calories)}` : ''} kcal</span>
          </p>
        </div>
        {remaining !== null && (
          <p className={`text-sm font-bold ${remaining < 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {remaining >= 0 ? `${remaining} left` : `${-remaining} over`}
          </p>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Bar label="Protein" value={totals.protein} target={targets.protein} unit="g" color="bg-emerald-500" />
        <Bar label="Carbs" value={totals.carbs} target={targets.carbs} unit="g" color="bg-cyan-500" />
        <Bar label="Fat" value={totals.fat} target={targets.fat} unit="g" color="bg-amber-500" />
      </div>
      {!targets.calories && !compact && <p className="text-xs text-slate-400">No targets set yet.</p>}
    </div>
  );
};

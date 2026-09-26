import React, { useEffect, useState } from 'react';
import { Save, UtensilsCrossed, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useNutrition } from '../../context/NutritionContext';
import { ClientGoals } from '../../types';
import { formatDay, localDateStr } from '../../utils/dates';
import { addDays, isTrainingDay, sumNutrients, targetsFor } from '../../utils/nutrition';
import { DiaryView } from './DiaryView';
import { HabitsManager } from './HabitsManager';

const field = 'w-full h-9 px-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500';

type GoalKey = Exclude<keyof ClientGoals, 'clientId' | 'notes'>;

/** Coach view of one client's nutrition: goals, meal plan, week summary, diary and habits. */
export const ClientNutritionPanel: React.FC<{ clientId: string }> = ({ clientId }) => {
  const today = localDateStr();
  const [date, setDate] = useState(today);
  useEffect(() => setDate(today), [clientId, today]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 xl:items-start">
        <div className="space-y-5 min-w-0">
          <GoalsEditor clientId={clientId} />
          <MealPlanAssignment clientId={clientId} />
          <WeekSummary clientId={clientId} today={today} onPickDay={setDate} />
        </div>
        <div className="min-w-0">
          <DiaryView clientId={clientId} date={date} today={today} onDateChange={setDate} />
        </div>
      </div>
      <HabitsManager clientId={clientId} />
    </div>
  );
};

const GoalsEditor: React.FC<{ clientId: string }> = ({ clientId }) => {
  const { goals, setGoals } = useNutrition();
  const current = goals.find(g => g.clientId === clientId);
  const toDraft = (g?: ClientGoals) => {
    const d: Record<string, string> = {};
    (['calories', 'protein', 'carbs', 'fat', 'restDayCalories', 'restDayProtein', 'restDayCarbs', 'restDayFat', 'waterMl', 'steps'] as GoalKey[])
      .forEach(k => { d[k] = g?.[k] != null ? String(g[k]) : ''; });
    d.notes = g?.notes ?? '';
    return d;
  };
  const [draft, setDraft] = useState(() => toDraft(current));
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(toDraft(current)), [clientId, current]);

  const num = (v: string) => (v.trim() === '' ? null : Number(v));
  const kcalFromMacros = (p: string, c: string, f: string) =>
    [p, c, f].every(v => v !== '') ? Math.round(Number(p) * 4 + Number(c) * 4 + Number(f) * 9) : null;
  const macroKcal = kcalFromMacros(draft.protein, draft.carbs, draft.fat);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await setGoals(clientId, {
      calories: num(draft.calories), protein: num(draft.protein), carbs: num(draft.carbs), fat: num(draft.fat),
      restDayCalories: num(draft.restDayCalories), restDayProtein: num(draft.restDayProtein),
      restDayCarbs: num(draft.restDayCarbs), restDayFat: num(draft.restDayFat),
      waterMl: num(draft.waterMl), steps: num(draft.steps), notes: draft.notes,
    });
    setSaving(false);
  };

  const input = (key: string, label: string) => (
    <label className="text-[11px] font-semibold text-slate-300">{label}
      <input
        inputMode="numeric"
        value={draft[key]}
        onChange={e => setDraft(d => ({ ...d, [key]: e.target.value.replace(/[^\d.]/g, '') }))}
        className={`${field} mt-1`}
      />
    </label>
  );

  return (
    <form onSubmit={save} className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-white">Daily targets</h3>
        <button type="submit" disabled={saving} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-bold">
          <Save className="h-3.5 w-3.5" /> {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Training days</p>
      <div className="grid grid-cols-4 gap-2">
        {input('calories', 'kcal')}{input('protein', 'Protein g')}{input('carbs', 'Carbs g')}{input('fat', 'Fat g')}
      </div>
      {macroKcal !== null && draft.calories && Math.abs(macroKcal - Number(draft.calories)) > 100 && (
        <p className="text-xs text-amber-400">These macros add up to {macroKcal} kcal, not {draft.calories}.</p>
      )}
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Rest days (blank = same as training)</p>
      <div className="grid grid-cols-4 gap-2">
        {input('restDayCalories', 'kcal')}{input('restDayProtein', 'Protein g')}{input('restDayCarbs', 'Carbs g')}{input('restDayFat', 'Fat g')}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {input('waterMl', 'Water (ml)')}{input('steps', 'Steps')}
      </div>
      <label className="block text-[11px] font-semibold text-slate-300">Notes for the client
        <textarea
          rows={2}
          value={draft.notes}
          onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
          placeholder="e.g. Prioritise protein at breakfast"
          className="mt-1 w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
        />
      </label>
    </form>
  );
};

const MealPlanAssignment: React.FC<{ clientId: string }> = ({ clientId }) => {
  const { mealPlans, assignments, assignMealPlan, unassignMealPlan } = useNutrition();
  const current = assignments.find(a => a.clientId === clientId);
  const plan = mealPlans.find(p => p.id === current?.mealPlanId);
  const [planId, setPlanId] = useState('');
  const [start, setStart] = useState(localDateStr());

  return (
    <section className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <UtensilsCrossed className="h-4 w-4 text-emerald-400" />
        <h3 className="text-sm font-bold text-white">Meal plan</h3>
      </div>
      {plan && current ? (
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{plan.title}</p>
            <p className="text-xs text-slate-400">Since {formatDay(current.startDate)} · {plan.days.length}-day rotation</p>
          </div>
          <button
            onClick={() => window.confirm(`Stop ${plan.title} for this client?`) && unassignMealPlan(clientId)}
            aria-label="Remove meal plan"
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <p className="text-xs text-slate-400">No meal plan assigned.</p>
      )}
      {mealPlans.length > 0 ? (
        <div className="grid grid-cols-[1fr_auto_auto] gap-2">
          <select aria-label="Meal plan to assign" value={planId} onChange={e => setPlanId(e.target.value)} className={field}>
            <option value="">{plan ? 'Switch to…' : 'Choose a plan…'}</option>
            {mealPlans.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
          <input type="date" aria-label="Start date" value={start} onChange={e => setStart(e.target.value)} className={field} />
          <button
            onClick={async () => { if (await assignMealPlan(planId, clientId, start)) setPlanId(''); }}
            disabled={!planId}
            className="px-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-100 text-xs font-bold"
          >
            Assign
          </button>
        </div>
      ) : (
        <p className="text-xs text-slate-400">Create meal plans in the Meal plans tab.</p>
      )}
    </section>
  );
};

const WeekSummary: React.FC<{ clientId: string; today: string; onPickDay: (d: string) => void }> = ({ clientId, today, onPickDay }) => {
  const { scheduledWorkouts } = useApp();
  const { foodLog, goals, daily } = useNutrition();
  const clientGoals = goals.find(g => g.clientId === clientId);
  const workouts = scheduledWorkouts.filter(w => w.clientId === clientId);
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, -6 + i));

  return (
    <section className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
      <h3 className="text-sm font-bold text-white mb-3">Last 7 days</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-slate-400 text-left">
              <th className="py-1 pr-2 font-bold">Day</th>
              <th className="py-1 px-2 font-bold">kcal</th>
              <th className="py-1 px-2 font-bold">Protein</th>
              <th className="py-1 px-2 font-bold">Water</th>
              <th className="py-1 pl-2 font-bold">Steps</th>
            </tr>
          </thead>
          <tbody>
            {days.map(d => {
              const totals = sumNutrients(foodLog.filter(e => e.clientId === clientId && e.date === d));
              const t = targetsFor(clientGoals, isTrainingDay(d, workouts));
              const m = daily.find(x => x.clientId === clientId && x.date === d);
              const hit = (v: number, target?: number | null) =>
                !target || !v ? 'text-slate-300' : Math.abs(v - target) / target <= 0.1 ? 'text-emerald-400' : 'text-amber-400';
              return (
                <tr key={d} className="border-t border-slate-800 cursor-pointer hover:bg-slate-800/40" onClick={() => onPickDay(d)}>
                  <td className="py-1.5 pr-2 font-semibold text-white whitespace-nowrap">{d === today ? 'Today' : formatDay(d)}</td>
                  <td className={`py-1.5 px-2 font-bold ${hit(totals.calories, t.calories)}`}>{totals.calories ? Math.round(totals.calories) : '—'}</td>
                  <td className={`py-1.5 px-2 font-bold ${hit(totals.protein, t.protein)}`}>{totals.protein ? `${Math.round(totals.protein)}g` : '—'}</td>
                  <td className="py-1.5 px-2 text-slate-300">{m?.waterMl ? `${(m.waterMl / 1000).toFixed(1)} L` : '—'}</td>
                  <td className="py-1.5 pl-2 text-slate-300">{m?.steps ? m.steps.toLocaleString() : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">Green: within 10% of target. Tap a day to open it.</p>
    </section>
  );
};

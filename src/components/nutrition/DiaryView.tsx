import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Droplets, Footprints, Minus, Plus, Trash2, UtensilsCrossed } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useNutrition } from '../../context/NutritionContext';
import { FoodItem, Meal } from '../../types';
import { formatDay } from '../../utils/dates';
import {
  addDays, describePortion, isTrainingDay, MEALS, mealPlanDayFor, sumNutrients, targetsFor,
} from '../../utils/nutrition';
import { FoodSearchSheet } from './FoodSearchSheet';
import { MacroSummary } from './MacroSummary';

interface DiaryViewProps {
  clientId: string;
  date: string;
  today: string;
  onDateChange: (date: string) => void;
}

/** One client-day: macros vs targets, meals, water & steps, and the assigned meal plan's day. */
export const DiaryView: React.FC<DiaryViewProps> = ({ clientId, date, today, onDateChange }) => {
  const { scheduledWorkouts } = useApp();
  const { foodLog, goals, daily, mealPlans, assignments, addFood, deleteFood, updateFood, setDaily, loadRange } = useNutrition();
  const [adding, setAdding] = useState<Meal | null>(null);

  const entries = foodLog.filter(e => e.clientId === clientId && e.date === date);
  const totals = sumNutrients(entries);
  const clientGoals = goals.find(g => g.clientId === clientId);
  const targets = targetsFor(clientGoals, isTrainingDay(date, scheduledWorkouts.filter(w => w.clientId === clientId)));
  const metric = daily.find(d => d.clientId === clientId && d.date === date);
  const assignment = assignments.find(a => a.clientId === clientId);
  const planDay = mealPlanDayFor(mealPlans.find(p => p.id === assignment?.mealPlanId), assignment, date);
  const recent = useMemo(() => foodLog.filter(e => e.clientId === clientId), [foodLog, clientId]);

  const go = (delta: number) => {
    const next = addDays(date, delta);
    onDateChange(next);
    // History beyond the initial window is fetched on demand.
    loadRange(addDays(next, -7), addDays(next, 1), clientId).catch(() => undefined);
  };

  const add = (item: FoodItem, meal: Meal) => addFood({ ...item, clientId, date, meal });
  const logPlanMeal = async (meal: Meal, items: FoodItem[]) => {
    for (const item of items) await addFood({ ...item, clientId, date, meal });
  };

  const water = metric?.waterMl ?? 0;
  const steps = metric?.steps ?? 0;

  return (
    <div className="space-y-4">
      {/* Date navigation */}
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => go(-1)} aria-label="Previous day" className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-center">
          <p className="text-sm font-bold text-white">{date === today ? 'Today' : formatDay(date)}</p>
          {date !== today && <button onClick={() => onDateChange(today)} className="text-[11px] font-semibold text-emerald-400">Back to today</button>}
        </div>
        <button onClick={() => go(1)} aria-label="Next day" disabled={date >= today} className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 disabled:opacity-30">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <MacroSummary totals={totals} targets={targets} />

      {/* Water & steps */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-3.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <Droplets className="h-4 w-4 text-cyan-400" /> Water
          </div>
          <p className="mt-1 text-lg font-extrabold text-white">
            {(water / 1000).toFixed(water % 1000 === 0 ? 0 : 2)} L
            {clientGoals?.waterMl ? <span className="text-xs font-semibold text-slate-400"> / {clientGoals.waterMl / 1000} L</span> : null}
          </p>
          <div className="mt-2 flex gap-1.5">
            <button onClick={() => setDaily(clientId, date, { waterMl: Math.max(0, water - 250) })} aria-label="Remove 250 ml" className="h-8 w-8 rounded-lg bg-slate-800 text-slate-100 flex items-center justify-center" disabled={water === 0}>
              <Minus className="h-4 w-4" />
            </button>
            <button onClick={() => setDaily(clientId, date, { waterMl: water + 250 })} className="flex-1 h-8 rounded-lg bg-cyan-500/15 text-cyan-400 text-xs font-bold">
              + 250 ml
            </button>
          </div>
        </div>
        <StepsCard steps={steps} target={clientGoals?.steps} onSave={v => setDaily(clientId, date, { steps: v })} />
      </div>

      {/* Meal plan for the day */}
      {planDay && (
        <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Meal plan · Day {planDay.dayNumber}</h3>
            <span className="ml-auto text-xs text-slate-400">{Math.round(sumNutrients(planDay.meals.flatMap(m => m.items)).calories)} kcal</span>
          </div>
          {planDay.meals.filter(m => m.items.length).map(m => (
            <div key={m.meal} className="flex items-start gap-3 py-1.5 border-t border-emerald-500/20">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-300">{MEALS.find(x => x.id === m.meal)?.label}</p>
                <p className="text-sm text-white">{m.items.map(i => i.name).join(', ')}</p>
              </div>
              <button onClick={() => logPlanMeal(m.meal, m.items)} className="shrink-0 px-2.5 py-1 rounded-lg bg-emerald-500 text-slate-950 text-xs font-bold">
                Log
              </button>
            </div>
          ))}
        </section>
      )}

      {/* Meals */}
      {MEALS.map(({ id, label }) => {
        const mealEntries = entries.filter(e => e.meal === id);
        const mealTotal = sumNutrients(mealEntries);
        return (
          <section key={id} className="rounded-2xl bg-slate-900 border border-slate-800">
            <header className="px-4 py-3 flex items-center gap-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">{label}</h3>
              <span className="text-xs text-slate-400">{Math.round(mealTotal.calories)} kcal</span>
              <button onClick={() => setAdding(id)} aria-label={`Add food to ${label}`} className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 text-xs font-semibold text-slate-100">
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </header>
            {mealEntries.length === 0 ? (
              <p className="px-4 py-3 text-xs text-slate-400">Nothing logged.</p>
            ) : (
              <ul className="divide-y divide-slate-800">
                {mealEntries.map(e => (
                  <li key={e.id} className="px-4 py-2.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{e.name}</p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {describePortion(e)}{describePortion(e) ? ' · ' : ''}P {Math.round(e.protein)} · C {Math.round(e.carbs)} · F {Math.round(e.fat)}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-white shrink-0">{Math.round(e.calories)}</span>
                    {e.source !== 'quick' && (
                      <select
                        aria-label={`${e.name} quantity`}
                        value={e.quantity}
                        onChange={ev => updateFood(e.id, { quantity: Number(ev.target.value) })}
                        className="h-7 px-1 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
                      >
                        {[...new Set([0.5, 1, 1.5, 2, 3, 4, e.quantity])].sort((a, b) => a - b).map(q => <option key={q} value={q}>{q}×</option>)}
                      </select>
                    )}
                    <button onClick={() => deleteFood(e.id)} aria-label={`Remove ${e.name}`} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      {adding && (
        <FoodSearchSheet
          title={`Add to ${MEALS.find(m => m.id === adding)?.label.toLowerCase()}`}
          defaultMeal={adding}
          recent={recent}
          onAdd={add}
          onClose={() => setAdding(null)}
        />
      )}
    </div>
  );
};

const StepsCard: React.FC<{ steps: number; target?: number | null; onSave: (v: number) => void }> = ({ steps, target, onSave }) => {
  const [value, setValue] = useState('');
  return (
    <form
      className="rounded-2xl bg-slate-900 border border-slate-800 p-3.5"
      onSubmit={e => {
        e.preventDefault();
        const n = parseInt(value, 10);
        if (Number.isFinite(n) && n >= 0) {
          onSave(n);
          setValue('');
        }
      }}
    >
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
        <Footprints className="h-4 w-4 text-emerald-400" /> Steps
      </div>
      <p className="mt-1 text-lg font-extrabold text-white">
        {steps.toLocaleString()}
        {target ? <span className="text-xs font-semibold text-slate-400"> / {target.toLocaleString()}</span> : null}
      </p>
      <div className="mt-2 flex gap-1.5">
        <input
          inputMode="numeric"
          value={value}
          onChange={e => setValue(e.target.value.replace(/\D/g, ''))}
          placeholder="Today's total"
          aria-label="Steps total"
          className="min-w-0 flex-1 h-8 px-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
        />
        <button type="submit" disabled={!value} className="h-8 px-2.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-bold disabled:opacity-50">
          Save
        </button>
      </div>
    </form>
  );
};

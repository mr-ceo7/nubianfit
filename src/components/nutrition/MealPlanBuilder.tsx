import React, { useState } from 'react';
import { Copy, Plus, Save, Trash2, X } from 'lucide-react';
import { useNutrition } from '../../context/NutritionContext';
import { FoodItem, Meal, MealPlan, MealPlanDay } from '../../types';
import { newId } from '../../utils/workout';
import { dayTotals, describePortion, MEALS, sumNutrients } from '../../utils/nutrition';
import { FoodSearchSheet } from './FoodSearchSheet';

type Draft = { id?: string; title: string; description: string; days: MealPlanDay[] };

const blankDay = (dayNumber: number): MealPlanDay => ({ id: newId('mpday'), dayNumber, meals: MEALS.map(m => ({ meal: m.id, items: [] })) });
const blankPlan = (): Draft => ({ title: '', description: '', days: [blankDay(1)] });
const toDraft = (p: MealPlan): Draft => ({
  id: p.id,
  title: p.title,
  description: p.description,
  // Make sure every meal slot exists so the editor can show all four.
  days: p.days.map(d => ({ ...d, meals: MEALS.map(m => d.meals.find(x => x.meal === m.id) ?? { meal: m.id, items: [] }) })),
});

/** Coach's sample meal plans: days × meals × foods, assigned per client from the Clients tab. */
export const MealPlanBuilder: React.FC = () => {
  const { mealPlans, saveMealPlan, deleteMealPlan, goals } = useNutrition();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dayIndex, setDayIndex] = useState(0);
  const [adding, setAdding] = useState<Meal | null>(null);
  const [saving, setSaving] = useState(false);

  if (!draft) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-slate-400">Sample days of eating that clients can follow and log with one tap.</p>
          <button onClick={() => { setDraft(blankPlan()); setDayIndex(0); }} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-bold shrink-0">
            <Plus className="h-4 w-4" /> New plan
          </button>
        </div>
        {mealPlans.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-slate-800 p-10 text-center text-sm text-slate-300">No meal plans yet.</p>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {mealPlans.map(p => {
              const avg = p.days.length ? Math.round(p.days.reduce((s, d) => s + dayTotals(d).calories, 0) / p.days.length) : 0;
              return (
                <button key={p.id} onClick={() => { setDraft(toDraft(p)); setDayIndex(0); }} className="text-left rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 p-4 min-w-0">
                  <p className="text-sm font-bold text-white line-clamp-2">{p.title}</p>
                  <p className="mt-1 text-xs text-slate-400">{p.days.length} day{p.days.length === 1 ? '' : 's'} · ~{avg} kcal/day</p>
                  {p.description && <p className="mt-1 text-xs text-slate-400 line-clamp-2">{p.description}</p>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const day = draft.days[dayIndex] ?? draft.days[0];
  const totals = dayTotals(day);
  const setDay = (next: MealPlanDay) => setDraft({ ...draft, days: draft.days.map((d, i) => (i === dayIndex ? next : d)) });
  const renumber = (days: MealPlanDay[]) => days.map((d, i) => ({ ...d, dayNumber: i + 1 }));
  const updateItems = (meal: Meal, fn: (items: FoodItem[]) => FoodItem[]) =>
    setDay({ ...day, meals: day.meals.map(m => (m.meal === meal ? { ...m, items: fn(m.items) } : m)) });

  const save = async () => {
    if (!draft.title.trim()) return;
    setSaving(true);
    const saved = await saveMealPlan({ title: draft.title.trim(), description: draft.description, days: draft.days }, draft.id);
    setSaving(false);
    if (saved) setDraft(toDraft(saved));
  };

  // Rough reference: the average of the coach's clients' calorie targets.
  const targetValues = goals.map(g => g.calories).filter((v): v is number => !!v);
  const avgTarget = targetValues.length ? Math.round(targetValues.reduce((a, b) => a + b, 0) / targetValues.length) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setDraft(null)} className="px-3 py-2 rounded-xl bg-slate-800 text-slate-100 text-sm font-semibold">All plans</button>
        <div className="ml-auto flex gap-2">
          {draft.id && (
            <button
              onClick={async () => { if (window.confirm(`Delete "${draft.title}"? Clients following it will lose it.`) && await deleteMealPlan(draft.id!)) setDraft(null); }}
              className="px-3 py-2 rounded-xl text-red-400 text-sm font-semibold hover:bg-slate-800"
            >
              Delete
            </button>
          )}
          <button onClick={save} disabled={saving || !draft.title.trim()} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-sm font-bold">
            <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save plan'}
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="text-xs font-semibold text-slate-300">Plan name
          <input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. 2,500 kcal Kenyan staples" className="mt-1 w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white" />
        </label>
        <label className="text-xs font-semibold text-slate-300">Description
          <input value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} className="mt-1 w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white" />
        </label>
      </div>

      {/* Day tabs */}
      <div className="flex flex-wrap items-center gap-1.5">
        {draft.days.map((d, i) => (
          <button key={d.id} onClick={() => setDayIndex(i)} aria-pressed={i === dayIndex}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold ${i === dayIndex ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-100'}`}>
            Day {d.dayNumber}
          </button>
        ))}
        {draft.days.length < 28 && (
          <>
            <button onClick={() => { setDraft({ ...draft, days: [...draft.days, blankDay(draft.days.length + 1)] }); setDayIndex(draft.days.length); }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-100 text-xs font-semibold">
              <Plus className="h-3.5 w-3.5" /> Day
            </button>
            <button
              onClick={() => {
                const copy = { ...structuredClone(day), id: newId('mpday'), dayNumber: draft.days.length + 1 };
                setDraft({ ...draft, days: [...draft.days, copy] });
                setDayIndex(draft.days.length);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-100 text-xs font-semibold"
            >
              <Copy className="h-3.5 w-3.5" /> Duplicate day
            </button>
          </>
        )}
        {draft.days.length > 1 && (
          <button
            onClick={() => { setDraft({ ...draft, days: renumber(draft.days.filter((_, i) => i !== dayIndex)) }); setDayIndex(Math.max(0, dayIndex - 1)); }}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-red-400 text-xs font-semibold hover:bg-slate-800"
          >
            <Trash2 className="h-3.5 w-3.5" /> Remove day
          </button>
        )}
      </div>

      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 grid grid-cols-4 gap-2 text-center">
        {([['kcal', totals.calories], ['Protein', totals.protein], ['Carbs', totals.carbs], ['Fat', totals.fat]] as const).map(([l, v]) => (
          <div key={l}>
            <p className="text-lg font-extrabold text-white">{Math.round(v)}{l === 'kcal' ? '' : 'g'}</p>
            <p className="text-[10px] text-slate-400">{l}{l === 'kcal' && avgTarget ? ` (clients avg ${avgTarget})` : ''}</p>
          </div>
        ))}
      </div>

      {day.meals.map(m => (
        <section key={m.meal} className="rounded-2xl bg-slate-900 border border-slate-800">
          <header className="px-4 py-2.5 flex items-center gap-2 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white">{MEALS.find(x => x.id === m.meal)?.label}</h3>
            <span className="text-xs text-slate-400">{Math.round(sumNutrients(m.items).calories)} kcal</span>
            <button onClick={() => setAdding(m.meal)} className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 text-xs font-semibold text-slate-100">
              <Plus className="h-3.5 w-3.5" /> Add food
            </button>
          </header>
          {m.items.length === 0 ? (
            <p className="px-4 py-3 text-xs text-slate-400">Empty.</p>
          ) : (
            <ul className="divide-y divide-slate-800">
              {m.items.map((item, i) => (
                <li key={`${item.sourceId}-${i}`} className="px-4 py-2 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{item.name}</p>
                    <p className="text-[11px] text-slate-400">{describePortion(item)} · P {Math.round(item.protein)} · C {Math.round(item.carbs)} · F {Math.round(item.fat)}</p>
                  </div>
                  <span className="text-sm font-bold text-white">{Math.round(item.calories)}</span>
                  <button onClick={() => updateItems(m.meal, items => items.filter((_, j) => j !== i))} aria-label={`Remove ${item.name}`} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      {adding && (
        <FoodSearchSheet
          title={`Add to ${MEALS.find(x => x.id === adding)?.label.toLowerCase()} · Day ${day.dayNumber}`}
          defaultMeal={adding}
          onAdd={(item, meal) => { updateItems(meal, items => [...items, item]); return true; }}
          onClose={() => setAdding(null)}
        />
      )}
    </div>
  );
};

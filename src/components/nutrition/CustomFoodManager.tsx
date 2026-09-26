import React, { useState } from 'react';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useNutrition } from '../../context/NutritionContext';
import { FoodResult } from '../../types';

type Draft = { id?: string; name: string; servingLabel: string; servingGrams: string; calories: string; protein: string; carbs: string; fat: string; fiber: string };

const EMPTY: Draft = { name: '', servingLabel: '1 portion', servingGrams: '', calories: '', protein: '', carbs: '', fat: '', fiber: '' };

/** Coaches enter nutrition per serving (what they know for local dishes); it's stored per 100 g. */
const toDraft = (f: FoodResult): Draft => {
  const serving = f.servings.find(s => s.label !== '100 g') ?? { label: '100 g', grams: 100 };
  const k = serving.grams / 100;
  const r = (n: number) => String(Math.round(n * k * 10) / 10);
  return {
    id: f.sourceId, name: f.name, servingLabel: serving.label, servingGrams: String(serving.grams),
    calories: r(f.per100g.calories), protein: r(f.per100g.protein), carbs: r(f.per100g.carbs), fat: r(f.per100g.fat), fiber: r(f.per100g.fiber),
  };
};

export const CustomFoodManager: React.FC = () => {
  const { customFoods, saveCustomFood, deleteCustomFood } = useNutrition();
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const filtered = customFoods.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const grams = Number(draft.servingGrams);
    if (!(grams > 0)) return;
    const per100 = (v: string) => Math.round(((Number(v) || 0) * 100 / grams) * 100) / 100;
    setSaving(true);
    const saved = await saveCustomFood({
      name: draft.name.trim(),
      per100g: { calories: per100(draft.calories), protein: per100(draft.protein), carbs: per100(draft.carbs), fat: per100(draft.fat), fiber: per100(draft.fiber) },
      servings: draft.servingLabel.trim() && draft.servingLabel.trim() !== '100 g' ? [{ label: draft.servingLabel.trim(), grams }] : [],
    }, draft.id);
    setSaving(false);
    if (saved) setDraft(null);
  };

  const field = 'w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500';
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement>) => setDraft(d => d && ({ ...d, [k]: e.target.value }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search your foods…" aria-label="Search your foods" className={`${field} pl-9`} />
        </div>
        <button onClick={() => setDraft(EMPTY)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-bold">
          <Plus className="h-4 w-4" /> New food
        </button>
      </div>
      <p className="text-xs text-slate-400">Your foods appear first when you and your clients search, alongside USDA results.</p>

      <div className="rounded-2xl bg-slate-900 border border-slate-800 divide-y divide-slate-800">
        {filtered.length === 0 && <p className="p-4 text-sm text-slate-400">{customFoods.length ? 'No matches.' : 'Add local dishes and brands your clients eat.'}</p>}
        {filtered.map(f => {
          const serving = f.servings.find(s => s.label !== '100 g');
          return (
            <div key={f.sourceId} className="px-4 py-2.5 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{f.name}</p>
                <p className="text-[11px] text-slate-400">
                  Per 100 g: {Math.round(f.per100g.calories)} kcal · P {f.per100g.protein} · C {f.per100g.carbs} · F {f.per100g.fat}
                  {serving ? ` · ${serving.label} = ${serving.grams} g` : ''}
                </p>
              </div>
              <button onClick={() => setDraft(toDraft(f))} aria-label={`Edit ${f.name}`} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => window.confirm(`Delete ${f.name}? Past diary entries keep their values.`) && deleteCustomFood(f.sourceId)} aria-label={`Delete ${f.name}`} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setDraft(null)}>
          <form role="dialog" aria-modal="true" aria-label={draft.id ? 'Edit food' : 'New food'} onSubmit={save} onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-5 space-y-3">
            <h3 className="text-sm font-bold text-white">{draft.id ? 'Edit food' : 'New food'}</h3>
            <label className="block text-xs font-semibold text-slate-300">Name
              <input autoFocus required value={draft.name} onChange={set('name')} placeholder="e.g. Ugali (maize meal)" className={`${field} mt-1`} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs font-semibold text-slate-300">Serving
                <input value={draft.servingLabel} onChange={set('servingLabel')} placeholder="1 piece, 1 cup…" className={`${field} mt-1`} />
              </label>
              <label className="text-xs font-semibold text-slate-300">Serving weight (g)
                <input required inputMode="decimal" value={draft.servingGrams} onChange={set('servingGrams')} className={`${field} mt-1`} />
              </label>
            </div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Nutrition per serving</p>
            <div className="grid grid-cols-5 gap-2">
              {(['calories', 'protein', 'carbs', 'fat', 'fiber'] as const).map(k => (
                <label key={k} className="text-[11px] font-semibold text-slate-300 capitalize">{k === 'calories' ? 'kcal' : `${k} g`}
                  <input inputMode="decimal" value={draft[k]} onChange={set(k)} required={k === 'calories'} className={`${field} mt-1 px-2`} />
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setDraft(null)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-100 text-sm font-semibold">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-sm font-bold">
                {saving ? 'Saving…' : 'Save food'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

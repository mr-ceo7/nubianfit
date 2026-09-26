import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Clock, Database, Search, Star, X } from 'lucide-react';
import { foodsApi } from '../../services/apiClient';
import { FoodItem, FoodLogEntry, FoodResult, Meal } from '../../types';
import { MEALS, portionOf } from '../../utils/nutrition';

interface FoodSearchSheetProps {
  title?: string;
  defaultMeal: Meal;
  /** Recently logged foods to offer before searching. */
  recent?: FoodLogEntry[];
  onAdd: (item: FoodItem, meal: Meal) => Promise<boolean> | boolean;
  onClose: () => void;
}

const field = 'w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500';

/** Search USDA + custom foods, pick a portion, and add it to a meal. Also supports quick-add macros. */
export const FoodSearchSheet: React.FC<FoodSearchSheetProps> = ({ title = 'Add food', defaultMeal, recent = [], onAdd, onClose }) => {
  const [mode, setMode] = useState<'search' | 'quick'>('search');
  const [meal, setMeal] = useState<Meal>(defaultMeal);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodResult[]>([]);
  const [usdaError, setUsdaError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<FoodResult | null>(null);

  // Debounced search: USDA is rate limited, so wait for the user to pause typing.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setUsdaError(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await foodsApi.search(q);
        if (!cancelled) {
          setResults(res.results);
          setUsdaError(res.usdaError);
        }
      } catch (err) {
        if (!cancelled) setUsdaError(err instanceof Error ? err.message : 'Search failed');
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  // Most recent distinct foods (by source + name), newest first.
  const recentFoods = useMemo(() => {
    const seen = new Set<string>();
    return [...recent]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .filter(e => {
        const key = `${e.source}:${e.sourceId ?? e.name}:${e.servingLabel}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 8);
  }, [recent]);

  const addRecent = async (e: FoodLogEntry) => {
    const { id: _id, clientId: _c, date: _d, meal: _m, createdAt: _ca, ...item } = e;
    if (await onAdd(item, meal)) onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/70 sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-lg h-[88dvh] sm:h-[80vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl"
      >
        <header className="p-4 border-b border-slate-800 space-y-3">
          <div className="flex items-center gap-2">
            {selected && (
              <button onClick={() => setSelected(null)} aria-label="Back to results" className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <h3 className="flex-1 text-sm font-bold text-white">{title}</h3>
            <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select aria-label="Meal" value={meal} onChange={e => setMeal(e.target.value as Meal)} className={field}>
              {MEALS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
            <div className="grid grid-cols-2 rounded-xl bg-slate-950 border border-slate-800 p-1">
              {(['search', 'quick'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setSelected(null); }}
                  aria-pressed={mode === m}
                  className={`rounded-lg text-xs font-bold ${mode === m ? 'bg-emerald-500 text-slate-950' : 'text-slate-300'}`}
                >
                  {m === 'search' ? 'Search' : 'Quick add'}
                </button>
              ))}
            </div>
          </div>
          {mode === 'search' && !selected && (
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search foods (e.g. ugali, rice, eggs)"
                aria-label="Search foods"
                className={`${field} pl-9`}
              />
            </div>
          )}
        </header>

        <div className="flex-1 overflow-y-auto">
          {mode === 'quick' ? (
            <QuickAdd onAdd={async item => { if (await onAdd(item, meal)) onClose(); }} />
          ) : selected ? (
            <PortionPicker food={selected} onAdd={async item => { if (await onAdd(item, meal)) onClose(); }} />
          ) : (
            <div className="p-2">
              {query.trim().length < 2 && recentFoods.length > 0 && (
                <>
                  <p className="px-2 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">Recent</p>
                  {recentFoods.map(e => (
                    <button key={e.id} onClick={() => addRecent(e)} className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-800 text-left">
                      <Clock className="h-4 w-4 text-slate-400 shrink-0" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold text-white truncate">{e.name}</span>
                        <span className="block text-xs text-slate-400">{e.quantity} × {e.servingLabel || 'serving'} · {Math.round(e.calories)} kcal</span>
                      </span>
                      <span className="text-xs font-bold text-emerald-400">Add</span>
                    </button>
                  ))}
                </>
              )}
              {searching && <p className="p-4 text-sm text-slate-400">Searching…</p>}
              {usdaError && <p role="status" className="mx-2 my-2 p-2.5 rounded-lg bg-amber-500/10 text-xs text-amber-400">{usdaError}</p>}
              {!searching && query.trim().length >= 2 && results.length === 0 && (
                <p className="p-4 text-sm text-slate-400">No foods found. Try another word, or use Quick add.</p>
              )}
              {results.map(food => (
                <button
                  key={`${food.source}-${food.sourceId}`}
                  onClick={() => setSelected(food)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-800 text-left"
                >
                  {food.source === 'custom'
                    ? <Star className="h-4 w-4 text-emerald-400 shrink-0" aria-label="Coach food" />
                    : <Database className="h-4 w-4 text-slate-400 shrink-0" aria-label="USDA food" />}
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-white truncate">{food.name}</span>
                    <span className="block text-xs text-slate-400">
                      {Math.round(food.per100g.calories)} kcal · P {food.per100g.protein} · C {food.per100g.carbs} · F {food.per100g.fat} per 100 g
                    </span>
                  </span>
                </button>
              ))}
              {results.some(r => r.source === 'usda') && (
                <p className="px-3 py-3 text-[10px] text-slate-400">Nutrition data: USDA FoodData Central.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/** Choose serving and quantity; loads household portions for USDA foods. */
const PortionPicker: React.FC<{ food: FoodResult; onAdd: (item: FoodItem) => void }> = ({ food: initial, onAdd }) => {
  const [food, setFood] = useState(initial);
  const [servingIndex, setServingIndex] = useState(initial.servings.length > 1 ? 1 : 0);
  const [quantity, setQuantity] = useState('1');
  const [loadingPortions, setLoadingPortions] = useState(initial.source === 'usda');

  useEffect(() => {
    if (initial.source !== 'usda') return;
    let cancelled = false;
    foodsApi.usda(initial.sourceId)
      .then(full => {
        if (cancelled) return;
        setFood(full);
        setServingIndex(full.servings.length > 1 ? 1 : 0);
      })
      .catch(() => { /* keep the search result's 100 g serving */ })
      .finally(() => { if (!cancelled) setLoadingPortions(false); });
    return () => { cancelled = true; };
  }, [initial]);

  const q = Number(quantity);
  const valid = Number.isFinite(q) && q > 0 && q <= 100;
  const item = portionOf(food, food.servings[servingIndex] ?? food.servings[0], valid ? q : 0);

  return (
    <div className="p-4 space-y-4">
      <div>
        <p className="text-base font-bold text-white">{food.name}</p>
        <p className="text-xs text-slate-400">{food.source === 'custom' ? 'Coach food' : 'USDA FoodData Central'}</p>
      </div>
      <div className="grid grid-cols-[1fr_96px] gap-2">
        <label className="text-xs font-semibold text-slate-300">Serving
          <select value={servingIndex} onChange={e => setServingIndex(Number(e.target.value))} className={`${field} mt-1`} disabled={loadingPortions}>
            {food.servings.map((s, i) => <option key={`${s.label}-${i}`} value={i}>{s.label}{s.label.endsWith(' g') ? '' : ` (${s.grams} g)`}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-300">Quantity
          <input inputMode="decimal" value={quantity} onChange={e => setQuantity(e.target.value)} className={`${field} mt-1`} />
        </label>
      </div>
      {loadingPortions && <p className="text-xs text-slate-400">Loading serving sizes…</p>}
      <div className="grid grid-cols-4 gap-2 text-center">
        {([['kcal', item.calories], ['Protein', item.protein], ['Carbs', item.carbs], ['Fat', item.fat]] as const).map(([label, v]) => (
          <div key={label} className="rounded-xl bg-slate-950 border border-slate-800 p-2">
            <p className="text-base font-extrabold text-white">{Math.round(v)}{label === 'kcal' ? '' : 'g'}</p>
            <p className="text-[10px] text-slate-400">{label}</p>
          </div>
        ))}
      </div>
      <button onClick={() => onAdd(item)} disabled={!valid} className="w-full h-11 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-sm font-bold">
        Add food
      </button>
    </div>
  );
};

const QuickAdd: React.FC<{ onAdd: (item: FoodItem) => void }> = ({ onAdd }) => {
  const [name, setName] = useState('');
  const [values, setValues] = useState({ calories: '', protein: '', carbs: '', fat: '' });
  const num = (v: string) => (v ? Number(v) : 0);
  const valid = num(values.calories) > 0 && num(values.calories) <= 10000;

  return (
    <form
      className="p-4 space-y-3"
      onSubmit={e => {
        e.preventDefault();
        if (!valid) return;
        onAdd({
          source: 'quick', sourceId: null, name: name.trim() || 'Quick add', servingLabel: '', servingGrams: null, quantity: 1,
          calories: num(values.calories), protein: num(values.protein), carbs: num(values.carbs), fat: num(values.fat), fiber: 0,
        });
      }}
    >
      <p className="text-xs text-slate-400">For restaurant meals or labels you've already read.</p>
      <label className="block text-xs font-semibold text-slate-300">Name (optional)
        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Chicken wrap" className={`${field} mt-1`} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        {(['calories', 'protein', 'carbs', 'fat'] as const).map(k => (
          <label key={k} className="text-xs font-semibold text-slate-300 capitalize">{k === 'calories' ? 'Calories (kcal)' : `${k} (g)`}
            <input inputMode="decimal" value={values[k]} onChange={e => setValues(v => ({ ...v, [k]: e.target.value }))} required={k === 'calories'} className={`${field} mt-1`} />
          </label>
        ))}
      </div>
      <button type="submit" disabled={!valid} className="w-full h-11 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-sm font-bold">
        Add
      </button>
    </form>
  );
};

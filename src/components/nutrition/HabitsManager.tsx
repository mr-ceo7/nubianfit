import React, { useState } from 'react';
import { Flame, Pencil, Plus, Trash2 } from 'lucide-react';
import { useNutrition } from '../../context/NutritionContext';
import { Habit } from '../../types';
import { localDateStr } from '../../utils/dates';
import { habitCompletionRate, habitStreak } from '../../utils/nutrition';
import { HabitChecklist } from './HabitChecklist';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const scheduleLabel = (days: number[]) =>
  days.length === 0 || days.length === 7 ? 'Every day' : days.map(d => WEEKDAYS[d - 1]).join(', ');

type Draft = { title: string; targetValue: string; unit: string; daysOfWeek: number[] };
const EMPTY: Draft = { title: '', targetValue: '', unit: '', daysOfWeek: [] };

/** Coach view: define a client's habits and see streaks and weekly completion. */
export const HabitsManager: React.FC<{ clientId: string }> = ({ clientId }) => {
  const { habits, checkins, createHabit, updateHabit, deleteHabit } = useNutrition();
  const today = localDateStr();
  const clientHabits = habits.filter(h => h.clientId === clientId).sort((a, b) => a.sortOrder - b.sortOrder);
  const [editing, setEditing] = useState<{ id?: string; draft: Draft } | null>(null);
  const [saving, setSaving] = useState(false);

  const openEdit = (h: Habit) =>
    setEditing({ id: h.id, draft: { title: h.title, targetValue: h.targetValue?.toString() ?? '', unit: h.unit, daysOfWeek: h.daysOfWeek } });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !editing.draft.title.trim()) return;
    setSaving(true);
    const { title, targetValue, unit, daysOfWeek } = editing.draft;
    const body = {
      title: title.trim(),
      targetValue: targetValue ? Number(targetValue) : null,
      unit: unit.trim(),
      daysOfWeek,
    };
    const ok = editing.id
      ? await updateHabit(editing.id, body)
      : await createHabit({ ...body, clientId, sortOrder: clientHabits.length });
    setSaving(false);
    if (ok) setEditing(null);
  };

  const rate = habitCompletionRate(clientHabits, checkins, today, 7);
  const field = 'w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:items-start">
      <section className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-white">Habits</h3>
            <p className="text-xs text-slate-400">{rate === null ? 'No habits yet' : `${rate}% completed in the last 7 days`}</p>
          </div>
          <button
            onClick={() => setEditing({ draft: EMPTY })}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold"
          >
            <Plus className="h-3.5 w-3.5" /> Add habit
          </button>
        </div>
        {clientHabits.length === 0 && <p className="text-sm text-slate-400">Give this client a few daily habits to build (sleep, protein, a walk…).</p>}
        <ul className="divide-y divide-slate-800">
          {clientHabits.map(h => {
            const streak = habitStreak(h, checkins, today);
            const weekRate = habitCompletionRate([h], checkins, today, 7);
            return (
              <li key={h.id} className="py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${h.active ? 'text-white' : 'text-slate-400 line-through'}`}>{h.title}</p>
                  <p className="text-[11px] text-slate-400">
                    {scheduleLabel(h.daysOfWeek)}{h.targetValue ? ` · ${h.targetValue} ${h.unit}` : ''}{weekRate !== null ? ` · ${weekRate}% this week` : ''}
                  </p>
                </div>
                {streak > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-xs font-bold text-amber-400" title="Current streak">
                    <Flame className="h-3.5 w-3.5" />{streak}
                  </span>
                )}
                <button onClick={() => openEdit(h)} aria-label={`Edit ${h.title}`} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => window.confirm(`Delete "${h.title}" and its history?`) && deleteHabit(h.id)}
                  aria-label={`Delete ${h.title}`}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
        <h3 className="text-sm font-bold text-white mb-2">Today</h3>
        <HabitChecklist clientId={clientId} date={today} today={today} />
      </section>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setEditing(null)}>
          <form
            role="dialog"
            aria-modal="true"
            aria-label={editing.id ? 'Edit habit' : 'Add habit'}
            onSubmit={save}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 p-5 space-y-3"
          >
            <h3 className="text-sm font-bold text-white">{editing.id ? 'Edit habit' : 'Add habit'}</h3>
            <label className="block text-xs font-semibold text-slate-300">Habit
              <input
                autoFocus
                required
                value={editing.draft.title}
                onChange={e => setEditing({ ...editing, draft: { ...editing.draft, title: e.target.value } })}
                placeholder="e.g. Walk 20 minutes after dinner"
                className={`${field} mt-1`}
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs font-semibold text-slate-300">Target (optional)
                <input inputMode="decimal" value={editing.draft.targetValue} onChange={e => setEditing({ ...editing, draft: { ...editing.draft, targetValue: e.target.value.replace(/[^\d.]/g, '') } })} className={`${field} mt-1`} />
              </label>
              <label className="text-xs font-semibold text-slate-300">Unit
                <input value={editing.draft.unit} onChange={e => setEditing({ ...editing, draft: { ...editing.draft, unit: e.target.value } })} placeholder="min, hrs, g…" className={`${field} mt-1`} />
              </label>
            </div>
            <fieldset>
              <legend className="text-xs font-semibold text-slate-300 mb-1">Days (none = every day)</legend>
              <div className="grid grid-cols-7 gap-1">
                {WEEKDAYS.map((d, i) => {
                  const day = i + 1;
                  const on = editing.draft.daysOfWeek.includes(day);
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setEditing({
                        ...editing,
                        draft: { ...editing.draft, daysOfWeek: on ? editing.draft.daysOfWeek.filter(x => x !== day) : [...editing.draft.daysOfWeek, day].sort() },
                      })}
                      className={`h-8 rounded-lg text-[11px] font-bold ${on ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-100'}`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            {editing.id && (
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  className="accent-emerald-500"
                  checked={clientHabits.find(h => h.id === editing.id)?.active ?? true}
                  onChange={e => updateHabit(editing.id!, { active: e.target.checked })}
                />
                Active (paused habits are hidden from the client)
              </label>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-100 text-sm font-semibold">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-sm font-bold">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

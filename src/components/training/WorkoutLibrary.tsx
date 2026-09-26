import React, { useState } from 'react';
import { CalendarPlus, Copy, Dumbbell, Link2, Pencil, Plus, Search, Timer, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { WorkoutTemplate } from '../../types';
import { cloneContent, groupLabel } from '../../utils/workout';
import { localDateStr } from '../../utils/dates';
import { WorkoutEditorSheet } from './WorkoutEditorSheet';
import { WorkoutDraft } from './WorkoutEditor';

const BLANK: WorkoutDraft = { title: '', description: '', estimatedDurationMin: 60, exercises: [], groups: [] };

const toDraft = (t: WorkoutTemplate): WorkoutDraft => ({
  title: t.title,
  description: t.description,
  estimatedDurationMin: t.estimatedDurationMin,
  exercises: t.exercises,
  groups: t.groups ?? [],
});

/** Coach's reusable workouts: build once, drop into programs or assign one-off. */
export const WorkoutLibrary: React.FC = () => {
  const { workoutTemplates, saveWorkoutTemplate, deleteWorkoutTemplate } = useApp();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<{ id?: string; draft: WorkoutDraft } | null>(null);
  const [assigning, setAssigning] = useState<WorkoutTemplate | null>(null);

  const filtered = workoutTemplates.filter(t => t.title.toLowerCase().includes(search.toLowerCase()));

  const save = async (draft: WorkoutDraft) => {
    const saved = await saveWorkoutTemplate({
      id: editing?.id,
      title: draft.title,
      description: draft.description ?? '',
      estimatedDurationMin: draft.estimatedDurationMin ?? 60,
      tags: [],
      exercises: draft.exercises,
      groups: draft.groups ?? [],
    });
    return saved !== null;
  };

  const duplicate = (t: WorkoutTemplate) =>
    setEditing({ draft: { ...cloneContent(toDraft(t)), title: `${t.title} (copy)` } });

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-white">Workout library</h2>
          <p className="text-sm text-slate-400">Reusable workouts for programs and one-off sessions.</p>
        </div>
        <button
          onClick={() => setEditing({ draft: BLANK })}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-bold"
        >
          <Plus className="h-4 w-4" /> New workout
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search workouts…"
          aria-label="Search workouts"
          className="w-full h-9 pl-9 pr-3 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-800 p-10 text-center">
          <Dumbbell className="h-8 w-8 text-slate-500 mx-auto" />
          <p className="mt-3 text-sm text-slate-300">
            {workoutTemplates.length === 0 ? 'No saved workouts yet. Build one to reuse it across programs.' : 'No workouts match your search.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filtered.map(t => (
            <article key={t.id} className="rounded-2xl bg-slate-900 border border-slate-800 p-3 sm:p-4 flex flex-col gap-2 min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-white line-clamp-2">{t.title}</h3>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] sm:text-xs text-slate-400">
                <span className="inline-flex items-center gap-1"><Dumbbell className="h-3 w-3" />{t.exercises.length} exercises</span>
                <span className="inline-flex items-center gap-1"><Timer className="h-3 w-3" />{t.estimatedDurationMin} min</span>
              </div>
              {(t.groups ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {(t.groups ?? []).slice(0, 3).map(g => (
                    <span key={g.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
                      <Link2 className="h-2.5 w-2.5" />{groupLabel(g)}
                    </span>
                  ))}
                </div>
              )}
              {t.description && <p className="text-xs text-slate-400 line-clamp-2">{t.description}</p>}
              <div className="mt-auto pt-2 flex items-center gap-1 border-t border-slate-800">
                <CardAction label="Edit" onClick={() => setEditing({ id: t.id, draft: toDraft(t) })}><Pencil className="h-3.5 w-3.5" /></CardAction>
                <CardAction label="Duplicate" onClick={() => duplicate(t)}><Copy className="h-3.5 w-3.5" /></CardAction>
                <CardAction label="Assign to a client" onClick={() => setAssigning(t)}><CalendarPlus className="h-3.5 w-3.5" /></CardAction>
                <CardAction
                  label="Delete"
                  onClick={() => window.confirm(`Delete "${t.title}"? Programs that already use it keep their copy.`) && deleteWorkoutTemplate(t.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </CardAction>
              </div>
            </article>
          ))}
        </div>
      )}

      {editing && (
        <WorkoutEditorSheet
          heading={editing.id ? 'Edit workout' : 'New workout'}
          initial={editing.draft}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}
      {assigning && <AssignWorkoutDialog template={assigning} onClose={() => setAssigning(null)} />}
    </div>
  );
};

const CardAction: React.FC<{ label: string; onClick: () => void; children: React.ReactNode }> = ({ label, onClick, children }) => (
  <button onClick={onClick} aria-label={label} title={label} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
    {children}
  </button>
);

/** Put a copy of a library workout on one client's calendar. */
const AssignWorkoutDialog: React.FC<{ template: WorkoutTemplate; onClose: () => void }> = ({ template, onClose }) => {
  const { clients, scheduleWorkout } = useApp();
  const [clientId, setClientId] = useState(clients[0]?.id ?? '');
  const [date, setDate] = useState(localDateStr());
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    setSaving(true);
    const content = cloneContent({ exercises: template.exercises, groups: template.groups ?? [] });
    const ok = await scheduleWorkout({
      clientId,
      clientName: client.name,
      clientAvatar: client.avatar,
      workoutDayId: template.id,
      workoutTitle: template.title,
      description: template.description,
      date,
      status: 'Scheduled',
      exercises: content.exercises,
      groups: content.groups,
    });
    setSaving(false);
    if (ok) onClose();
  };

  const field = 'w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <form role="dialog" aria-modal="true" aria-label="Assign workout" onSubmit={submit} onClick={e => e.stopPropagation()} className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 p-5 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-white">Assign “{template.title}”</h3>
          <p className="text-xs text-slate-400 mt-0.5">The client gets their own copy on the chosen day.</p>
        </div>
        {clients.length === 0 ? (
          <p className="text-sm text-slate-300">Add a client first.</p>
        ) : (
          <>
            <label className="block text-xs font-semibold text-slate-300">Client
              <select value={clientId} onChange={e => setClientId(e.target.value)} className={`${field} mt-1`}>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-300">Date
              <input type="date" value={date} onChange={e => setDate(e.target.value)} required className={`${field} mt-1`} />
            </label>
          </>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-100 text-sm font-semibold">Cancel</button>
          <button type="submit" disabled={saving || !clientId} className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-sm font-bold">
            {saving ? 'Assigning…' : 'Assign'}
          </button>
        </div>
      </form>
    </div>
  );
};

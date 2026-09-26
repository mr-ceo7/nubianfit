import React, { useMemo, useState } from 'react';
import { BookOpen, CalendarPlus, Copy, Dumbbell, Eraser, Plus, Save, Trash2, UserMinus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Difficulty, FitnessGoal, TrainingProgram, WorkoutDay, WorkoutTemplate } from '../../types';
import { localDateStr } from '../../utils/dates';
import { cloneContent, newId } from '../../utils/workout';
import { WorkoutEditorSheet } from '../training/WorkoutEditorSheet';
import { WorkoutDraft } from '../training/WorkoutEditor';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const GOALS: FitnessGoal[] = ['Hypertrophy', 'Fat Loss', 'Strength & Power', 'Athletic Conditioning', 'Endurance', 'Rehabilitation'];
const DIFFICULTIES: Difficulty[] = ['Beginner', 'Intermediate', 'Advanced'];

/** An unsaved program; its placeholder id is replaced by the server's on first save. */
function makeBlankProgram(): TrainingProgram {
  const today = localDateStr();
  return {
    id: `draft-${Date.now()}`,
    title: 'New Training Program',
    subtitle: '',
    description: '',
    difficulty: 'Intermediate',
    goal: 'Hypertrophy',
    durationWeeks: 4,
    daysPerWeek: 0,
    tags: [],
    assignedClientCount: 0,
    createdAt: today,
    updatedAt: today,
    days: [],
  };
}

/** Today if it's a Monday, otherwise the coming Monday. */
function nextMonday(from = new Date()): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7));
  return d;
}

const daysPerWeek = (days: WorkoutDay[]) => new Set(days.filter(d => d.dayNumber <= 7).map(d => d.dayNumber)).size;

type EditingSlot = { dayNumber: number; dayId?: string; draft: WorkoutDraft };

export const ProgramBuilder: React.FC<{ initialProgramId?: string }> = ({ initialProgramId }) => {
  const { programs, clients, workoutTemplates, saveProgram, deleteProgram, unassignProgram, showToast } = useApp();

  const [program, setProgram] = useState<TrainingProgram>(() => {
    const found = programs.find(p => p.id === initialProgramId) ?? programs[0];
    return found ? structuredClone(found) : makeBlankProgram();
  });
  const saved = programs.find(p => p.id === program.id);
  const isSaved = !!saved;
  const dirty = !saved || JSON.stringify(saved) !== JSON.stringify(program);

  const [editing, setEditing] = useState<EditingSlot | null>(null);
  const [addingTo, setAddingTo] = useState<number | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const byDay = useMemo(() => {
    const map = new Map<number, WorkoutDay[]>();
    program.days.forEach(d => map.set(d.dayNumber, [...(map.get(d.dayNumber) ?? []), d]));
    return map;
  }, [program.days]);
  const onProgram = clients.filter(c => c.currentProgramId === program.id);

  const confirmDiscard = () => !dirty || window.confirm('You have unsaved changes to this program. Discard them?');

  const loadProgram = (id: string) => {
    if (!confirmDiscard()) return;
    const found = programs.find(p => p.id === id);
    if (found) setProgram(structuredClone(found));
  };

  const setMeta = <K extends keyof TrainingProgram>(key: K, value: TrainingProgram[K]) =>
    setProgram(prev => ({ ...prev, [key]: value }));

  const setWeeks = (weeks: number) => {
    const n = Math.max(1, Math.min(52, weeks || 1));
    const lost = program.days.filter(d => d.dayNumber > n * 7).length;
    if (lost && !window.confirm(`Shortening to ${n} weeks removes ${lost} workout${lost === 1 ? '' : 's'} from later weeks. Continue?`)) return;
    setProgram(prev => ({ ...prev, durationWeeks: n, days: prev.days.filter(d => d.dayNumber <= n * 7) }));
  };

  const saveSlot = (draft: WorkoutDraft) => {
    if (!editing) return false;
    const day: WorkoutDay = {
      id: editing.dayId ?? newId('day'),
      dayNumber: editing.dayNumber,
      name: draft.title,
      description: draft.description,
      focus: '',
      estimatedDurationMin: draft.estimatedDurationMin ?? 60,
      exercises: draft.exercises,
      groups: draft.groups ?? [],
    };
    setProgram(prev => ({
      ...prev,
      days: editing.dayId ? prev.days.map(d => (d.id === editing.dayId ? day : d)) : [...prev.days, day],
    }));
    return true;
  };

  const removeSlot = (dayId: string) => setProgram(prev => ({ ...prev, days: prev.days.filter(d => d.id !== dayId) }));

  const addFromTemplate = (dayNumber: number, t: WorkoutTemplate) => {
    const content = cloneContent({ exercises: t.exercises, groups: t.groups ?? [] });
    setProgram(prev => ({
      ...prev,
      days: [...prev.days, {
        id: newId('day'), dayNumber, name: t.title, description: t.description, focus: '',
        estimatedDurationMin: t.estimatedDurationMin, ...content,
      }],
    }));
    setAddingTo(null);
  };

  const copyWeek = (week: number) => {
    if (week >= program.durationWeeks) return;
    const source = program.days.filter(d => Math.ceil(d.dayNumber / 7) === week);
    if (!source.length) return;
    const next = week + 1;
    const hasTarget = program.days.some(d => Math.ceil(d.dayNumber / 7) === next);
    if (hasTarget && !window.confirm(`Replace the workouts in week ${next}?`)) return;
    const copies = source.map(d => ({ ...cloneContent(d), id: newId('day'), dayNumber: d.dayNumber + 7 }));
    setProgram(prev => ({ ...prev, days: [...prev.days.filter(d => Math.ceil(d.dayNumber / 7) !== next), ...copies] }));
  };

  const clearWeek = (week: number) => {
    if (!window.confirm(`Remove every workout in week ${week}?`)) return;
    setProgram(prev => ({ ...prev, days: prev.days.filter(d => Math.ceil(d.dayNumber / 7) !== week) }));
  };

  const handleSave = async () => {
    if (!program.title.trim()) {
      showToast('Give the program a name first.');
      return;
    }
    setSaving(true);
    const result = await saveProgram({ ...program, title: program.title.trim(), daysPerWeek: daysPerWeek(program.days) });
    setSaving(false);
    if (result) setProgram(structuredClone(result));
  };

  const handleDelete = async () => {
    if (!isSaved) {
      setProgram(programs[0] ? structuredClone(programs[0]) : makeBlankProgram());
      return;
    }
    if (!window.confirm(`Delete "${program.title}"? Workouts already on clients' calendars are kept.`)) return;
    if (await deleteProgram(program.id)) {
      const next = programs.find(p => p.id !== program.id);
      setProgram(next ? structuredClone(next) : makeBlankProgram());
    }
  };

  const field = 'w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500';

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Program"
          value={isSaved ? program.id : ''}
          onChange={e => loadProgram(e.target.value)}
          className="h-10 px-3 rounded-xl bg-slate-900 border border-slate-800 text-sm font-semibold text-white max-w-full sm:max-w-xs"
        >
          {!isSaved && <option value="">Unsaved program</option>}
          {programs.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
        <button
          onClick={() => confirmDiscard() && setProgram(makeBlankProgram())}
          className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-semibold"
        >
          <Plus className="h-4 w-4" /> New
        </button>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => (isSaved && !dirty ? setAssignOpen(true) : showToast('Save the program before assigning it.'))}
            className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-semibold"
          >
            <CalendarPlus className="h-4 w-4" /> Assign
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-sm font-bold"
          >
            <Save className="h-4 w-4" /> {saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}
          </button>
        </div>
      </div>

      {/* Program details */}
      <section className="rounded-2xl bg-slate-900 border border-slate-800 p-4 sm:p-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="col-span-2 text-xs font-semibold text-slate-300">Program name
          <input value={program.title} onChange={e => setMeta('title', e.target.value)} className={`${field} mt-1`} />
        </label>
        <label className="text-xs font-semibold text-slate-300">Goal
          <select value={program.goal} onChange={e => setMeta('goal', e.target.value as FitnessGoal)} className={`${field} mt-1`}>
            {GOALS.map(g => <option key={g}>{g}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-300">Level
          <select value={program.difficulty} onChange={e => setMeta('difficulty', e.target.value as Difficulty)} className={`${field} mt-1`}>
            {DIFFICULTIES.map(d => <option key={d}>{d}</option>)}
          </select>
        </label>
        <label className="col-span-2 lg:col-span-3 text-xs font-semibold text-slate-300">Description
          <input value={program.description} onChange={e => setMeta('description', e.target.value)} placeholder="Who it's for and what it builds" className={`${field} mt-1`} />
        </label>
        <label className="col-span-2 lg:col-span-1 text-xs font-semibold text-slate-300">Length (weeks)
          <input type="number" min={1} max={52} value={program.durationWeeks} onChange={e => setWeeks(Number(e.target.value))} className={`${field} mt-1`} />
        </label>
      </section>

      {/* Clients on this program */}
      {onProgram.length > 0 && (
        <section className="rounded-2xl bg-slate-900 border border-slate-800 p-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-1">On this program</span>
          {onProgram.map(c => (
            <span key={c.id} className="inline-flex items-center gap-1.5 pl-3 pr-1 py-1 rounded-full bg-slate-800 text-xs font-semibold text-slate-100">
              {c.name}
              <button
                onClick={() => window.confirm(`Remove ${c.name}'s upcoming workouts from this program? Completed workouts are kept.`) && unassignProgram(program.id, c.id)}
                aria-label={`Remove ${c.name} from program`}
                title="Remove upcoming workouts"
                className="p-1 rounded-full hover:bg-slate-700"
              >
                <UserMinus className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </section>
      )}

      {/* Weekly calendar */}
      <div className="space-y-4">
        {Array.from({ length: program.durationWeeks }, (_, w) => w + 1).map(week => (
          <section key={week} className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
            <header className="px-4 py-2.5 flex items-center gap-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Week {week}</h3>
              <div className="ml-auto flex gap-1">
                {week < program.durationWeeks && (
                  <button onClick={() => copyWeek(week)} aria-label={`Copy week ${week} to week ${week + 1}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-slate-100 hover:bg-slate-800">
                    <Copy className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Copy to week {week + 1}</span>
                  </button>
                )}
                <button onClick={() => clearWeek(week)} aria-label={`Clear week ${week}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-slate-100 hover:bg-slate-800">
                  <Eraser className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Clear</span>
                </button>
              </div>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-7 divide-y md:divide-y-0 md:divide-x divide-slate-800">
              {WEEKDAYS.map((weekday, d) => {
                const dayNumber = (week - 1) * 7 + d + 1;
                const workouts = byDay.get(dayNumber) ?? [];
                return (
                  <div key={weekday} className="p-2 md:min-h-32 flex md:flex-col gap-2 items-start">
                    <span className="w-10 md:w-auto shrink-0 text-[11px] font-bold uppercase text-slate-400 pt-1.5 md:pt-0">{weekday}</span>
                    <div className="flex-1 w-full space-y-1.5 min-w-0">
                      {workouts.map(day => (
                        <button
                          key={day.id}
                          onClick={() => setEditing({ dayNumber, dayId: day.id, draft: { title: day.name, description: day.description, estimatedDurationMin: day.estimatedDurationMin, exercises: day.exercises, groups: day.groups ?? [] } })}
                          className="w-full text-left px-2 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 hover:border-emerald-500"
                        >
                          <span className="block text-xs font-bold text-white truncate">{day.name}</span>
                          <span className="block text-[10px] text-slate-400">{day.exercises.length} exercises</span>
                        </button>
                      ))}
                      <button
                        onClick={() => setAddingTo(dayNumber)}
                        aria-label={`Add workout to week ${week} ${weekday}`}
                        className="w-full py-1 rounded-lg border border-dashed border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 text-xs"
                      >
                        <Plus className="inline h-3.5 w-3.5" />
                        <span className="md:hidden ml-1">{workouts.length ? 'Add another' : 'Add workout (rest day)'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <button onClick={handleDelete} className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-400 hover:underline">
        <Trash2 className="h-3.5 w-3.5" /> {isSaved ? 'Delete program' : 'Discard new program'}
      </button>

      {addingTo !== null && (
        <AddWorkoutMenu
          dayLabel={`Week ${Math.ceil(addingTo / 7)}, ${WEEKDAYS[(addingTo - 1) % 7]}`}
          templates={workoutTemplates}
          onBlank={() => {
            setEditing({ dayNumber: addingTo, draft: { title: '', estimatedDurationMin: 60, exercises: [], groups: [] } });
            setAddingTo(null);
          }}
          onTemplate={t => addFromTemplate(addingTo, t)}
          onClose={() => setAddingTo(null)}
        />
      )}

      {editing && (
        <WorkoutEditorSheet
          heading={`Week ${Math.ceil(editing.dayNumber / 7)}, ${WEEKDAYS[(editing.dayNumber - 1) % 7]}`}
          initial={editing.draft}
          saveLabel="Done"
          onSave={saveSlot}
          onClose={() => setEditing(null)}
          footerStart={
            editing.dayId ? (
              <button
                onClick={() => {
                  removeSlot(editing.dayId!);
                  setEditing(null);
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-red-400 hover:underline"
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove from day
              </button>
            ) : undefined
          }
        />
      )}

      {assignOpen && <AssignProgramDialog program={program} onClose={() => setAssignOpen(false)} />}
    </div>
  );
};

const AddWorkoutMenu: React.FC<{
  dayLabel: string;
  templates: WorkoutTemplate[];
  onBlank: () => void;
  onTemplate: (t: WorkoutTemplate) => void;
  onClose: () => void;
}> = ({ dayLabel, templates, onBlank, onTemplate, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 sm:p-4" onClick={onClose}>
    <div role="dialog" aria-modal="true" aria-label={`Add workout to ${dayLabel}`} onClick={e => e.stopPropagation()} className="w-full max-w-md max-h-[80vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-slate-900 border border-slate-800">
      <div className="p-4 border-b border-slate-800">
        <h3 className="text-sm font-bold text-white">Add workout · {dayLabel}</h3>
      </div>
      <div className="p-3 space-y-1 overflow-y-auto">
        <button onClick={onBlank} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800 text-left">
          <Dumbbell className="h-5 w-5 text-emerald-400" />
          <span className="text-sm font-semibold text-white">Build a new workout</span>
        </button>
        <p className="px-3 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">From your library</p>
        {templates.length === 0 && <p className="px-3 pb-3 text-xs text-slate-400">No saved workouts yet. Create them in the Workout Library.</p>}
        {templates.map(t => (
          <button key={t.id} onClick={() => onTemplate(t)} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800 text-left">
            <BookOpen className="h-5 w-5 text-slate-400" />
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold text-white truncate">{t.title}</span>
              <span className="block text-xs text-slate-400">{t.exercises.length} exercises · {t.estimatedDurationMin} min</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  </div>
);

const AssignProgramDialog: React.FC<{ program: TrainingProgram; onClose: () => void }> = ({ program, onClose }) => {
  const { clients, assignProgramToClient } = useApp();
  const [clientId, setClientId] = useState(clients[0]?.id ?? '');
  const [startDate, setStartDate] = useState(() => localDateStr(nextMonday()));
  const [saving, setSaving] = useState(false);
  const startWeekday = new Date(`${startDate}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long' });
  const startsOnMonday = new Date(`${startDate}T00:00:00`).getDay() === 1;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const ok = await assignProgramToClient(program.id, clientId, startDate);
    setSaving(false);
    if (ok) onClose();
  };

  const field = 'w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <form role="dialog" aria-modal="true" aria-label="Assign program" onSubmit={submit} onClick={e => e.stopPropagation()} className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 p-5 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-white">Assign “{program.title}”</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {program.days.length} workouts over {program.durationWeeks} weeks are copied onto the client's calendar. Week 1 Monday lands on the start date.
          </p>
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
            <label className="block text-xs font-semibold text-slate-300">Start date
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required className={`${field} mt-1`} />
            </label>
            {!startsOnMonday && (
              <p className="text-xs text-amber-400">
                The program's Monday workouts will fall on {startWeekday}s, and every other day shifts the same way.
              </p>
            )}
          </>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-100 text-sm font-semibold">Cancel</button>
          <button type="submit" disabled={saving || !clientId || program.days.length === 0} className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-sm font-bold">
            {saving ? 'Assigning…' : 'Assign program'}
          </button>
        </div>
      </form>
    </div>
  );
};

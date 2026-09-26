import React, { useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, ChevronLeft, ChevronRight, Dumbbell, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ScheduledWorkout, WorkoutTemplate } from '../../types';
import { formatDay, localDateStr } from '../../utils/dates';
import { cloneContent } from '../../utils/workout';
import { ClientAvatar } from '../common/ClientAvatar';
import { WorkoutEditorSheet } from '../training/WorkoutEditorSheet';
import { WorkoutDraft } from '../training/WorkoutEditor';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Dates shown in a Monday-first month grid, including padding days from adjacent months. */
function monthGrid(year: number, month: number): string[] {
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(1 - ((first.getDay() + 6) % 7));
  const days: string[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(localDateStr(d));
  }
  // Drop a trailing week that belongs entirely to the next month.
  return days[35].startsWith(`${year}-${String(month + 1).padStart(2, '0')}`) ? days : days.slice(0, 35);
}

type Editing =
  | { mode: 'new'; clientId: string; date: string; draft: WorkoutDraft; source?: WorkoutTemplate }
  | { mode: 'edit'; workout: ScheduledWorkout; draft: WorkoutDraft };

export const CalendarScheduler: React.FC = () => {
  const { clients, scheduledWorkouts, workoutTemplates, scheduleWorkout, updateWorkoutLog, deleteWorkout, openWorkoutLogger } = useApp();
  const today = localDateStr();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState(today);
  const [clientFilter, setClientFilter] = useState('All');
  const [scheduling, setScheduling] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);

  const workouts = useMemo(
    () => scheduledWorkouts.filter(w => clientFilter === 'All' || w.clientId === clientFilter),
    [scheduledWorkouts, clientFilter]
  );
  const byDate = useMemo(() => {
    const map = new Map<string, ScheduledWorkout[]>();
    workouts.forEach(w => map.set(w.date, [...(map.get(w.date) ?? []), w]));
    return map;
  }, [workouts]);

  const days = monthGrid(cursor.year, cursor.month);
  const monthPrefix = `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}`;
  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const selectedWorkouts = byDate.get(selectedDate) ?? [];

  const shiftMonth = (delta: number) =>
    setCursor(c => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  const goToday = () => {
    const d = new Date();
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
    setSelectedDate(today);
  };

  const saveEditing = async (draft: WorkoutDraft) => {
    if (!editing) return false;
    if (editing.mode === 'edit') {
      return updateWorkoutLog(editing.workout.id, {
        workoutTitle: draft.title,
        description: draft.description ?? '',
        exercises: draft.exercises,
        groups: draft.groups ?? [],
      });
    }
    const client = clients.find(c => c.id === editing.clientId);
    if (!client) return false;
    return scheduleWorkout({
      clientId: client.id,
      clientName: client.name,
      clientAvatar: client.avatar,
      workoutDayId: editing.source?.id ?? '',
      workoutTitle: draft.title,
      description: draft.description ?? '',
      date: editing.date,
      status: 'Scheduled',
      exercises: draft.exercises,
      groups: draft.groups ?? [],
    });
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <button onClick={() => shiftMonth(-1)} aria-label="Previous month" className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 hover:bg-slate-800">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h2 className="w-40 text-center text-sm sm:text-base font-extrabold text-white">{monthLabel}</h2>
          <button onClick={() => shiftMonth(1)} aria-label="Next month" className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 hover:bg-slate-800">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <button onClick={goToday} className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-100">Today</button>
        <select
          aria-label="Filter by client"
          value={clientFilter}
          onChange={e => setClientFilter(e.target.value)}
          className="h-9 px-3 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white"
        >
          <option value="All">All clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button
          onClick={() => setScheduling(true)}
          disabled={clients.length === 0}
          className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-sm font-bold"
        >
          <Plus className="h-4 w-4" /> Schedule workout
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-5 xl:items-start">
        {/* Month grid */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
          <div className="grid grid-cols-7 border-b border-slate-800">
            {WEEKDAYS.map(d => <div key={d} className="py-2 text-center text-[10px] sm:text-xs font-bold uppercase text-slate-400">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {days.map(date => {
              const inMonth = date.startsWith(monthPrefix);
              const dayWorkouts = byDate.get(date) ?? [];
              const done = dayWorkouts.filter(w => w.status === 'Completed').length;
              const isSelected = date === selectedDate;
              return (
                <button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  aria-label={`${formatDay(date)}, ${dayWorkouts.length} workouts`}
                  aria-pressed={isSelected}
                  className={`min-h-14 sm:min-h-24 p-1 sm:p-1.5 border-b border-r border-slate-800 text-left align-top flex flex-col gap-1 ${
                    isSelected ? 'bg-emerald-500/10' : 'hover:bg-slate-800/40'
                  } ${inMonth ? '' : 'opacity-40'}`}
                >
                  <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${date === today ? 'bg-emerald-500 text-slate-950' : 'text-slate-300'}`}>
                    {Number(date.slice(8))}
                  </span>
                  {/* Phones: dots. Larger screens: titles. */}
                  <span className="flex flex-wrap gap-0.5 sm:hidden">
                    {dayWorkouts.slice(0, 4).map(w => (
                      <span key={w.id} className={`h-1.5 w-1.5 rounded-full ${w.status === 'Completed' ? 'bg-emerald-400' : 'bg-slate-400'}`} />
                    ))}
                  </span>
                  <span className="hidden sm:flex flex-col gap-0.5 w-full min-w-0">
                    {dayWorkouts.slice(0, 3).map(w => (
                      <span key={w.id} className={`truncate text-[10px] px-1 py-0.5 rounded ${w.status === 'Completed' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-800 text-slate-100'}`}>
                        {clientFilter === 'All' ? `${w.clientName.split(' ')[0]}: ` : ''}{w.workoutTitle}
                      </span>
                    ))}
                    {dayWorkouts.length > 3 && <span className="text-[10px] text-slate-400">+{dayWorkouts.length - 3} more</span>}
                  </span>
                  {done > 0 && done === dayWorkouts.length && <span className="sr-only">All completed</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected day */}
        <section className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-white">{selectedDate === today ? 'Today' : formatDay(selectedDate)}</h3>
            <button
              onClick={() => setScheduling(true)}
              disabled={clients.length === 0}
              aria-label="Schedule a workout on this day"
              className="p-1.5 rounded-lg bg-slate-800 text-slate-100 hover:bg-slate-700 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          {selectedWorkouts.length === 0 && <p className="text-sm text-slate-400">Nothing scheduled.</p>}
          <ul className="space-y-2">
            {selectedWorkouts.map(w => (
              <li key={w.id} className="rounded-xl border border-slate-800 p-3 space-y-2">
                <div className="flex items-center gap-2.5">
                  <ClientAvatar client={{ name: w.clientName, avatar: w.clientAvatar }} className="h-8 w-8 rounded-lg" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{w.workoutTitle}</p>
                    <p className="text-xs text-slate-400 truncate">{w.clientName} · {w.exercises.length} exercises</p>
                  </div>
                  {w.status === 'Completed' && <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" aria-label="Completed" />}
                </div>
                <div className="flex gap-1">
                  <DayAction label={w.status === 'Completed' ? 'Review' : 'Log'} onClick={() => openWorkoutLogger(w)}><Play className="h-3.5 w-3.5" /></DayAction>
                  {w.status !== 'Completed' && (
                    <DayAction
                      label="Edit"
                      onClick={() => setEditing({
                        mode: 'edit',
                        workout: w,
                        draft: { title: w.workoutTitle, description: w.description ?? '', exercises: w.exercises, groups: w.groups ?? [] },
                      })}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </DayAction>
                  )}
                  <DayAction label="Remove" onClick={() => window.confirm(`Remove "${w.workoutTitle}" from ${w.clientName}'s calendar?`) && deleteWorkout(w.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </DayAction>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {scheduling && (
        <ScheduleDialog
          date={selectedDate}
          defaultClientId={clientFilter !== 'All' ? clientFilter : clients[0]?.id ?? ''}
          templates={workoutTemplates}
          onClose={() => setScheduling(false)}
          onContinue={(clientId, date, template) => {
            setScheduling(false);
            const content = template ? cloneContent({ exercises: template.exercises, groups: template.groups ?? [] }) : { exercises: [], groups: [] };
            setEditing({
              mode: 'new',
              clientId,
              date,
              source: template,
              draft: { title: template?.title ?? '', description: template?.description ?? '', estimatedDurationMin: template?.estimatedDurationMin ?? 60, ...content },
            });
          }}
        />
      )}

      {editing && (
        <WorkoutEditorSheet
          heading={editing.mode === 'edit'
            ? `Edit ${editing.workout.clientName}'s workout · ${formatDay(editing.workout.date)}`
            : `New workout for ${clients.find(c => c.id === editing.clientId)?.name ?? 'client'} · ${formatDay(editing.date)}`}
          initial={editing.draft}
          saveLabel={editing.mode === 'edit' ? 'Save changes' : 'Schedule'}
          onSave={saveEditing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
};

const DayAction: React.FC<{ label: string; onClick: () => void; children: React.ReactNode }> = ({ label, onClick, children }) => (
  <button onClick={onClick} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-100">
    {children} {label}
  </button>
);

const ScheduleDialog: React.FC<{
  date: string;
  defaultClientId: string;
  templates: WorkoutTemplate[];
  onClose: () => void;
  onContinue: (clientId: string, date: string, template?: WorkoutTemplate) => void;
}> = ({ date: initialDate, defaultClientId, templates, onClose, onContinue }) => {
  const { clients } = useApp();
  const [clientId, setClientId] = useState(defaultClientId);
  const [date, setDate] = useState(initialDate);
  const field = 'w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Schedule workout" onClick={e => e.stopPropagation()} className="w-full max-w-md max-h-[85vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-slate-900 border border-slate-800">
        <div className="p-4 border-b border-slate-800 grid grid-cols-2 gap-3">
          <label className="text-xs font-semibold text-slate-300">Client
            <select value={clientId} onChange={e => setClientId(e.target.value)} className={`${field} mt-1`}>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-300">Date
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={`${field} mt-1`} />
          </label>
        </div>
        <div className="p-3 space-y-1 overflow-y-auto">
          <button onClick={() => onContinue(clientId, date)} disabled={!clientId || !date} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800 text-left disabled:opacity-50">
            <Dumbbell className="h-5 w-5 text-emerald-400" />
            <span className="text-sm font-semibold text-white">Build a new workout</span>
          </button>
          <p className="px-3 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">From your library</p>
          {templates.length === 0 && <p className="px-3 pb-3 text-xs text-slate-400">No saved workouts yet.</p>}
          {templates.map(t => (
            <button key={t.id} onClick={() => onContinue(clientId, date, t)} disabled={!clientId || !date} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800 text-left disabled:opacity-50">
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
};

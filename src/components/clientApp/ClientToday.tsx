import React from 'react';
import { CheckCircle2, Circle, Dumbbell, MessageSquare, Play } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Client } from '../../types';
import { localDateStr, formatDay } from '../../utils/dates';

// Mirrors DEFAULT_HABITS in backend/app/routers/habits.py; the server creates the day's log on first toggle.
const DEFAULT_HABITS = [
  { habitId: 'h-1', title: 'Hit 180g+ Protein', completed: false },
  { habitId: 'h-2', title: 'Drink 3.5L Water', completed: false },
  { habitId: 'h-3', title: '10,000 Steps', completed: false },
  { habitId: 'h-4', title: '8 Hours Sleep', completed: false },
  { habitId: 'h-5', title: 'Post-Workout Mobility', completed: false },
];

export const ClientToday: React.FC<{ client: Client; onOpenWorkouts: () => void; onOpenChat: () => void }> = ({
  client,
  onOpenWorkouts,
  onOpenChat,
}) => {
  const { scheduledWorkouts, habitLogs, toggleHabitCompletion, openWorkoutLogger, messages } = useApp();
  const today = localDateStr();

  const upcoming = scheduledWorkouts
    .filter(w => w.status !== 'Completed' && w.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const next = upcoming[0];

  const weekAgo = localDateStr(new Date(Date.now() - 6 * 86400000));
  const doneThisWeek = scheduledWorkouts.filter(w => w.status === 'Completed' && w.date >= weekAgo && w.date <= today).length;

  const todayLog = habitLogs.find(l => l.date === today);
  const lastCoachMessage = [...messages].reverse().find(m => m.sender === 'coach');

  const card = 'rounded-2xl bg-slate-900 border border-slate-800 p-4 md:p-5';
  const heading = 'text-xs font-bold uppercase tracking-wider text-slate-400 mb-3';

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-slate-400">{formatDay(today)}</p>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white">Hi {client.name.split(' ')[0]} 👋</h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Workouts this week" value={String(doneThisWeek)} />
        <Stat label="Compliance" value={`${Math.round(client.complianceRate)}%`} />
        <Stat label="Current weight" value={`${client.currentWeightKg} kg`} />
        <Stat label="Workouts completed" value={String(client.workoutsCompleted)} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:items-start">
        <div className="space-y-5 min-w-0 lg:col-span-2">
          <section className={card}>
            <h2 className={heading}>Next workout</h2>
            {next ? (
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                  <Dumbbell className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white truncate">{next.workoutTitle}</p>
                  <p className="text-xs text-slate-400">
                    {next.date === today ? 'Today' : formatDay(next.date)} · {next.exercises.length} exercises
                  </p>
                </div>
                <button
                  onClick={() => openWorkoutLogger(next)}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-bold"
                >
                  <Play className="h-4 w-4 fill-current" /> Start
                </button>
              </div>
            ) : (
              <p className="text-sm text-slate-400">
                Nothing scheduled. <button onClick={onOpenWorkouts} className="text-emerald-400 font-semibold">See past workouts</button>
              </p>
            )}
          </section>

          {upcoming.length > 1 && (
            <section className={`hidden md:block ${card}`}>
              <h2 className={heading}>Coming up</h2>
              <ul className="divide-y divide-slate-800">
                {upcoming.slice(1, 5).map(w => (
                  <li key={w.id}>
                    <button onClick={() => openWorkoutLogger(w)} className="w-full py-2.5 flex items-center gap-3 text-left">
                      <Dumbbell className="h-4 w-4 text-slate-400 shrink-0" />
                      <span className="flex-1 text-sm text-white truncate">{w.workoutTitle}</span>
                      <span className="text-xs text-slate-400 shrink-0">{formatDay(w.date)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {lastCoachMessage && (
            <button onClick={onOpenChat} className={`w-full text-left flex gap-3 ${card}`}>
              <MessageSquare className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-400">From your coach</p>
                <p className="text-sm text-white line-clamp-2">{lastCoachMessage.text}</p>
              </div>
            </button>
          )}
        </div>

        <section className={`min-w-0 ${card}`}>
          <h2 className={heading}>Today's habits</h2>
          <ul className="space-y-1">
            {(todayLog?.habits ?? DEFAULT_HABITS).map(h => (
              <li key={h.habitId}>
                <button
                  onClick={() => toggleHabitCompletion(client.id, today, h.habitId)}
                  className="w-full flex items-center gap-3 py-2 text-left"
                >
                  {h.completed ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <Circle className="h-5 w-5 text-slate-500" />}
                  <span className={`text-sm ${h.completed ? 'text-slate-400 line-through' : 'text-white'}`}>{h.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-2xl bg-slate-900 border border-slate-800 p-3.5">
    <p className="text-2xl font-extrabold text-white">{value}</p>
    <p className="text-[11px] text-slate-400">{label}</p>
  </div>
);

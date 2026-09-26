import React from 'react';
import { CheckCircle2, ChevronRight, Dumbbell, Star } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ScheduledWorkout } from '../../types';
import { formatDay, localDateStr } from '../../utils/dates';

export const ClientWorkouts: React.FC = () => {
  const { scheduledWorkouts, openWorkoutLogger } = useApp();
  const today = localDateStr();

  const upcoming = scheduledWorkouts
    .filter(w => w.status !== 'Completed')
    .sort((a, b) => a.date.localeCompare(b.date));
  const history = scheduledWorkouts
    .filter(w => w.status === 'Completed')
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:items-start [&>*]:min-w-0">
      <Section title="Upcoming">
        {upcoming.length === 0 && <Empty text="No workouts scheduled yet. Your coach will add them." />}
        {upcoming.map(w => (
          <WorkoutRow
            key={w.id}
            workout={w}
            badge={w.date < today ? 'Missed' : w.date === today ? 'Today' : undefined}
            onClick={() => openWorkoutLogger(w)}
          />
        ))}
      </Section>
      <Section title="Completed">
        {history.length === 0 && <Empty text="Completed workouts will show up here." />}
        {history.map(w => (
          <WorkoutRow key={w.id} workout={w} onClick={() => openWorkoutLogger(w)} />
        ))}
      </Section>
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section>
    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">{title}</h2>
    <div className="rounded-2xl bg-slate-900 border border-slate-800 divide-y divide-slate-800">{children}</div>
  </section>
);

const Empty: React.FC<{ text: string }> = ({ text }) => <p className="p-4 text-sm text-slate-400">{text}</p>;

const WorkoutRow: React.FC<{ workout: ScheduledWorkout; badge?: string; onClick: () => void }> = ({ workout, badge, onClick }) => {
  const done = workout.status === 'Completed';
  return (
    <button onClick={onClick} className="w-full p-3.5 flex items-center gap-3 text-left">
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${done ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-800 text-slate-100'}`}>
        {done ? <CheckCircle2 className="h-5 w-5" /> : <Dumbbell className="h-5 w-5" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white truncate">{workout.workoutTitle}</p>
        <p className="text-xs text-slate-400 flex items-center gap-2">
          {formatDay(workout.date)}
          {done && workout.durationMin ? <span>· {workout.durationMin} min</span> : null}
          {done && workout.rating ? (
            <span className="inline-flex items-center gap-0.5">· <Star className="h-3 w-3 text-amber-400 fill-current" />{workout.rating}</span>
          ) : null}
        </p>
      </div>
      {badge && (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge === 'Missed' ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
          {badge}
        </span>
      )}
      <ChevronRight className="h-4 w-4 text-slate-500 shrink-0" />
    </button>
  );
};

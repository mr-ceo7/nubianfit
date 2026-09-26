import React from 'react';
import { CheckCircle2, Circle, Flame } from 'lucide-react';
import { useNutrition } from '../../context/NutritionContext';
import { habitAppliesOn, habitStreak } from '../../utils/nutrition';

/** The client's habits scheduled on `date`, with check-off and streaks. */
export const HabitChecklist: React.FC<{ clientId: string; date: string; today: string }> = ({ clientId, date, today }) => {
  const { habits, checkins, checkIn } = useNutrition();
  const due = habits.filter(h => h.clientId === clientId && habitAppliesOn(h, date)).sort((a, b) => a.sortOrder - b.sortOrder);
  const isDone = (habitId: string) => checkins.some(c => c.habitId === habitId && c.date === date && c.completed);
  const future = date > today;

  if (due.length === 0) {
    return <p className="text-sm text-slate-400">No habits scheduled{date === today ? ' today' : ''}.</p>;
  }
  return (
    <ul className="space-y-1">
      {due.map(h => {
        const done = isDone(h.id);
        const streak = habitStreak(h, checkins, today);
        return (
          <li key={h.id}>
            <button
              onClick={() => checkIn(h.id, date, !done)}
              disabled={future}
              aria-pressed={done}
              className="w-full flex items-center gap-3 py-2 text-left disabled:opacity-50"
            >
              {done ? <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" /> : <Circle className="h-5 w-5 text-slate-500 shrink-0" />}
              <span className="flex-1 min-w-0">
                <span className={`block text-sm ${done ? 'text-slate-400 line-through' : 'text-white'}`}>{h.title}</span>
                {h.targetValue ? <span className="block text-[11px] text-slate-400">Target: {h.targetValue} {h.unit}</span> : null}
              </span>
              {streak > 1 && (
                <span className="inline-flex items-center gap-0.5 text-xs font-bold text-amber-400" aria-label={`${streak} day streak`}>
                  <Flame className="h-3.5 w-3.5" />{streak}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
};

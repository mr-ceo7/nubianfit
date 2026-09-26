import React, { useEffect, useState } from 'react';
import { CheckCircle2, Circle, History, Link2, Pause, Play, PlayCircle, RotateCcw, Star, Timer, X } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { ExerciseGroup, PersonalRecord, ScheduledWorkout, WorkoutExerciseItem, WorkoutSet } from '../../types';
import {
  buildSections, describeTarget, formatDuration, groupLabel, lastPerformance, parseDuration, TRACKING, trackingOf,
} from '../../utils/workout';
import { formatDay } from '../../utils/dates';
import { ClientAvatar } from '../common/ClientAvatar';
import { VideoEmbed } from '../training/VideoEmbed';

/** Epley estimated one-rep max. */
const estimate1Rm = (weightKg: number, reps: number) => Math.round(weightKg * (1 + reps / 30));

/** Sets in this session that beat the client's previous best estimated 1RM for that exercise (weighted lifts only). */
export function findNewRecords(
  workout: ScheduledWorkout,
  exercises: WorkoutExerciseItem[],
  history: PersonalRecord[]
): Omit<PersonalRecord, 'id'>[] {
  const records: Omit<PersonalRecord, 'id'>[] = [];
  for (const ex of exercises) {
    if (trackingOf(ex) !== 'reps_weight') continue;
    const previous = history
      .filter(pr => pr.clientId === workout.clientId && pr.exerciseName === ex.exerciseName)
      .sort((a, b) => b.estimated1RmKg - a.estimated1RmKg)[0];
    let best: Omit<PersonalRecord, 'id'> | null = null;
    for (const s of ex.sets) {
      if (!s.isCompleted || !s.completedWeightKg || !s.completedReps) continue;
      const e1rm = estimate1Rm(s.completedWeightKg, s.completedReps);
      if (e1rm > (best?.estimated1RmKg ?? previous?.estimated1RmKg ?? 0)) {
        best = {
          clientId: workout.clientId,
          exerciseName: ex.exerciseName,
          weightKg: s.completedWeightKg,
          reps: s.completedReps,
          estimated1RmKg: e1rm,
          date: workout.date,
          previousWeightKg: previous?.weightKg,
        };
      }
    }
    if (best) records.push(best);
  }
  return records;
}

/** Countdown display: always m:ss. */
const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.max(0, sec) % 60).padStart(2, '0')}`;

const celebrate = () => {
  const duration = 2500;
  const end = Date.now() + duration;
  const defaults = { startVelocity: 25, spread: 360, ticks: 50, zIndex: 100 };
  const interval = setInterval(() => {
    const left = end - Date.now();
    if (left <= 0) return clearInterval(interval);
    const particleCount = 40 * (left / duration);
    confetti({ ...defaults, particleCount, origin: { x: 0.1 + Math.random() * 0.2, y: Math.random() - 0.2 }, colors: ['#22d3ee', '#10b981', '#06b6d4'] });
    confetti({ ...defaults, particleCount, origin: { x: 0.7 + Math.random() * 0.2, y: Math.random() - 0.2 }, colors: ['#22d3ee', '#10b981', '#06b6d4'] });
  }, 250);
};

export const WorkoutLoggerModal: React.FC = () => {
  const { isWorkoutLoggerOpen, activeWorkoutToLog } = useApp();
  if (!isWorkoutLoggerOpen || !activeWorkoutToLog) return null;
  return <WorkoutLoggerSheet key={activeWorkoutToLog.id} workout={activeWorkoutToLog} />;
};

const cellInput =
  'w-full min-w-12 h-8 px-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white text-center focus:outline-none focus:border-emerald-500';

const WorkoutLoggerSheet: React.FC<{ workout: ScheduledWorkout }> = ({ workout }) => {
  const { closeWorkoutLogger, completeWorkout, updateWorkoutLog, addPersonalRecord, personalRecords, scheduledWorkouts } = useApp();
  const { user } = useAuth();
  const isCoach = user?.role === 'coach';
  const alreadyCompleted = workout.status === 'Completed';

  // Local deep copies so edits never touch the shared workout object.
  const [exercises, setExercises] = useState<WorkoutExerciseItem[]>(() => structuredClone(workout.exercises || []));
  const [groups, setGroups] = useState<ExerciseGroup[]>(() => structuredClone(workout.groups || []));
  const [clientFeedback, setClientFeedback] = useState(workout.clientFeedback || '');
  const [coachFeedback, setCoachFeedback] = useState(workout.coachFeedback || '');
  const [rating, setRating] = useState(workout.rating || 5);
  const [durationMin, setDurationMin] = useState(workout.durationMin || 60);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openVideo, setOpenVideo] = useState<string | null>(null);

  // Rest / block timer
  const [timerLeft, setTimerLeft] = useState<number | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  useEffect(() => {
    if (!timerRunning || timerLeft === null) return;
    if (timerLeft <= 0) {
      setTimerRunning(false);
      if ('vibrate' in navigator) navigator.vibrate?.([200, 100, 200]);
      return;
    }
    const t = setTimeout(() => setTimerLeft(s => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(t);
  }, [timerRunning, timerLeft]);
  const startTimer = (seconds: number) => {
    setTimerLeft(seconds);
    setTimerRunning(true);
  };

  const updateSet = (exIdx: number, setIdx: number, changes: Partial<WorkoutSet>) =>
    setExercises(prev => prev.map((ex, i) => i !== exIdx ? ex : {
      ...ex,
      sets: ex.sets.map((s, j) => (j === setIdx ? { ...s, ...changes } : s)),
    }));

  const toggleSet = (exIdx: number, setIdx: number) => {
    const ex = exercises[exIdx];
    const s = ex.sets[setIdx];
    if (s.isCompleted) {
      updateSet(exIdx, setIdx, { isCompleted: false });
      return;
    }
    // Prefill with the prescription when the athlete didn't type actual numbers.
    const fields = TRACKING[trackingOf(ex)].fields;
    updateSet(exIdx, setIdx, {
      isCompleted: true,
      completedReps: fields.includes('reps') ? s.completedReps ?? (parseInt(s.targetReps, 10) || undefined) : undefined,
      completedWeightKg: fields.includes('weight') ? s.completedWeightKg ?? s.targetWeightKg : undefined,
      completedDurationSec: fields.includes('time') ? s.completedDurationSec ?? s.targetDurationSec : undefined,
      completedDistanceM: fields.includes('distance') ? s.completedDistanceM ?? s.targetDistanceM : undefined,
      completedRpe: s.completedRpe ?? s.targetRpe,
    });
    // In a superset/circuit, rest only after the last exercise of the round.
    const lastInBlock = !ex.groupId || exercises[exIdx + 1]?.groupId !== ex.groupId;
    if (lastInBlock && s.restSeconds) startTimer(s.restSeconds);
  };

  const totalVolume = exercises.reduce((acc, ex) =>
    acc + ex.sets.reduce((sum, s) => (s.isCompleted && s.completedWeightKg && s.completedReps ? sum + s.completedWeightKg * s.completedReps : sum), 0), 0);
  const completedSets = exercises.reduce((acc, ex) => acc + ex.sets.filter(s => s.isCompleted).length, 0);
  const totalSets = exercises.reduce((acc, ex) => acc + ex.sets.length, 0);

  const saveProgress = async () => {
    setIsSubmitting(true);
    const ok = await updateWorkoutLog(workout.id, { exercises, groups, status: 'In-Progress' });
    setIsSubmitting(false);
    if (ok) closeWorkoutLogger();
  };

  const finish = async () => {
    setIsSubmitting(true);
    try {
      const newRecords = findNewRecords(workout, exercises, personalRecords);
      const saved = await completeWorkout(workout.id, {
        exercises,
        groups,
        durationMin,
        totalVolumeKg: totalVolume,
        prCount: newRecords.length,
        clientFeedback,
        coachFeedback: isCoach ? coachFeedback : undefined,
        rating,
      });
      if (!saved) return;
      for (const record of newRecords) await addPersonalRecord(record);
      if (!alreadyCompleted) celebrate();
      closeWorkoutLogger();
    } finally {
      setIsSubmitting(false);
    }
  };

  const sections = buildSections({ exercises, groups });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 sm:p-6">
      <div role="dialog" aria-modal="true" aria-label={`Log ${workout.workoutTitle}`} className="w-full max-w-4xl h-[94dvh] sm:h-[92vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden">
        {/* Header */}
        <header className="p-4 sm:p-5 border-b border-slate-800 flex items-center gap-3">
          <ClientAvatar client={{ name: workout.clientName, avatar: workout.clientAvatar }} className="h-11 w-11 rounded-xl hidden sm:flex" />
          <div className="flex-1 min-w-0">
            <h2 className="text-base sm:text-lg font-extrabold text-white truncate">{workout.workoutTitle}</h2>
            <p className="text-xs text-slate-400 truncate">
              {isCoach && <>{workout.clientName} · </>}{formatDay(workout.date)}{workout.programName ? ` · ${workout.programName}` : ''}
            </p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${alreadyCompleted ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-800 text-slate-100'}`}>
            {workout.status}
          </span>
          <button onClick={closeWorkoutLogger} aria-label="Close" className="p-2 rounded-full bg-slate-800 text-slate-100 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Progress + timer */}
        <div className="px-4 sm:px-5 py-3 border-b border-slate-800 flex flex-wrap items-center gap-x-6 gap-y-2">
          <Stat label="Sets" value={`${completedSets} / ${totalSets}`} />
          {totalVolume > 0 && <Stat label="Volume" value={`${Math.round(totalVolume).toLocaleString()} kg`} />}
          <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800">
            <Timer className="h-4 w-4 text-emerald-400" />
            <span aria-live="polite" className={`font-mono font-bold text-sm w-12 ${timerLeft !== null && timerLeft <= 10 && timerRunning ? 'text-amber-400' : 'text-white'}`}>
              {clock(timerLeft ?? 0)}
            </span>
            {timerLeft !== null && (
              <>
                <button onClick={() => setTimerRunning(r => !r)} aria-label={timerRunning ? 'Pause timer' : 'Resume timer'} className="p-1 text-slate-100">
                  {timerRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                </button>
                <button onClick={() => { setTimerLeft(null); setTimerRunning(false); }} aria-label="Reset timer" className="p-1 text-slate-100">
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </>
            )}
            {[60, 90, 120].map(s => (
              <button key={s} onClick={() => startTimer(s)} className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-slate-100">{s}s</button>
            ))}
          </div>
        </div>

        {/* Workout */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6">
          {workout.description && (
            <p className="text-sm text-slate-300 whitespace-pre-wrap rounded-xl bg-slate-950 border border-slate-800 p-3">{workout.description}</p>
          )}
          {exercises.length === 0 && <p className="text-sm text-slate-400 text-center py-8">This workout has no exercises yet.</p>}

          {sections.map(section => (
            <section key={section.section} className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">{section.label}</h3>
              {section.blocks.map(block => {
                const cards = block.items.map(({ exercise, index }) => (
                  <ExerciseLog
                    key={exercise.id}
                    exercise={exercise}
                    inGroup={!!block.group}
                    history={lastPerformance(scheduledWorkouts, workout, exercise.exerciseName)}
                    videoOpen={openVideo === exercise.id}
                    onToggleVideo={() => setOpenVideo(openVideo === exercise.id ? null : exercise.id)}
                    onToggleSet={s => toggleSet(index, s)}
                    onUpdateSet={(s, changes) => updateSet(index, s, changes)}
                  />
                ));
                if (!block.group) return <React.Fragment key={block.items[0].exercise.id}>{cards}</React.Fragment>;
                const group = block.group;
                const timed = group.kind === 'amrap' || group.kind === 'emom';
                return (
                  <div key={group.id} className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/5 p-2.5 space-y-2">
                    <div className="flex flex-wrap items-center gap-2 px-1">
                      <Link2 className="h-4 w-4 text-emerald-400" />
                      <span className="text-xs font-bold text-emerald-400">{groupLabel(group)}</span>
                      {timed && (
                        <button onClick={() => startTimer((group.timeCapMin ?? 10) * 60)} className="px-2 py-0.5 rounded-lg bg-slate-800 text-[10px] font-bold text-slate-100">
                          Start {group.timeCapMin ?? 10}:00 timer
                        </button>
                      )}
                      {timed && (
                        <label className="ml-auto flex items-center gap-1.5 text-xs text-slate-300">
                          Rounds done
                          <input
                            type="number"
                            min={0}
                            inputMode="numeric"
                            value={group.completedRounds ?? ''}
                            onChange={e => setGroups(prev => prev.map(g => (g.id === group.id ? { ...g, completedRounds: e.target.value ? Number(e.target.value) : undefined } : g)))}
                            className="w-16 h-8 px-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white text-center"
                          />
                        </label>
                      )}
                    </div>
                    {group.notes && <p className="px-1 text-xs text-slate-300">{group.notes}</p>}
                    <div className="space-y-2">{cards}</div>
                  </div>
                );
              })}
            </section>
          ))}

          {/* Feedback */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {isCoach ? 'Athlete notes' : 'How did it feel?'}
              <textarea
                rows={2}
                value={clientFeedback}
                onChange={e => setClientFeedback(e.target.value)}
                placeholder="Energy, pain, anything the coach should know"
                className="mt-1 w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white normal-case tracking-normal font-normal"
              />
            </label>
            {isCoach ? (
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Coach feedback
                <textarea
                  rows={2}
                  value={coachFeedback}
                  onChange={e => setCoachFeedback(e.target.value)}
                  placeholder="Progressions, form notes…"
                  className="mt-1 w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white normal-case tracking-normal font-normal"
                />
              </label>
            ) : coachFeedback ? (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Coach feedback</p>
                <p className="mt-1 p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100">{coachFeedback}</p>
              </div>
            ) : null}
            <div className="flex items-center gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Rating</p>
                <div className="flex">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button key={star} onClick={() => setRating(star)} aria-label={`${star} star${star > 1 ? 's' : ''}`} className={`p-0.5 ${rating >= star ? 'text-amber-400' : 'text-slate-600'}`}>
                      <Star className="h-5 w-5 fill-current" />
                    </button>
                  ))}
                </div>
              </div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Minutes
                <input type="number" min={1} value={durationMin} onChange={e => setDurationMin(Number(e.target.value) || 0)} className="mt-1 block w-20 h-9 px-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white" />
              </label>
            </div>
          </section>
        </div>

        {/* Footer */}
        <footer className="p-3 sm:p-4 border-t border-slate-800 flex items-center gap-2">
          <button onClick={closeWorkoutLogger} className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-100 text-sm font-semibold">Close</button>
          {!alreadyCompleted && (
            <button onClick={saveProgress} disabled={isSubmitting} className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-100 text-sm font-semibold disabled:opacity-50">
              Save progress
            </button>
          )}
          <button onClick={finish} disabled={isSubmitting} className="ml-auto inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-sm font-bold">
            <CheckCircle2 className="h-4 w-4" />
            {isSubmitting ? 'Saving…' : alreadyCompleted ? 'Save changes' : 'Complete workout'}
          </button>
        </footer>
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
    <p className="text-sm font-extrabold text-white">{value}</p>
  </div>
);

interface ExerciseLogProps {
  exercise: WorkoutExerciseItem;
  inGroup: boolean;
  history: { date: string; sets: string[] } | null;
  videoOpen: boolean;
  onToggleVideo: () => void;
  onToggleSet: (setIndex: number) => void;
  onUpdateSet: (setIndex: number, changes: Partial<WorkoutSet>) => void;
}

const ExerciseLog: React.FC<ExerciseLogProps> = ({ exercise, inGroup, history, videoOpen, onToggleVideo, onToggleSet, onUpdateSet }) => {
  const tracking = trackingOf(exercise);
  const fields = TRACKING[tracking].fields;
  const num = (v: string) => (v === '' ? undefined : Number(v));

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 space-y-2.5">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">{exercise.exerciseName}</p>
          {exercise.coachNotes && <p className="text-xs text-emerald-400 mt-0.5">{exercise.coachNotes}</p>}
          {history && (
            <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
              <History className="h-3 w-3 shrink-0" />
              <span className="truncate">Last time ({formatDay(history.date)}): {history.sets.join(', ')}</span>
            </p>
          )}
        </div>
        {exercise.videoUrl && (
          <button onClick={onToggleVideo} aria-label={videoOpen ? 'Hide demo video' : 'Show demo video'} className="p-1.5 rounded-lg hover:bg-slate-800">
            <PlayCircle className="h-5 w-5 text-emerald-400" />
          </button>
        )}
      </div>

      {videoOpen && <VideoEmbed url={exercise.videoUrl} title={exercise.exerciseName} />}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-slate-400">
              <th className="text-left font-bold py-1 pr-2 w-8">{inGroup ? 'Rnd' : 'Set'}</th>
              <th className="text-left font-bold py-1 pr-2">Target</th>
              {fields.includes('reps') && <th className="font-bold py-1 px-1">Reps</th>}
              {fields.includes('weight') && <th className="font-bold py-1 px-1">Kg</th>}
              {fields.includes('time') && <th className="font-bold py-1 px-1">Time</th>}
              {fields.includes('distance') && <th className="font-bold py-1 px-1">Metres</th>}
              {tracking === 'reps_weight' && <th className="font-bold py-1 px-1">RPE</th>}
              <th className="font-bold py-1 pl-1 w-10">Done</th>
            </tr>
          </thead>
          <tbody>
            {exercise.sets.map((set, s) => (
              <tr key={set.id} className={set.isCompleted ? 'bg-emerald-500/5' : ''}>
                <td className="py-1 pr-2 font-bold text-slate-300">{s + 1}</td>
                <td className="py-1 pr-2 text-slate-300 whitespace-nowrap">{describeTarget(set, tracking)}</td>
                {fields.includes('reps') && (
                  <td className="py-1 px-1">
                    <input aria-label={`Set ${s + 1} reps done`} inputMode="numeric" value={set.completedReps ?? ''} placeholder={set.targetReps} onChange={e => onUpdateSet(s, { completedReps: num(e.target.value) })} className={cellInput} />
                  </td>
                )}
                {fields.includes('weight') && (
                  <td className="py-1 px-1">
                    <input aria-label={`Set ${s + 1} weight used`} inputMode="decimal" value={set.completedWeightKg ?? ''} placeholder={set.targetWeightKg?.toString() ?? ''} onChange={e => onUpdateSet(s, { completedWeightKg: num(e.target.value) })} className={cellInput} />
                  </td>
                )}
                {fields.includes('time') && (
                  <td className="py-1 px-1">
                    <input
                      key={set.completedDurationSec ?? 'empty'}
                      aria-label={`Set ${s + 1} time`}
                      defaultValue={formatDuration(set.completedDurationSec)}
                      placeholder={formatDuration(set.targetDurationSec)}
                      onBlur={e => onUpdateSet(s, { completedDurationSec: parseDuration(e.target.value) })}
                      className={cellInput}
                    />
                  </td>
                )}
                {fields.includes('distance') && (
                  <td className="py-1 px-1">
                    <input aria-label={`Set ${s + 1} distance`} inputMode="numeric" value={set.completedDistanceM ?? ''} placeholder={set.targetDistanceM?.toString() ?? ''} onChange={e => onUpdateSet(s, { completedDistanceM: num(e.target.value) })} className={cellInput} />
                  </td>
                )}
                {tracking === 'reps_weight' && (
                  <td className="py-1 px-1">
                    <input aria-label={`Set ${s + 1} RPE`} inputMode="decimal" value={set.completedRpe ?? ''} placeholder={set.targetRpe?.toString() ?? ''} onChange={e => onUpdateSet(s, { completedRpe: num(e.target.value) })} className={cellInput} />
                  </td>
                )}
                <td className="py-1 pl-1 text-center">
                  <button onClick={() => onToggleSet(s)} aria-label={`Mark set ${s + 1} ${set.isCompleted ? 'not done' : 'done'}`} aria-pressed={!!set.isCompleted}>
                    {set.isCompleted ? <CheckCircle2 className="h-6 w-6 text-emerald-400" /> : <Circle className="h-6 w-6 text-slate-500" />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Dumbbell, 
  CheckCircle2, 
  Timer, 
  Play, 
  Pause, 
  RotateCcw, 
  Star, 
  Award, 
  Flame, 
  ArrowRight,
  TrendingUp
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useApp } from '../../context/AppContext';
import { ScheduledWorkout, WorkoutSet } from '../../types';

export const WorkoutLoggerModal: React.FC = () => {
  const { 
    isWorkoutLoggerOpen, 
    closeWorkoutLogger, 
    activeWorkoutToLog, 
    completeWorkout, 
    updateWorkoutLog,
    addPersonalRecord
  } = useApp();

  if (!isWorkoutLoggerOpen || !activeWorkoutToLog) return null;

  // Local state for live editable exercises and sets
  const [exercises, setExercises] = useState(activeWorkoutToLog.exercises || []);
  const [clientFeedback, setClientFeedback] = useState(activeWorkoutToLog.clientFeedback || '');
  const [coachFeedback, setCoachFeedback] = useState(activeWorkoutToLog.coachFeedback || '');
  const [rating, setRating] = useState(activeWorkoutToLog.rating || 5);
  const [durationMin, setDurationMin] = useState(activeWorkoutToLog.durationMin || 55);

  // Built-in Rest Timer
  const [restSecondsLeft, setRestSecondsLeft] = useState<number | null>(null);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isTimerRunning && restSecondsLeft !== null && restSecondsLeft > 0) {
      interval = setInterval(() => {
        setRestSecondsLeft(prev => (prev !== null && prev > 0 ? prev - 1 : 0));
      }, 1000);
    } else if (restSecondsLeft === 0) {
      setIsTimerRunning(false);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, restSecondsLeft]);

  const startRestTimer = (seconds: number) => {
    setRestSecondsLeft(seconds);
    setIsTimerRunning(true);
  };

  const handleToggleSetComplete = (exIdx: number, setIdx: number) => {
    const updated = [...exercises];
    const targetSet = updated[exIdx].sets[setIdx];
    
    // Toggle completed
    const nextCompleted = !targetSet.isCompleted;
    targetSet.isCompleted = nextCompleted;

    if (nextCompleted) {
      targetSet.completedWeightKg = targetSet.completedWeightKg || targetSet.targetWeightKg || 60;
      targetSet.completedReps = targetSet.completedReps || Number(targetSet.targetReps.split('-')[0]) || 8;
      targetSet.completedRpe = targetSet.completedRpe || targetSet.targetRpe || 8;
      
      // Auto trigger rest timer
      startRestTimer(targetSet.restSeconds || 90);
    }

    setExercises(updated);
  };

  const handleUpdateSetCompletedValue = (exIdx: number, setIdx: number, field: keyof WorkoutSet, val: any) => {
    const updated = [...exercises];
    updated[exIdx].sets[setIdx] = {
      ...updated[exIdx].sets[setIdx],
      [field]: val
    };
    setExercises(updated);
  };

  // Calculate total volume and 1RM estimate
  const totalVolume = exercises.reduce((acc, ex) => {
    return acc + ex.sets.reduce((sAcc, s) => {
      if (s.isCompleted && s.completedWeightKg && s.completedReps) {
        return sAcc + (s.completedWeightKg * s.completedReps);
      }
      return sAcc;
    }, 0);
  }, 0);

  const completedSetsCount = exercises.reduce((acc, ex) => {
    return acc + ex.sets.filter(s => s.isCompleted).length;
  }, 0);

  const totalSetsCount = exercises.reduce((acc, ex) => acc + ex.sets.length, 0);

  const handleFinishWorkout = () => {
    // Fire confetti celebration
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#10b981', '#06b6d4', '#f59e0b', '#3b82f6']
      });
    } catch (e) {
      // fallback
    }

    // Check for high weight sets to log as PR
    exercises.forEach(ex => {
      ex.sets.forEach(s => {
        if (s.isCompleted && s.completedWeightKg && s.completedReps && s.completedWeightKg > 100) {
          const est1Rm = Math.round(s.completedWeightKg * (1 + s.completedReps / 30));
          addPersonalRecord({
            clientId: activeWorkoutToLog.clientId,
            exerciseName: ex.exerciseName,
            weightKg: s.completedWeightKg,
            reps: s.completedReps,
            estimated1RmKg: est1Rm,
            date: activeWorkoutToLog.date
          });
        }
      });
    });

    updateWorkoutLog(activeWorkoutToLog.id, {
      exercises,
      durationMin,
      totalVolumeKg: totalVolume
    });

    completeWorkout(activeWorkoutToLog.id, {
      clientFeedback,
      coachFeedback,
      rating
    });

    closeWorkoutLogger();
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-4xl max-h-[92vh] rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950/40 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src={activeWorkoutToLog.clientAvatar} 
              alt={activeWorkoutToLog.clientName} 
              className="h-12 w-12 rounded-xl object-cover border border-slate-700" 
            />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-white">{activeWorkoutToLog.workoutTitle}</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {activeWorkoutToLog.status}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Athlete: <strong className="text-slate-200">{activeWorkoutToLog.clientName}</strong> • Date: {activeWorkoutToLog.date}
              </p>
            </div>
          </div>

          <button 
            onClick={closeWorkoutLogger} 
            className="h-8 w-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Live Rest Timer & Stats Strip */}
        <div className="px-6 py-3 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Progress stats */}
          <div className="flex items-center gap-4">
            <div>
              <span className="text-slate-400 text-[10px] uppercase font-bold">Completed Sets</span>
              <div className="font-bold text-emerald-400">{completedSetsCount} / {totalSetsCount || 12}</div>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] uppercase font-bold">Total Volume</span>
              <div className="font-bold text-white">{totalVolume.toLocaleString()} kg</div>
            </div>
          </div>

          {/* Rest Stopwatch Widget */}
          <div className="flex items-center gap-2 p-1.5 px-3 rounded-xl bg-slate-900 border border-slate-800">
            <Timer className="h-4 w-4 text-cyan-400" />
            <span className="text-slate-400 font-bold text-[10px] uppercase">Rest:</span>
            <span className={`font-mono font-bold text-sm ${restSecondsLeft && restSecondsLeft < 10 ? 'text-amber-400 animate-pulse' : 'text-white'}`}>
              {restSecondsLeft !== null ? formatTime(restSecondsLeft) : '0:00'}
            </span>

            {restSecondsLeft !== null && (
              <button 
                onClick={() => setIsTimerRunning(!isTimerRunning)} 
                className="p-1 text-slate-300 hover:text-white"
              >
                {isTimerRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </button>
            )}

            <div className="flex gap-1 pl-1 border-l border-slate-800">
              <button 
                onClick={() => startRestTimer(60)}
                className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 hover:text-white"
              >
                60s
              </button>
              <button 
                onClick={() => startRestTimer(90)}
                className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 hover:text-white"
              >
                90s
              </button>
              <button 
                onClick={() => startRestTimer(120)}
                className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 hover:text-white"
              >
                120s
              </button>
            </div>
          </div>
        </div>

        {/* Exercises & Set Logs Body */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6 text-xs text-slate-300">
          {exercises.length === 0 ? (
            <div className="p-8 text-center text-slate-400 bg-slate-950/40 rounded-2xl border border-slate-800">
              No exercise template data attached to this session. Click "Finish & Log" below to mark completed with feedback.
            </div>
          ) : (
            exercises.map((ex, exIdx) => (
              <div key={ex.id || exIdx} className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="h-6 w-6 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-xs">
                      {exIdx + 1}
                    </span>
                    <h4 className="text-sm font-bold text-white">{ex.exerciseName}</h4>
                    <span className="text-[10px] text-slate-400 font-medium px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800">
                      {ex.primaryMuscle}
                    </span>
                  </div>
                  {ex.tempo && (
                    <span className="text-[10px] text-slate-400">Tempo: {ex.tempo}</span>
                  )}
                </div>

                {/* Sets Checklist Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="text-[9px] uppercase font-bold text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="pb-1.5 w-12">Set</th>
                        <th className="pb-1.5 w-28">Target</th>
                        <th className="pb-1.5 w-28">Weight (kg)</th>
                        <th className="pb-1.5 w-24">Reps</th>
                        <th className="pb-1.5 w-20">RPE</th>
                        <th className="pb-1.5 w-24">Est 1RM</th>
                        <th className="pb-1.5 text-right w-20">Done</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {ex.sets.map((set, setIdx) => {
                        const currentWeight = set.completedWeightKg !== undefined ? set.completedWeightKg : (set.targetWeightKg || 60);
                        const currentReps = set.completedReps !== undefined ? set.completedReps : 8;
                        const est1Rm = Math.round(currentWeight * (1 + currentReps / 30));

                        return (
                          <tr 
                            key={set.id || setIdx} 
                            className={`transition-colors ${set.isCompleted ? 'bg-emerald-500/10' : 'hover:bg-slate-900/40'}`}
                          >
                            <td className="py-2 font-bold text-white">{set.setNumber}</td>
                            <td className="py-2 text-slate-400 font-medium">
                              {set.targetReps} reps @ {set.targetWeightKg || '--'}kg
                            </td>
                            <td className="py-2 pr-2">
                              <input
                                type="number"
                                step="0.5"
                                value={set.completedWeightKg !== undefined ? set.completedWeightKg : (set.targetWeightKg || 60)}
                                onChange={(e) => handleUpdateSetCompletedValue(exIdx, setIdx, 'completedWeightKg', Number(e.target.value))}
                                className="w-20 h-7 px-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-bold text-white focus:outline-hidden"
                              />
                            </td>
                            <td className="py-2 pr-2">
                              <input
                                type="number"
                                value={set.completedReps !== undefined ? set.completedReps : 8}
                                onChange={(e) => handleUpdateSetCompletedValue(exIdx, setIdx, 'completedReps', Number(e.target.value))}
                                className="w-16 h-7 px-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-bold text-white focus:outline-hidden"
                              />
                            </td>
                            <td className="py-2 pr-2">
                              <input
                                type="number"
                                step="0.5"
                                value={set.completedRpe !== undefined ? set.completedRpe : (set.targetRpe || 8)}
                                onChange={(e) => handleUpdateSetCompletedValue(exIdx, setIdx, 'completedRpe', Number(e.target.value))}
                                className="w-14 h-7 px-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-bold text-amber-400 focus:outline-hidden"
                              />
                            </td>
                            <td className="py-2 text-slate-400 font-mono text-[11px]">
                              {est1Rm} kg
                            </td>
                            <td className="py-2 text-right">
                              <button
                                onClick={() => handleToggleSetComplete(exIdx, setIdx)}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  set.isCompleted 
                                    ? 'bg-emerald-500 text-slate-950' 
                                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                                }`}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}

          {/* Feedback & Session Ratings */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">Session Debrief & Feedback</h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Athlete Self-Feedback</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Felt great on bench, slight right knee fatigue on lunges..."
                  value={clientFeedback}
                  onChange={(e) => setClientFeedback(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Coach Notes & Progressions</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Great velocity. Increase dumbbell load next week by 2kg..."
                  value={coachFeedback}
                  onChange={(e) => setCoachFeedback(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-xs font-bold">Session Effort Rating:</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      className={`p-1 ${rating >= star ? 'text-amber-400' : 'text-slate-700'}`}
                    >
                      <Star className="h-4 w-4 fill-current" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-xs font-bold">Duration:</span>
                <input
                  type="number"
                  value={durationMin}
                  onChange={(e) => setDurationMin(Number(e.target.value))}
                  className="w-16 h-8 px-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-bold text-white text-center"
                />
                <span className="text-slate-400 text-xs">minutes</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={closeWorkoutLogger}
            className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700"
          >
            Cancel / Close
          </button>

          <button
            id="finish-workout-btn"
            onClick={handleFinishWorkout}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors shadow-sm"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Complete & Save Workout</span>
          </button>
        </div>
      </div>
    </div>
  );
};

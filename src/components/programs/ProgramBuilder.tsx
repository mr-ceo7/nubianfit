import React, { useState } from 'react';
import { 
  Dumbbell, 
  Plus, 
  Trash2, 
  ChevronUp, 
  ChevronDown, 
  Save, 
  UserCheck, 
  Copy, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Layers, 
  X,
  Target,
  ArrowRight
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { 
  TrainingProgram, 
  WorkoutDay, 
  WorkoutExerciseItem, 
  WorkoutSet, 
  Exercise, 
  FitnessGoal, 
  Difficulty 
} from '../../types';

export const ProgramBuilder: React.FC<{
  initialProgramId?: string;
}> = ({ initialProgramId }) => {
  const { 
    programs, 
    exercises, 
    saveProgram, 
    deleteProgram, 
    clients, 
    assignProgramToClient 
  } = useApp();

  // Active loaded program
  const defaultProgram = programs.find(p => p.id === initialProgramId) || programs[0];

  const [activeProgram, setActiveProgram] = useState<TrainingProgram>(() => {
    return JSON.parse(JSON.stringify(defaultProgram));
  });

  const [activeDayIndex, setActiveDayIndex] = useState<number>(0);
  const [isExercisePickerOpen, setIsExercisePickerOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedClientToAssign, setSelectedClientToAssign] = useState<string>(clients[0]?.id || '');
  const [pickerSearch, setPickerSearch] = useState('');

  // Handle program switch
  const handleLoadProgram = (programId: string) => {
    const found = programs.find(p => p.id === programId);
    if (found) {
      setActiveProgram(JSON.parse(JSON.stringify(found)));
      setActiveDayIndex(0);
    }
  };

  const handleCreateNewBlankProgram = () => {
    const newProg: TrainingProgram = {
      id: `prog-${Date.now()}`,
      title: 'New Custom Training Program',
      subtitle: 'Custom Split Programming',
      description: 'Periodized training protocol tailored for athlete progression.',
      difficulty: 'Intermediate',
      goal: 'Hypertrophy',
      durationWeeks: 8,
      daysPerWeek: 4,
      tags: ['Custom', 'Periodized'],
      assignedClientCount: 0,
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
      days: [
        {
          id: `day-${Date.now()}-1`,
          dayNumber: 1,
          name: 'Day 1: Upper Body Focus',
          focus: 'Horizontal Push & Pull Volume',
          estimatedDurationMin: 60,
          warmupNotes: 'Shoulder dislocates 2x15, thoracic rotation.',
          cooldownNotes: 'Doorway pectoral stretch.',
          exercises: []
        }
      ]
    };
    setActiveProgram(newProg);
    setActiveDayIndex(0);
  };

  const currentDay = activeProgram.days[activeDayIndex] || activeProgram.days[0];

  // Modify Program Fields
  const updateProgramField = <K extends keyof TrainingProgram>(key: K, value: TrainingProgram[K]) => {
    setActiveProgram(prev => ({ ...prev, [key]: value }));
  };

  // Modify Current Day Fields
  const updateCurrentDay = (updates: Partial<WorkoutDay>) => {
    setActiveProgram(prev => {
      const nextDays = [...prev.days];
      nextDays[activeDayIndex] = { ...nextDays[activeDayIndex], ...updates };
      return { ...prev, days: nextDays };
    });
  };

  // Add new day to program
  const handleAddDay = () => {
    const nextDayNum = activeProgram.days.length + 1;
    const newDay: WorkoutDay = {
      id: `day-${Date.now()}-${nextDayNum}`,
      dayNumber: nextDayNum,
      name: `Day ${nextDayNum}: Workout Split`,
      focus: 'Primary Movement Focus',
      estimatedDurationMin: 60,
      exercises: []
    };
    setActiveProgram(prev => ({
      ...prev,
      days: [...prev.days, newDay],
      daysPerWeek: prev.days.length + 1
    }));
    setActiveDayIndex(activeProgram.days.length);
  };

  // Delete current day
  const handleDeleteCurrentDay = () => {
    if (activeProgram.days.length <= 1) return;
    setActiveProgram(prev => ({
      ...prev,
      days: prev.days.filter((_, i) => i !== activeDayIndex)
    }));
    setActiveDayIndex(Math.max(0, activeDayIndex - 1));
  };

  // Add exercise to current day
  const handleAddExerciseToDay = (ex: Exercise) => {
    const newWorkoutEx: WorkoutExerciseItem = {
      id: `we-${Date.now()}`,
      exerciseId: ex.id,
      exerciseName: ex.name,
      primaryMuscle: ex.primaryMuscle,
      equipment: ex.equipment,
      tempo: '3-0-1-0',
      coachNotes: 'Control eccentric descent.',
      sets: [
        { id: `s-${Date.now()}-1`, setNumber: 1, targetReps: '8-10', targetRpe: 8, targetWeightKg: 60, restSeconds: 120 },
        { id: `s-${Date.now()}-2`, setNumber: 2, targetReps: '8-10', targetRpe: 8, targetWeightKg: 60, restSeconds: 120 },
        { id: `s-${Date.now()}-3`, setNumber: 3, targetReps: '8-10', targetRpe: 8.5, targetWeightKg: 60, restSeconds: 120 }
      ]
    };

    updateCurrentDay({
      exercises: [...(currentDay.exercises || []), newWorkoutEx]
    });
    setIsExercisePickerOpen(false);
  };

  // Remove exercise from day
  const handleRemoveExercise = (exerciseId: string) => {
    updateCurrentDay({
      exercises: currentDay.exercises.filter(e => e.id !== exerciseId)
    });
  };

  // Reorder exercise
  const handleMoveExercise = (index: number, direction: 'up' | 'down') => {
    const list = [...currentDay.exercises];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;

    const [moved] = list.splice(index, 1);
    list.splice(targetIdx, 0, moved);
    updateCurrentDay({ exercises: list });
  };

  // Add set to exercise
  const handleAddSet = (exerciseId: string) => {
    const targetEx = currentDay.exercises.find(e => e.id === exerciseId);
    if (!targetEx) return;

    const lastSet = targetEx.sets[targetEx.sets.length - 1];
    const newSet: WorkoutSet = {
      id: `s-${Date.now()}`,
      setNumber: targetEx.sets.length + 1,
      targetReps: lastSet?.targetReps || '8-10',
      targetRpe: lastSet?.targetRpe || 8,
      targetWeightKg: lastSet?.targetWeightKg || 60,
      restSeconds: lastSet?.restSeconds || 120
    };

    const updatedExercises = currentDay.exercises.map(e => {
      if (e.id === exerciseId) {
        return { ...e, sets: [...e.sets, newSet] };
      }
      return e;
    });
    updateCurrentDay({ exercises: updatedExercises });
  };

  // Remove set from exercise
  const handleRemoveSet = (exerciseId: string, setIndex: number) => {
    const updatedExercises = currentDay.exercises.map(e => {
      if (e.id === exerciseId) {
        const nextSets = e.sets.filter((_, idx) => idx !== setIndex).map((s, idx) => ({ ...s, setNumber: idx + 1 }));
        return { ...e, sets: nextSets };
      }
      return e;
    });
    updateCurrentDay({ exercises: updatedExercises });
  };

  // Update specific set field
  const handleUpdateSet = (exerciseId: string, setIndex: number, field: keyof WorkoutSet, val: any) => {
    const updatedExercises = currentDay.exercises.map(e => {
      if (e.id === exerciseId) {
        const nextSets = [...e.sets];
        nextSets[setIndex] = { ...nextSets[setIndex], [field]: val };
        return { ...e, sets: nextSets };
      }
      return e;
    });
    updateCurrentDay({ exercises: updatedExercises });
  };

  // Toggle Superset
  const handleToggleSuperset = (exerciseId: string) => {
    const updatedExercises = currentDay.exercises.map(e => {
      if (e.id === exerciseId) {
        return { ...e, isSupersetWithNext: !e.isSupersetWithNext };
      }
      return e;
    });
    updateCurrentDay({ exercises: updatedExercises });
  };

  // Save Program Action
  const [isSaving, setIsSaving] = useState(false);
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveProgram(activeProgram);
    } finally {
      setIsSaving(false);
    }
  };

  // Filter exercises in picker
  const filteredPickerExercises = exercises.filter(e => 
    e.name.toLowerCase().includes(pickerSearch.toLowerCase()) ||
    e.primaryMuscle.toLowerCase().includes(pickerSearch.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Template Quick Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Dumbbell className="h-6 w-6 text-emerald-400" />
            Program & Workout Template Builder
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Build periodized training splits, compound progressions, supersets, and custom rest tempos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            id="new-program-builder-btn"
            onClick={handleCreateNewBlankProgram}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-colors"
          >
            <Plus className="h-4 w-4 text-emerald-400" />
            <span>+ New Blank Program</span>
          </button>

          <button
            id="assign-program-to-client-btn"
            onClick={() => setIsAssignModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-bold border border-cyan-500/40 transition-colors"
          >
            <UserCheck className="h-4 w-4 text-cyan-400" />
            <span>Assign to Athlete</span>
          </button>

          <button
            id="save-program-builder-btn"
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            {isSaving ? (
              <>
                <svg className="animate-spin h-4 w-4 text-slate-950" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Save Program</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Program Selector Bar */}
      <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center gap-2 overflow-x-auto text-xs">
        <span className="text-[10px] uppercase font-bold text-slate-400 px-2 shrink-0">Saved Templates:</span>
        {programs.map(p => (
          <button
            key={p.id}
            onClick={() => handleLoadProgram(p.id)}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-colors ${
              activeProgram.id === p.id 
                ? 'bg-emerald-500 text-slate-950 shadow-xs' 
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            {p.title}
          </button>
        ))}
      </div>

      {/* Program Metadata Card */}
      <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Program Title</label>
            <input
              type="text"
              value={activeProgram.title}
              onChange={(e) => updateProgramField('title', e.target.value)}
              className="w-full h-10 px-3.5 rounded-xl bg-slate-950 border border-slate-800 text-sm font-bold text-white focus:border-emerald-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Goal Target</label>
            <select
              value={activeProgram.goal}
              onChange={(e) => updateProgramField('goal', e.target.value as FitnessGoal)}
              className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-emerald-400 focus:outline-hidden"
            >
              <option value="Hypertrophy">Hypertrophy</option>
              <option value="Fat Loss">Fat Loss & Recomposition</option>
              <option value="Strength & Power">Strength & Power</option>
              <option value="Athletic Conditioning">Athletic Conditioning</option>
              <option value="Rehabilitation">Rehabilitation</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Duration (Weeks)</label>
            <input
              type="number"
              value={activeProgram.durationWeeks}
              onChange={(e) => updateProgramField('durationWeeks', Number(e.target.value))}
              className="w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-hidden"
            />
          </div>
          <div>
            <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Days / Week</label>
            <input
              type="number"
              value={activeProgram.daysPerWeek}
              onChange={(e) => updateProgramField('daysPerWeek', Number(e.target.value))}
              className="w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-hidden"
            />
          </div>
          <div>
            <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Difficulty</label>
            <select
              value={activeProgram.difficulty}
              onChange={(e) => updateProgramField('difficulty', e.target.value as Difficulty)}
              className="w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-hidden"
            >
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
            </select>
          </div>
          <div>
            <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Assigned Athletes</label>
            <div className="h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 flex items-center font-bold">
              {activeProgram.assignedClientCount} Active
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Day Tabs */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2 overflow-x-auto">
          {activeProgram.days.map((day, idx) => (
            <button
              key={day.id}
              onClick={() => setActiveDayIndex(idx)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeDayIndex === idx
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <span>{day.name}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300">
                {day.exercises?.length || 0} Ex
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleAddDay}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-bold border border-slate-700"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Day</span>
          </button>
          {activeProgram.days.length > 1 && (
            <button
              onClick={handleDeleteCurrentDay}
              className="p-2 rounded-xl bg-slate-900 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-slate-800"
              title="Delete this training day"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Current Day Content & Exercise Blocks */}
      {currentDay && (
        <div className="space-y-4">
          {/* Day details header */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Day Name</label>
              <input
                type="text"
                value={currentDay.name}
                onChange={(e) => updateCurrentDay({ name: e.target.value })}
                className="w-full h-8 px-3 rounded-lg bg-slate-950 border border-slate-800 text-xs font-bold text-white focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Focus / Target</label>
              <input
                type="text"
                value={currentDay.focus}
                onChange={(e) => updateCurrentDay({ focus: e.target.value })}
                className="w-full h-8 px-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-emerald-400 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Warmup Notes</label>
              <input
                type="text"
                placeholder="e.g. Band pull-aparts, hip flexor stretch"
                value={currentDay.warmupNotes || ''}
                onChange={(e) => updateCurrentDay({ warmupNotes: e.target.value })}
                className="w-full h-8 px-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Exercise Items List */}
          <div className="space-y-3">
            {(!currentDay.exercises || currentDay.exercises.length === 0) ? (
              <div className="p-8 text-center bg-slate-900/60 rounded-3xl border border-dashed border-slate-800 text-slate-400 text-xs space-y-3">
                <Dumbbell className="h-8 w-8 mx-auto text-slate-400" />
                <div>No exercises added to {currentDay.name} yet.</div>
                <button
                  onClick={() => setIsExercisePickerOpen(true)}
                  className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 shadow-md transition-all"
                >
                  + Add First Movement
                </button>
              </div>
            ) : (
              currentDay.exercises.map((item, exIdx) => (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    item.isSupersetWithNext 
                      ? 'bg-slate-900/90 border-cyan-500/40 shadow-sm' 
                      : 'bg-slate-900/90 border-slate-800'
                  }`}
                >
                  {/* Exercise Title & Controls */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 font-black text-xs">
                        {exIdx + 1}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white">{item.exerciseName}</h4>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                            {item.primaryMuscle}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {item.equipment}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      {/* Superset Toggle */}
                      <button
                        onClick={() => handleToggleSuperset(item.id)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                          item.isSupersetWithNext
                            ? 'bg-cyan-500 text-slate-950'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                        title="Link with next exercise as Superset/Circuit"
                      >
                        {item.isSupersetWithNext ? '🔗 Superset Linked' : '+ Superset'}
                      </button>

                      {/* Move controls */}
                      <button
                        onClick={() => handleMoveExercise(exIdx, 'up')}
                        disabled={exIdx === 0}
                        className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleMoveExercise(exIdx, 'down')}
                        disabled={exIdx === currentDay.exercises.length - 1}
                        className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => handleRemoveExercise(item.id)}
                        className="p-1 text-slate-400 hover:text-red-400"
                        title="Remove exercise"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Sets Configuration Table */}
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="text-[9px] uppercase font-bold text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="pb-1.5 w-12">Set</th>
                          <th className="pb-1.5 w-24">Target Reps</th>
                          <th className="pb-1.5 w-20">Target RPE</th>
                          <th className="pb-1.5 w-24">Weight (kg)</th>
                          <th className="pb-1.5 w-24">Rest (s)</th>
                          <th className="pb-1.5 text-right w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {item.sets.map((set, setIdx) => (
                          <tr key={set.id} className="hover:bg-slate-800/30">
                            <td className="py-1.5 font-bold text-white">{set.setNumber}</td>
                            <td className="py-1.5 pr-2">
                              <input
                                type="text"
                                value={set.targetReps}
                                onChange={(e) => handleUpdateSet(item.id, setIdx, 'targetReps', e.target.value)}
                                className="w-full h-7 px-2 rounded-md bg-slate-950 border border-slate-800 text-xs text-white focus:outline-hidden"
                              />
                            </td>
                            <td className="py-1.5 pr-2">
                              <input
                                type="number"
                                step="0.5"
                                value={set.targetRpe || 8}
                                onChange={(e) => handleUpdateSet(item.id, setIdx, 'targetRpe', Number(e.target.value))}
                                className="w-full h-7 px-2 rounded-md bg-slate-950 border border-slate-800 text-xs text-white font-bold focus:outline-hidden"
                              />
                            </td>
                            <td className="py-1.5 pr-2">
                              <input
                                type="number"
                                step="0.5"
                                value={set.targetWeightKg || ''}
                                placeholder="Auto"
                                onChange={(e) => handleUpdateSet(item.id, setIdx, 'targetWeightKg', Number(e.target.value))}
                                className="w-full h-7 px-2 rounded-md bg-slate-950 border border-slate-800 text-xs text-white focus:outline-hidden"
                              />
                            </td>
                            <td className="py-1.5 pr-2">
                              <select
                                value={set.restSeconds}
                                onChange={(e) => handleUpdateSet(item.id, setIdx, 'restSeconds', Number(e.target.value))}
                                className="w-full h-7 px-1.5 rounded-md bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-hidden"
                              >
                                <option value="45">45s</option>
                                <option value="60">60s</option>
                                <option value="90">90s</option>
                                <option value="120">120s</option>
                                <option value="180">180s (3m)</option>
                                <option value="240">240s (4m)</option>
                              </select>
                            </td>
                            <td className="py-1.5 text-right">
                              {item.sets.length > 1 && (
                                <button
                                  onClick={() => handleRemoveSet(item.id, setIdx)}
                                  className="text-slate-400 hover:text-red-400 p-1"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-slate-800/60">
                    <button
                      onClick={() => handleAddSet(item.id)}
                      className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" /> Add Set
                    </button>
                    <span className="text-[10px] text-slate-400">Tempo: {item.tempo || 'Controlled'}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Add Exercise CTA Button */}
          <button
            id="open-exercise-picker-btn"
            onClick={() => setIsExercisePickerOpen(true)}
            className="w-full py-3 rounded-2xl bg-slate-900/60 hover:bg-slate-900 border border-dashed border-slate-700 hover:border-emerald-500 text-slate-300 hover:text-emerald-400 text-xs font-bold flex items-center justify-center gap-2 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>+ Add Exercise to {currentDay.name}</span>
          </button>
        </div>
      )}

      {/* Exercise Picker Modal */}
      {isExercisePickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-2xl max-h-[85vh] rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Dumbbell className="h-4 w-4 text-emerald-400" />
                Select Exercise for {currentDay.name}
              </h3>
              <button onClick={() => setIsExercisePickerOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 border-b border-slate-800">
              <input
                type="text"
                placeholder="Search movements..."
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                className="w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-400 focus:outline-hidden"
              />
            </div>

            <div className="p-4 overflow-y-auto space-y-2 flex-1 max-h-96">
              {filteredPickerExercises.map(ex => (
                <div
                  key={ex.id}
                  onClick={() => handleAddExerciseToDay(ex)}
                  className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-emerald-500/50 flex items-center justify-between cursor-pointer group transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <img src={ex.thumbnailUrl} alt={ex.name} className="h-10 w-10 rounded-lg object-cover" />
                    <div>
                      <div className="font-bold text-white group-hover:text-emerald-400 text-xs transition-colors">
                        {ex.name}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {ex.primaryMuscle} • {ex.equipment} • {ex.difficulty}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-400 group-hover:translate-x-1 transition-transform">
                    Add +
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Assign Program to Athlete Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-emerald-400" />
              Assign Program to Athlete
            </h3>
            <p className="text-xs text-slate-300">
              Assign <strong>"{activeProgram.title}"</strong> to an athlete schedule. Workouts will automatically populate their weekly calendar.
            </p>

            <div>
              <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Select Athlete</label>
              <select
                value={selectedClientToAssign}
                onChange={(e) => setSelectedClientToAssign(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-hidden"
              >
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.goal})
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
              <button
                onClick={() => setIsAssignModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  assignProgramToClient(activeProgram.id, selectedClientToAssign);
                  setIsAssignModalOpen(false);
                }}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold text-xs shadow-md"
              >
                Confirm Assignment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

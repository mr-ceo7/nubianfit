import React, { useState } from 'react';
import { 
  BookOpen, 
  Search, 
  Filter, 
  Plus, 
  Dumbbell, 
  Play, 
  X, 
  Info, 
  CheckCircle2, 
  Activity,
  ChevronRight,
  Flame
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Exercise, MuscleGroup, Equipment, Difficulty } from '../../types';

export const ExerciseLibrary: React.FC<{
  isAddModalOpen: boolean;
  onCloseAddModal: () => void;
  onOpenAddModal: () => void;
}> = ({ isAddModalOpen, onCloseAddModal, onOpenAddModal }) => {
  const { exercises, addExercise } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState<string>('All');
  const [selectedEquipment, setSelectedEquipment] = useState<string>('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('All');
  const [viewingExercise, setViewingExercise] = useState<Exercise | null>(null);

  // New Exercise Form State
  const [formName, setFormName] = useState('');
  const [formMuscle, setFormMuscle] = useState<MuscleGroup>('Chest');
  const [formEquipment, setFormEquipment] = useState<Equipment>('Barbell');
  const [formDifficulty, setFormDifficulty] = useState<Difficulty>('Intermediate');
  const [formCategory, setFormCategory] = useState<Exercise['category']>('Hypertrophy');
  const [formDescription, setFormDescription] = useState('');
  const [formInstructions, setFormInstructions] = useState('');
  const [formCues, setFormCues] = useState('');

  const muscles: (MuscleGroup | 'All')[] = [
    'All', 'Chest', 'Back', 'Quads', 'Hamstrings', 'Glutes', 'Shoulders', 'Biceps', 'Triceps', 'Core', 'Cardio'
  ];

  const equipments: (Equipment | 'All')[] = [
    'All', 'Barbell', 'Dumbbell', 'Cable', 'Machine', 'Bodyweight', 'Kettlebell'
  ];

  const filteredExercises = exercises.filter((ex) => {
    const matchesSearch = ex.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          ex.primaryMuscle.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          ex.equipment.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMuscle = selectedMuscle === 'All' || ex.primaryMuscle === selectedMuscle || ex.secondaryMuscles.includes(selectedMuscle as MuscleGroup);
    const matchesEquip = selectedEquipment === 'All' || ex.equipment === selectedEquipment;
    const matchesDiff = selectedDifficulty === 'All' || ex.difficulty === selectedDifficulty;
    return matchesSearch && matchesMuscle && matchesEquip && matchesDiff;
  });

  const handleCreateExercise = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    addExercise({
      name: formName.trim(),
      primaryMuscle: formMuscle,
      secondaryMuscles: ['Core'],
      equipment: formEquipment,
      difficulty: formDifficulty,
      category: formCategory,
      description: formDescription.trim() || 'Custom exercise added to coach movement catalog.',
      instructions: formInstructions.trim() 
        ? formInstructions.split('\n').map(s => s.trim()).filter(Boolean)
        : ['Execute with controlled eccentric tempo and full range of motion.'],
      formCues: formCues.trim() 
        ? formCues.split(',').map(s => s.trim()).filter(Boolean)
        : ['Maintain neutral spine', 'Engage primary target muscle'],
      thumbnailUrl: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=400&auto=format&fit=crop&q=80'
    });

    onCloseAddModal();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-emerald-400" />
            Exercise & Movement Database ({exercises.length})
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Standardized movement library with form cues, execution steps, and muscle targets.
          </p>
        </div>

        <button
          id="add-custom-exercise-btn"
          onClick={onOpenAddModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all self-start sm:self-auto"
        >
          <Plus className="h-4 w-4 stroke-[3]" />
          <span>+ Add Custom Movement</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            id="exercise-library-search"
            type="text"
            placeholder="Search exercises by name, muscle, or equipment..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-9 pl-9 pr-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-400 focus:outline-hidden focus:border-emerald-500"
          />
        </div>

        {/* Filter Rows */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-slate-800/80">
          {/* Muscle Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full text-xs">
            <span className="text-[10px] uppercase font-bold text-slate-400 mr-1 shrink-0">Muscle:</span>
            {muscles.map((m) => (
              <button
                key={m}
                onClick={() => setSelectedMuscle(m)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedMuscle === m
                    ? 'bg-emerald-500 text-slate-950 font-bold'
                    : 'bg-slate-800/80 text-slate-400 hover:text-white'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Equipment Dropdown & Difficulty */}
          <div className="flex items-center gap-2 shrink-0 text-xs">
            <select
              value={selectedEquipment}
              onChange={(e) => setSelectedEquipment(e.target.value)}
              className="h-8 px-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 focus:outline-hidden"
            >
              {equipments.map(eq => (
                <option key={eq} value={eq}>{eq === 'All' ? 'All Equipment' : eq}</option>
              ))}
            </select>

            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="h-8 px-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 focus:outline-hidden"
            >
              <option value="All">All Levels</option>
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
            </select>
          </div>
        </div>
      </div>

      {/* Exercises Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredExercises.map((exercise) => (
          <div
            key={exercise.id}
            onClick={() => setViewingExercise(exercise)}
            className="group rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all overflow-hidden cursor-pointer flex flex-col justify-between shadow-sm hover:shadow-emerald-950/20"
          >
            {/* Image Thumbnail */}
            <div className="relative h-36 w-full overflow-hidden bg-slate-950">
              <img
                src={exercise.thumbnailUrl}
                alt={exercise.name}
                className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-85 group-hover:opacity-100"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
              
              <div className="absolute top-2.5 left-2.5 flex gap-1.5">
                <span className="px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                  {exercise.primaryMuscle}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-[10px] font-semibold text-slate-300">
                  {exercise.equipment}
                </span>
              </div>

              <span className={`absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-[9px] font-bold ${
                exercise.difficulty === 'Beginner' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                exercise.difficulty === 'Intermediate' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' :
                'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}>
                {exercise.difficulty}
              </span>
            </div>

            {/* Content */}
            <div className="p-4 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-sm text-white group-hover:text-emerald-400 transition-colors line-clamp-1">
                  {exercise.name}
                </h3>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                  {exercise.description}
                </p>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-[10px] text-slate-400 font-medium">
                  {exercise.formCues.length} coach cues
                </span>
                <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  View Form <ChevronRight className="h-3 w-3" />
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Exercise Detail Modal */}
      {viewingExercise && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-2xl max-h-[90vh] rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden flex flex-col">
            <div className="relative h-48 w-full bg-slate-950 overflow-hidden">
              <img
                src={viewingExercise.thumbnailUrl}
                alt={viewingExercise.name}
                className="h-full w-full object-cover opacity-90"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />
              
              <button
                onClick={() => setViewingExercise(null)}
                className="absolute top-4 right-4 h-8 w-8 rounded-full bg-black/60 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/90 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="absolute bottom-4 left-6 right-6">
                <div className="flex gap-2 mb-1.5">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                    {viewingExercise.primaryMuscle} Target
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-semibold">
                    {viewingExercise.equipment}
                  </span>
                </div>
                <h2 className="text-xl font-extrabold text-white tracking-tight">
                  {viewingExercise.name}
                </h2>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-300">
              {/* Description */}
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Overview</h4>
                <p className="text-slate-200 leading-relaxed">{viewingExercise.description}</p>
              </div>

              {/* Form Cues Banner */}
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                  <Activity className="h-4 w-4" />
                  <span>Coach Technique Cues</span>
                </div>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-200">
                  {viewingExercise.formCues.map((cue, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <span>{cue}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Step-by-Step Instructions */}
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Step-by-Step Execution</h4>
                <ol className="space-y-2">
                  {viewingExercise.instructions.map((step, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">
                        {idx + 1}
                      </span>
                      <span className="leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setViewingExercise(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Exercise Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-xl max-h-[90vh] rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden flex flex-col">
            <div className="p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950/40 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Dumbbell className="h-5 w-5 text-emerald-400" />
                Add Custom Movement
              </h3>
              <button onClick={onCloseAddModal} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateExercise} className="p-6 overflow-y-auto space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Exercise Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Deficit Trap Bar Deadlift"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-emerald-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Primary Muscle</label>
                  <select
                    value={formMuscle}
                    onChange={(e) => setFormMuscle(e.target.value as MuscleGroup)}
                    className="w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-hidden"
                  >
                    {muscles.filter(m => m !== 'All').map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Equipment</label>
                  <select
                    value={formEquipment}
                    onChange={(e) => setFormEquipment(e.target.value as Equipment)}
                    className="w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-hidden"
                  >
                    {equipments.filter(e => e !== 'All').map(e => (
                      <option key={e} value={e}>{e}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Difficulty</label>
                  <select
                    value={formDifficulty}
                    onChange={(e) => setFormDifficulty(e.target.value as Difficulty)}
                    className="w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-hidden"
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Description / Target Outcome</label>
                <textarea
                  rows={2}
                  placeholder="Primary stimulus, biomechanics notes, target muscle groups..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Technique Form Cues (Comma separated)</label>
                <input
                  type="text"
                  placeholder="e.g. Chest upright, drive floor away, knees tracking over toes"
                  value={formCues}
                  onChange={(e) => setFormCues(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-hidden"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onCloseAddModal}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 shadow-md transition-all"
                >
                  Add to Catalog
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

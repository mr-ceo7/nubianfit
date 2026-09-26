import React, { useMemo, useState } from 'react';
import { Check, PlayCircle, Search, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Exercise } from '../../types';

interface ExercisePickerProps {
  title?: string;
  onClose: () => void;
  onPick: (exercises: Exercise[]) => void;
}

/** Modal for choosing one or more exercises from the coach's library. */
export const ExercisePicker: React.FC<ExercisePickerProps> = ({ title = 'Add exercises', onClose, onPick }) => {
  const { exercises } = useApp();
  const [search, setSearch] = useState('');
  const [muscle, setMuscle] = useState('All');
  const [selected, setSelected] = useState<string[]>([]);

  const muscles = useMemo(() => ['All', ...Array.from(new Set(exercises.map(e => e.primaryMuscle))).sort()], [exercises]);
  const filtered = exercises.filter(e =>
    (muscle === 'All' || e.primaryMuscle === muscle) &&
    (e.name.toLowerCase().includes(search.toLowerCase()) || e.equipment.toLowerCase().includes(search.toLowerCase()))
  );

  const toggle = (id: string) => setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  const confirm = () => {
    // Keep the order the coach clicked them in.
    onPick(selected.map(id => exercises.find(e => e.id === id)).filter((e): e is Exercise => !!e));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-2xl h-[85vh] sm:h-[80vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">{title}</h3>
            <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search exercises or equipment…"
              aria-label="Search exercises"
              className="w-full h-9 pl-9 pr-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {muscles.map(m => (
              <button
                key={m}
                onClick={() => setMuscle(m)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${
                  muscle === m ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-100'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <ul className="flex-1 overflow-y-auto divide-y divide-slate-800">
          {filtered.length === 0 && <li className="p-6 text-center text-sm text-slate-400">No exercises match.</li>}
          {filtered.map(ex => {
            const isSelected = selected.includes(ex.id);
            return (
              <li key={ex.id}>
                <button onClick={() => toggle(ex.id)} className={`w-full px-4 py-3 flex items-center gap-3 text-left ${isSelected ? 'bg-emerald-500/10' : 'hover:bg-slate-800/50'}`}>
                  <span className={`h-5 w-5 rounded-md border flex items-center justify-center shrink-0 ${isSelected ? 'bg-emerald-500 border-emerald-500 text-slate-950' : 'border-slate-600'}`}>
                    {isSelected && <Check className="h-3.5 w-3.5" />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-white truncate">{ex.name}</span>
                    <span className="block text-xs text-slate-400">{ex.primaryMuscle} · {ex.equipment}</span>
                  </span>
                  {ex.videoUrl && <PlayCircle className="h-4 w-4 text-emerald-400 shrink-0" aria-label="Has video" />}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="p-4 border-t border-slate-800 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-400">{selected.length} selected</span>
          <button
            onClick={confirm}
            disabled={selected.length === 0}
            className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 text-sm font-bold"
          >
            Add {selected.length || ''} exercise{selected.length === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { WorkoutDraft, WorkoutEditor } from './WorkoutEditor';

interface WorkoutEditorSheetProps {
  heading: string;
  initial: WorkoutDraft;
  saveLabel?: string;
  onSave: (draft: WorkoutDraft) => Promise<boolean> | boolean;
  onClose: () => void;
  /** Extra actions shown on the left of the footer (e.g. delete). */
  footerStart?: React.ReactNode;
}

/** Full-screen sheet wrapping the workout editor with save/cancel. */
export const WorkoutEditorSheet: React.FC<WorkoutEditorSheetProps> = ({ heading, initial, saveLabel = 'Save workout', onSave, onClose, footerStart }) => {
  const [draft, setDraft] = useState<WorkoutDraft>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  const close = () => {
    if (dirty && !window.confirm('Discard your changes to this workout?')) return;
    onClose();
  };

  const save = async () => {
    if (!draft.title.trim()) {
      setError('Give the workout a name.');
      return;
    }
    setError(null);
    setSaving(true);
    const ok = await onSave({ ...draft, title: draft.title.trim() });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 sm:p-6">
      <div role="dialog" aria-modal="true" aria-label={heading} className="w-full max-w-3xl h-[94dvh] sm:h-[90vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-slate-950 border border-slate-800 shadow-2xl">
        <header className="px-4 sm:px-6 py-3.5 border-b border-slate-800 flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-white truncate">{heading}</h2>
          <button onClick={close} aria-label="Close" className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
          <WorkoutEditor draft={draft} onChange={setDraft} />
        </div>
        <footer className="px-4 sm:px-6 py-3 border-t border-slate-800 flex items-center gap-3">
          {footerStart}
          {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
          <div className="ml-auto flex gap-2">
            <button onClick={close} className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-semibold">
              Cancel
            </button>
            <button onClick={save} disabled={saving} className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-sm font-bold">
              {saving ? 'Saving…' : saveLabel}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

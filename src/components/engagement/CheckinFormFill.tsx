import React, { useState } from 'react';
import { Camera, Loader2, X } from 'lucide-react';
import { useEngagement } from '../../context/EngagementContext';
import { CheckinAnswer, CheckinAssignment, CheckinForm, CheckinQuestion } from '../../types';
import { formatDay } from '../../utils/dates';
import { compressImage } from '../../utils/image';

const field = 'w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500';

/** Client fills in a due check-in form. */
export const CheckinFormFill: React.FC<{ form: CheckinForm; assignment: CheckinAssignment; dueDate: string; onClose: () => void }> = ({
  form, assignment, dueDate, onClose,
}) => {
  const { submitCheckin } = useEngagement();
  const [answers, setAnswers] = useState<Record<string, CheckinAnswer>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (id: string, value: CheckinAnswer | undefined) =>
    setAnswers(a => {
      const next = { ...a };
      if (value === undefined || value === '') delete next[id];
      else next[id] = value;
      return next;
    });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing = form.questions.find(q => q.required && answers[q.id] === undefined);
    if (missing) {
      setError(`Please answer "${missing.label}".`);
      return;
    }
    setError(null);
    setSubmitting(true);
    const ok = await submitCheckin({ assignmentId: assignment.id, dueDate, answers });
    setSubmitting(false);
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 sm:p-6">
      <form role="dialog" aria-modal="true" aria-label={form.title} onSubmit={submit}
        className="w-full max-w-lg h-[94dvh] sm:h-[88vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-slate-900 border border-slate-800">
        <header className="p-4 border-b border-slate-800 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-white">{form.title}</h2>
            <p className="text-xs text-slate-400">Due {formatDay(dueDate)}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {form.description && <p className="text-sm text-slate-300">{form.description}</p>}
          {form.questions.map(q => (
            <QuestionInput
              key={q.id}
              question={q}
              clientId={assignment.clientId}
              value={answers[q.id]}
              preview={previews[q.id]}
              onChange={v => set(q.id, v)}
              onPreview={url => setPreviews(p => ({ ...p, [q.id]: url }))}
            />
          ))}
        </div>
        <footer className="p-4 border-t border-slate-800 space-y-2">
          {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
          <button type="submit" disabled={submitting} className="w-full h-11 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-sm font-bold">
            {submitting ? 'Sending…' : 'Send check-in'}
          </button>
        </footer>
      </form>
    </div>
  );
};

const QuestionInput: React.FC<{
  question: CheckinQuestion;
  clientId: string;
  value: CheckinAnswer | undefined;
  preview?: string;
  onChange: (v: CheckinAnswer | undefined) => void;
  onPreview: (url: string) => void;
}> = ({ question: q, clientId, value, preview, onChange, onPreview }) => {
  const { uploadPhoto } = useEngagement();
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const label = (
    <span className="block text-sm font-semibold text-white mb-1.5">
      {q.label}{q.required && <span className="text-red-400"> *</span>}
    </span>
  );
  const num = (v: string) => (v.trim() === '' ? undefined : Number(v));

  switch (q.type) {
    case 'text':
      return <label className="block">{label}<input className={field} value={(value as string) ?? ''} onChange={e => onChange(e.target.value)} maxLength={500} /></label>;
    case 'long_text':
      return (
        <label className="block">{label}
          <textarea rows={3} value={(value as string) ?? ''} onChange={e => onChange(e.target.value)} maxLength={5000}
            className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500" />
        </label>
      );
    case 'number':
    case 'weight':
      return (
        <label className="block">{label}
          <input className={field} inputMode="decimal" value={(value as number | undefined) ?? ''} placeholder={q.type === 'weight' ? 'kg' : ''}
            onChange={e => onChange(num(e.target.value.replace(/[^\d.]/g, '')))} />
          {q.type === 'weight' && <span className="block mt-1 text-[11px] text-slate-400">Also recorded in your progress.</span>}
        </label>
      );
    case 'scale': {
      const min = q.min ?? 1;
      const max = q.max ?? 10;
      return (
        <fieldset>
          <legend>{label}</legend>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: max - min + 1 }, (_, i) => min + i).map(n => (
              <button key={n} type="button" onClick={() => onChange(n)} aria-pressed={value === n}
                className={`h-10 min-w-10 px-2 rounded-xl text-sm font-bold ${value === n ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-100'}`}>
                {n}
              </button>
            ))}
          </div>
        </fieldset>
      );
    }
    case 'yes_no':
      return (
        <fieldset>
          <legend>{label}</legend>
          <div className="grid grid-cols-2 gap-2">
            {([true, false] as const).map(v => (
              <button key={String(v)} type="button" onClick={() => onChange(v)} aria-pressed={value === v}
                className={`h-10 rounded-xl text-sm font-bold ${value === v ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-100'}`}>
                {v ? 'Yes' : 'No'}
              </button>
            ))}
          </div>
        </fieldset>
      );
    case 'single_choice':
    case 'multi_choice': {
      const selected = q.type === 'multi_choice' ? ((value as string[]) ?? []) : value;
      return (
        <fieldset>
          <legend>{label}</legend>
          <div className="space-y-1.5">
            {q.options.map(o => {
              const on = q.type === 'multi_choice' ? (selected as string[]).includes(o) : selected === o;
              return (
                <button key={o} type="button" aria-pressed={on}
                  onClick={() => {
                    if (q.type === 'single_choice') onChange(o);
                    else {
                      const next = on ? (selected as string[]).filter(x => x !== o) : [...(selected as string[]), o];
                      onChange(next.length ? next : undefined);
                    }
                  }}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-semibold border ${on ? 'border-emerald-500 bg-emerald-500/10 text-white' : 'border-slate-800 bg-slate-950 text-slate-100'}`}>
                  {o}
                </button>
              );
            })}
          </div>
        </fieldset>
      );
    }
    case 'photo':
      return (
        <div>
          {label}
          {preview ? (
            <div className="relative">
              <img src={preview} alt={q.label} className="w-full max-h-72 object-contain rounded-xl bg-black" />
              <button type="button" onClick={() => { onChange(undefined); onPreview(''); }} aria-label="Remove photo"
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white"><X className="h-4 w-4" /></button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-2 h-32 rounded-xl border-2 border-dashed border-slate-700 text-slate-400 cursor-pointer hover:border-emerald-500">
              {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6" />}
              <span className="text-xs font-semibold">{uploading ? 'Uploading…' : 'Take or choose a photo'}</span>
              <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={uploading}
                onChange={async e => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  setPhotoError(null);
                  setUploading(true);
                  try {
                    const res = await uploadPhoto(clientId, await compressImage(file));
                    if (res) {
                      onChange({ fileId: res.id });
                      onPreview(res.url);
                    }
                  } catch (err) {
                    setPhotoError(err instanceof Error ? err.message : 'Upload failed');
                  } finally {
                    setUploading(false);
                  }
                }} />
            </label>
          )}
          {photoError && <p className="mt-1 text-xs text-red-400">{photoError}</p>}
        </div>
      );
  }
};

import React, { useState } from 'react';
import { ClipboardList, MessageSquare, Plus, Sparkles, Square, Target, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useEngagement } from '../../context/EngagementContext';
import { Autoflow, AutoflowStep, AutoflowStepType } from '../../types';
import { formatDay, localDateStr } from '../../utils/dates';
import { addDays } from '../../utils/nutrition';
import { newId } from '../../utils/workout';

const STEP_TYPES: { id: AutoflowStepType; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'message', label: 'Send a message', icon: MessageSquare },
  { id: 'checkin', label: 'Ask for a check-in', icon: ClipboardList },
  { id: 'habit', label: 'Add a habit', icon: Target },
];

const field = 'w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500';

type Draft = { id?: string; title: string; description: string; steps: AutoflowStep[] };

/** Coach's automated sequences: messages, check-ins and habits on set days after a start date. */
export const AutoflowHub: React.FC = () => {
  const { clients } = useApp();
  const { autoflows, autoflowAssignments, saveAutoflow, deleteAutoflow, cancelAutoflow } = useEngagement();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [assigning, setAssigning] = useState<Autoflow | null>(null);
  const [saving, setSaving] = useState(false);
  const name = (id: string) => clients.find(c => c.id === id)?.name ?? 'Client';

  if (draft) {
    const setStep = (i: number, patch: Partial<AutoflowStep>) =>
      setDraft({ ...draft, steps: draft.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
    const save = async () => {
      setSaving(true);
      const steps = [...draft.steps].sort((a, b) => a.day - b.day);
      const saved = await saveAutoflow({ title: draft.title.trim(), description: draft.description, steps }, draft.id);
      setSaving(false);
      if (saved) setDraft(null);
    };
    const lastDay = Math.max(0, ...draft.steps.map(s => s.day));
    return (
      <div className="space-y-4 max-w-3xl">
        <div className="flex items-center gap-2">
          <button onClick={() => setDraft(null)} className="px-3 py-2 rounded-xl bg-slate-800 text-slate-100 text-sm font-semibold">All autoflows</button>
          {draft.id && (
            <button onClick={async () => { if (window.confirm('Delete this autoflow? Running ones stop.') && await deleteAutoflow(draft.id!)) setDraft(null); }}
              className="ml-auto px-3 py-2 rounded-xl text-red-400 text-sm font-semibold hover:bg-slate-800">Delete</button>
          )}
          <button onClick={save} disabled={saving || !draft.title.trim() || draft.steps.length === 0}
            className={`${draft.id ? '' : 'ml-auto'} px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-sm font-bold`}>
            {saving ? 'Saving…' : 'Save autoflow'}
          </button>
        </div>
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3">
          <label className="block text-xs font-semibold text-slate-300">Name
            <input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. New client onboarding" className={`${field} mt-1`} />
          </label>
          <label className="block text-xs font-semibold text-slate-300">Description
            <input value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} className={`${field} mt-1`} />
          </label>
        </div>

        <ol className="relative space-y-3 border-l-2 border-slate-800 ml-3 pl-5">
          {draft.steps.map((s, i) => (
            <li key={s.id} className="relative rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-2.5">
              <span className="absolute -left-[31px] top-5 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-4 ring-slate-950" aria-hidden />
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">Day
                  <input type="number" min={1} max={365} value={s.day} onChange={e => setStep(i, { day: Math.max(1, Number(e.target.value) || 1) })}
                    className="w-16 h-8 px-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white" />
                </label>
                <select aria-label="Step type" value={s.type} onChange={e => setStep(i, { type: e.target.value as AutoflowStepType })}
                  className="h-8 px-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white">
                  {STEP_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
                <button onClick={() => setDraft({ ...draft, steps: draft.steps.filter((_, j) => j !== i) })} aria-label="Remove step" className="ml-auto p-1.5 text-slate-400 hover:text-red-400">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {s.type === 'message' && (
                <textarea rows={2} value={s.text ?? ''} onChange={e => setStep(i, { text: e.target.value })} placeholder="Message sent from you to the client"
                  aria-label="Message" className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white" />
              )}
              {s.type === 'checkin' && <CheckinStep formId={s.formId} onChange={formId => setStep(i, { formId })} />}
              {s.type === 'habit' && (
                <div className="grid grid-cols-[1fr_80px_80px] gap-2">
                  <input value={s.habit?.title ?? ''} onChange={e => setStep(i, { habit: { ...s.habit, title: e.target.value } })} placeholder="Habit, e.g. Drink 3 L of water" aria-label="Habit" className={field} />
                  <input inputMode="decimal" value={s.habit?.targetValue ?? ''} onChange={e => setStep(i, { habit: { title: s.habit?.title ?? '', ...s.habit, targetValue: e.target.value ? Number(e.target.value) : null } })} placeholder="Target" aria-label="Target" className={field} />
                  <input value={s.habit?.unit ?? ''} onChange={e => setStep(i, { habit: { title: s.habit?.title ?? '', ...s.habit, unit: e.target.value } })} placeholder="Unit" aria-label="Unit" className={field} />
                </div>
              )}
            </li>
          ))}
        </ol>
        <button onClick={() => setDraft({ ...draft, steps: [...draft.steps, { id: newId('step'), day: lastDay + 1, type: 'message', text: '' }] })}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 text-slate-100 text-sm font-semibold">
          <Plus className="h-4 w-4" /> Add step
        </button>
      </div>
    );
  }

  const running = autoflowAssignments.filter(a => a.active);
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-slate-400">Automate messages, check-ins and habits on set days after a client starts.</p>
        <button onClick={() => setDraft({ title: '', description: '', steps: [{ id: newId('step'), day: 1, type: 'message', text: '' }] })}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-bold shrink-0">
          <Plus className="h-4 w-4" /> New autoflow
        </button>
      </div>

      {autoflows.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-slate-800 p-10 text-center text-sm text-slate-300">No autoflows yet.</p>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {autoflows.map(f => (
            <div key={f.id} className="rounded-2xl bg-slate-900 border border-slate-800 p-4 flex flex-col gap-2 min-w-0">
              <Sparkles className="h-5 w-5 text-emerald-400" />
              <p className="text-sm font-bold text-white line-clamp-2">{f.title}</p>
              <p className="text-xs text-slate-400">{f.steps.length} steps over {Math.max(0, ...f.steps.map(s => s.day))} days</p>
              <div className="mt-auto flex gap-2 pt-2">
                <button onClick={() => setDraft({ id: f.id, title: f.title, description: f.description, steps: structuredClone(f.steps) })}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-100 text-xs font-semibold">Edit</button>
                <button onClick={() => setAssigning(f)} disabled={clients.length === 0}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-bold">Assign</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <section className="rounded-2xl bg-slate-900 border border-slate-800">
        <h3 className="px-4 py-3 border-b border-slate-800 text-sm font-bold text-white">Running ({running.length})</h3>
        {running.length === 0 && <p className="px-4 py-4 text-sm text-slate-400">No autoflows running.</p>}
        <ul className="divide-y divide-slate-800">
          {running.map(a => {
            const flow = autoflows.find(f => f.id === a.autoflowId);
            const total = flow?.steps.length ?? 0;
            const next = flow?.steps.filter(s => !a.completedStepIds.includes(s.id)).sort((x, y) => x.day - y.day)[0];
            return (
              <li key={a.id} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{name(a.clientId)} · {flow?.title ?? 'Autoflow'}</p>
                  <p className="text-xs text-slate-400">
                    {a.completedStepIds.length}/{total} steps done{next ? ` · next ${formatDay(addDays(a.startDate, next.day - 1))}` : ''}
                  </p>
                  <div className="mt-1.5 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${total ? (a.completedStepIds.length / total) * 100 : 0}%` }} />
                  </div>
                </div>
                <button onClick={() => window.confirm('Stop this autoflow? Steps already run stay.') && cancelAutoflow(a.id)}
                  aria-label="Stop autoflow" className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800">
                  <Square className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {assigning && <AssignDialog flow={assigning} onClose={() => setAssigning(null)} />}
    </div>
  );
};

const CheckinStep: React.FC<{ formId?: string; onChange: (id: string) => void }> = ({ formId, onChange }) => {
  const { forms } = useEngagement();
  if (forms.length === 0) return <p className="text-xs text-amber-400">Create a check-in form first (Check-ins tab).</p>;
  return (
    <select aria-label="Check-in form" value={formId ?? ''} onChange={e => onChange(e.target.value)} className={field}>
      <option value="">Choose a form…</option>
      {forms.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
    </select>
  );
};

const AssignDialog: React.FC<{ flow: Autoflow; onClose: () => void }> = ({ flow, onClose }) => {
  const { clients } = useApp();
  const { assignAutoflow } = useEngagement();
  const [clientId, setClientId] = useState(clients[0]?.id ?? '');
  const [startDate, setStartDate] = useState(localDateStr());
  const [saving, setSaving] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <form role="dialog" aria-modal="true" aria-label="Assign autoflow" onClick={e => e.stopPropagation()}
        onSubmit={async e => { e.preventDefault(); setSaving(true); const ok = await assignAutoflow(flow.id, clientId, startDate); setSaving(false); if (ok) onClose(); }}
        className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 p-5 space-y-3">
        <h3 className="text-sm font-bold text-white">Start “{flow.title}”</h3>
        <p className="text-xs text-slate-400">Day 1 is the start date. Steps due today run straight away.</p>
        <label className="block text-xs font-semibold text-slate-300">Client
          <select value={clientId} onChange={e => setClientId(e.target.value)} className={`${field} mt-1`}>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="block text-xs font-semibold text-slate-300">Start date
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={`${field} mt-1`} />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-100 text-sm font-semibold">Cancel</button>
          <button type="submit" disabled={saving || !clientId} className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-sm font-bold">
            {saving ? 'Starting…' : 'Start'}
          </button>
        </div>
      </form>
    </div>
  );
};

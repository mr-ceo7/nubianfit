import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ClipboardList, Pause, Play, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useEngagement } from '../../context/EngagementContext';
import { CheckinQuestion, QuestionType } from '../../types';
import { formatDay, localDateStr, timeAgo } from '../../utils/dates';
import { newId } from '../../utils/workout';
import { CheckinResponseView } from './CheckinResponseView';

const QUESTION_TYPES: { id: QuestionType; label: string }[] = [
  { id: 'weight', label: 'Body weight (kg)' },
  { id: 'scale', label: 'Scale (e.g. 1–10)' },
  { id: 'number', label: 'Number' },
  { id: 'text', label: 'Short answer' },
  { id: 'long_text', label: 'Long answer' },
  { id: 'single_choice', label: 'Multiple choice (one)' },
  { id: 'multi_choice', label: 'Checkboxes (many)' },
  { id: 'yes_no', label: 'Yes / No' },
  { id: 'photo', label: 'Progress photo' },
];

const field = 'w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500';

type Section = 'inbox' | 'forms' | 'schedules';

export const CheckinsHub: React.FC = () => {
  const [section, setSection] = useState<Section>('inbox');
  const { checkinResponses } = useEngagement();
  const unreviewed = checkinResponses.filter(r => !r.reviewedAt).length;

  return (
    <div className="space-y-5">
      <div className="inline-grid grid-cols-3 rounded-xl bg-slate-900 border border-slate-800 p-1 text-sm">
        {([['inbox', `Inbox${unreviewed ? ` (${unreviewed})` : ''}`], ['forms', 'Forms'], ['schedules', 'Schedules']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setSection(id)} aria-pressed={section === id}
            className={`px-3 sm:px-4 py-1.5 rounded-lg font-bold ${section === id ? 'bg-emerald-500 text-slate-950' : 'text-slate-300'}`}>
            {label}
          </button>
        ))}
      </div>
      {section === 'inbox' && <Inbox />}
      {section === 'forms' && <Forms />}
      {section === 'schedules' && <Schedules />}
    </div>
  );
};

const Inbox: React.FC = () => {
  const { clients } = useApp();
  const { checkinResponses, forms, reviewCheckin } = useEngagement();
  const [clientFilter, setClientFilter] = useState('All');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comment, setComment] = useState('');

  const list = useMemo(
    () => checkinResponses
      .filter(r => clientFilter === 'All' || r.clientId === clientFilter)
      .sort((a, b) => Number(!!a.reviewedAt) - Number(!!b.reviewedAt) || b.submittedAt.localeCompare(a.submittedAt)),
    [checkinResponses, clientFilter]
  );
  const selected = list.find(r => r.id === selectedId) ?? list[0];
  const name = (id: string) => clients.find(c => c.id === id)?.name ?? 'Client';
  const title = (formId: string) => forms.find(f => f.id === formId)?.title ?? 'Check-in';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 lg:items-start">
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="p-3 border-b border-slate-800">
          <select aria-label="Filter by client" value={clientFilter} onChange={e => setClientFilter(e.target.value)} className={field}>
            <option value="All">All clients</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <ul className="max-h-[60vh] overflow-y-auto divide-y divide-slate-800">
          {list.length === 0 && <li className="p-5 text-sm text-slate-400">No check-ins yet.</li>}
          {list.map(r => (
            <li key={r.id}>
              <button onClick={() => { setSelectedId(r.id); setComment(r.coachComment); }}
                className={`w-full text-left px-4 py-3 flex gap-3 ${selected?.id === r.id ? 'bg-slate-800/80' : 'hover:bg-slate-800/40'}`}>
                <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${r.reviewedAt ? 'bg-transparent' : 'bg-amber-400'}`} aria-label={r.reviewedAt ? 'Reviewed' : 'Needs review'} />
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-white truncate">{name(r.clientId)}</span>
                  <span className="block text-xs text-slate-400 truncate">{title(r.formId)} · {timeAgo(r.submittedAt)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {selected ? (
        <section className="rounded-2xl bg-slate-900 border border-slate-800 p-4 sm:p-5 space-y-4">
          <header>
            <h3 className="text-base font-bold text-white">{name(selected.clientId)} · {title(selected.formId)}</h3>
            <p className="text-xs text-slate-400">For {formatDay(selected.dueDate)} · submitted {timeAgo(selected.submittedAt)}</p>
          </header>
          <CheckinResponseView response={{ ...selected, coachComment: '' }} />
          <form
            onSubmit={async e => { e.preventDefault(); await reviewCheckin(selected.id, comment); }}
            className="space-y-2 pt-3 border-t border-slate-800"
          >
            <label className="block text-xs font-semibold text-slate-300">Your feedback (sent to the client)
              <textarea rows={3} value={comment} onChange={e => setComment(e.target.value)}
                className="mt-1 w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white" />
            </label>
            <div className="flex items-center gap-3">
              {selected.reviewedAt && <span className="text-xs text-emerald-400">Reviewed {timeAgo(selected.reviewedAt)}</span>}
              <button type="submit" className="ml-auto px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-bold">
                {selected.reviewedAt ? 'Update review' : 'Mark reviewed'}
              </button>
            </div>
          </form>
        </section>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-800 p-10 text-center text-sm text-slate-400">
          Check-ins your clients submit appear here.
        </div>
      )}
    </div>
  );
};

const blankQuestion = (type: QuestionType = 'scale'): CheckinQuestion => ({
  id: newId('q'), type, label: '', required: false, options: type.endsWith('choice') ? ['', ''] : [],
  min: type === 'scale' ? 1 : null, max: type === 'scale' ? 10 : null, view: type === 'photo' ? 'Front' : null,
});

const Forms: React.FC = () => {
  const { forms, saveForm, deleteForm } = useEngagement();
  const [draft, setDraft] = useState<{ id?: string; title: string; description: string; questions: CheckinQuestion[] } | null>(null);
  const [saving, setSaving] = useState(false);

  if (!draft) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <button onClick={() => setDraft({ title: '', description: '', questions: [blankQuestion('weight'), blankQuestion('scale')] })}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-bold">
            <Plus className="h-4 w-4" /> New form
          </button>
        </div>
        {forms.length === 0 && <p className="rounded-3xl border border-dashed border-slate-800 p-10 text-center text-sm text-slate-300">No forms yet.</p>}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {forms.map(f => (
            <button key={f.id} onClick={() => setDraft({ id: f.id, title: f.title, description: f.description, questions: structuredClone(f.questions) })}
              className="text-left rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 p-4 min-w-0">
              <ClipboardList className="h-5 w-5 text-emerald-400" />
              <p className="mt-2 text-sm font-bold text-white line-clamp-2">{f.title}</p>
              <p className="text-xs text-slate-400">{f.questions.length} questions</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const setQ = (i: number, patch: Partial<CheckinQuestion>) =>
    setDraft({ ...draft, questions: draft.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) });
  const move = (i: number, d: -1 | 1) => {
    const qs = [...draft.questions];
    [qs[i], qs[i + d]] = [qs[i + d], qs[i]];
    setDraft({ ...draft, questions: qs });
  };
  const save = async () => {
    const questions = draft.questions.map(q => ({ ...q, label: q.label.trim(), options: q.options.map(o => o.trim()).filter(Boolean) }));
    setSaving(true);
    const saved = await saveForm({ title: draft.title.trim(), description: draft.description, questions }, draft.id);
    setSaving(false);
    if (saved) setDraft(null);
  };
  const valid = draft.title.trim() && draft.questions.length > 0 && draft.questions.every(q => q.label.trim());

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-2">
        <button onClick={() => setDraft(null)} className="px-3 py-2 rounded-xl bg-slate-800 text-slate-100 text-sm font-semibold">All forms</button>
        {draft.id && (
          <button onClick={async () => { if (window.confirm('Delete this form? Its schedules stop; past answers are kept.') && await deleteForm(draft.id!)) setDraft(null); }}
            className="ml-auto px-3 py-2 rounded-xl text-red-400 text-sm font-semibold hover:bg-slate-800">Delete</button>
        )}
        <button onClick={save} disabled={!valid || saving} className={`${draft.id ? '' : 'ml-auto'} px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-sm font-bold`}>
          {saving ? 'Saving…' : 'Save form'}
        </button>
      </div>
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3">
        <label className="block text-xs font-semibold text-slate-300">Form title
          <input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Weekly check-in" className={`${field} mt-1`} />
        </label>
        <label className="block text-xs font-semibold text-slate-300">Intro for the client
          <input value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} className={`${field} mt-1`} />
        </label>
      </div>
      {draft.questions.map((q, i) => (
        <div key={q.id} className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400">Q{i + 1}</span>
            <select aria-label="Question type" value={q.type} onChange={e => setQ(i, { ...blankQuestion(e.target.value as QuestionType), id: q.id, label: q.label, required: q.required })}
              className="h-8 px-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white">
              {QUESTION_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-slate-300">
              <input type="checkbox" className="accent-emerald-500" checked={q.required} onChange={e => setQ(i, { required: e.target.checked })} /> Required
            </label>
            <div className="ml-auto flex">
              <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="p-1.5 text-slate-400 disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
              <button onClick={() => move(i, 1)} disabled={i === draft.questions.length - 1} aria-label="Move down" className="p-1.5 text-slate-400 disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
              <button onClick={() => setDraft({ ...draft, questions: draft.questions.filter((_, j) => j !== i) })} aria-label="Remove question" className="p-1.5 text-slate-400 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
          <input value={q.label} onChange={e => setQ(i, { label: e.target.value })} placeholder="Question" aria-label="Question text" className={field} />
          {q.type.endsWith('choice') && (
            <div className="space-y-1.5">
              {q.options.map((o, k) => (
                <div key={k} className="flex gap-2">
                  <input value={o} onChange={e => setQ(i, { options: q.options.map((x, m) => (m === k ? e.target.value : x)) })} placeholder={`Option ${k + 1}`} aria-label={`Option ${k + 1}`} className={field} />
                  <button onClick={() => setQ(i, { options: q.options.filter((_, m) => m !== k) })} disabled={q.options.length <= 2} aria-label="Remove option" className="px-2 text-slate-400 disabled:opacity-30"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              <button onClick={() => setQ(i, { options: [...q.options, ''] })} className="text-xs font-semibold text-emerald-400">+ Add option</button>
            </div>
          )}
          {(q.type === 'scale' || q.type === 'number') && (
            <div className="grid grid-cols-2 gap-2 max-w-xs">
              <label className="text-[11px] text-slate-400">Min<input type="number" value={q.min ?? ''} onChange={e => setQ(i, { min: e.target.value === '' ? null : Number(e.target.value) })} className={`${field} mt-1`} /></label>
              <label className="text-[11px] text-slate-400">Max<input type="number" value={q.max ?? ''} onChange={e => setQ(i, { max: e.target.value === '' ? null : Number(e.target.value) })} className={`${field} mt-1`} /></label>
            </div>
          )}
          {q.type === 'photo' && (
            <label className="text-[11px] text-slate-400">Saved to progress photos as
              <select value={q.view ?? 'Front'} onChange={e => setQ(i, { view: e.target.value as CheckinQuestion['view'] })} className={`${field} mt-1 max-w-40`}>
                {['Front', 'Side', 'Back'].map(v => <option key={v}>{v}</option>)}
              </select>
            </label>
          )}
          {q.type === 'weight' && <p className="text-[11px] text-slate-400">Answers are also saved to the client's weight history.</p>}
        </div>
      ))}
      <button onClick={() => setDraft({ ...draft, questions: [...draft.questions, blankQuestion('long_text')] })}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 text-slate-100 text-sm font-semibold">
        <Plus className="h-4 w-4" /> Add question
      </button>
    </div>
  );
};

const Schedules: React.FC = () => {
  const { clients } = useApp();
  const { forms, checkinAssignments, assignForm, setAssignmentActive, deleteAssignment } = useEngagement();
  const [clientId, setClientId] = useState(clients[0]?.id ?? '');
  const [formId, setFormId] = useState(forms[0]?.id ?? '');
  const [frequency, setFrequency] = useState<'weekly' | 'once'>('weekly');
  const [startDate, setStartDate] = useState(localDateStr());
  // Lists may arrive after the first render; fall back to the first entry.
  const chosenClient = clientId || clients[0]?.id || '';
  const chosenForm = formId || forms[0]?.id || '';
  const name = (id: string) => clients.find(c => c.id === id)?.name ?? 'Client';
  const title = (id: string) => forms.find(f => f.id === id)?.title ?? 'Form';
  const rows = [...checkinAssignments].sort((a, b) => name(a.clientId).localeCompare(name(b.clientId)));

  return (
    <div className="space-y-4">
      <form
        onSubmit={async e => { e.preventDefault(); if (chosenClient && chosenForm) await assignForm({ clientId: chosenClient, formId: chosenForm, frequency, startDate }); }}
        className="rounded-2xl bg-slate-900 border border-slate-800 p-4 grid grid-cols-2 lg:grid-cols-5 gap-2 items-end"
      >
        <label className="text-xs font-semibold text-slate-300">Client
          <select value={chosenClient} onChange={e => setClientId(e.target.value)} className={`${field} mt-1`}>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-300">Form
          <select value={chosenForm} onChange={e => setFormId(e.target.value)} className={`${field} mt-1`}>
            {forms.length === 0 && <option value="">Create a form first</option>}
            {forms.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-300">Repeat
          <select value={frequency} onChange={e => setFrequency(e.target.value as 'weekly' | 'once')} className={`${field} mt-1`}>
            <option value="weekly">Every week</option>
            <option value="once">Once</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-300">{frequency === 'weekly' ? 'First due' : 'Due'}
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={`${field} mt-1`} />
        </label>
        <button type="submit" disabled={!chosenClient || !chosenForm} className="col-span-2 lg:col-span-1 h-9 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-sm font-bold">
          Schedule
        </button>
      </form>

      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-slate-400 text-left">
              <th className="px-4 py-2 font-bold">Client</th><th className="px-4 py-2 font-bold">Form</th>
              <th className="px-4 py-2 font-bold">Repeat</th><th className="px-4 py-2 font-bold">Status</th><th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">No check-ins scheduled.</td></tr>}
            {rows.map(a => (
              <tr key={a.id} className="border-t border-slate-800">
                <td className="px-4 py-2.5 font-semibold text-white whitespace-nowrap">{name(a.clientId)}</td>
                <td className="px-4 py-2.5 text-slate-300">{title(a.formId)}</td>
                <td className="px-4 py-2.5 text-slate-300 whitespace-nowrap">{a.frequency === 'weekly' ? `Weekly from ${formatDay(a.startDate)}` : `Once, ${formatDay(a.startDate)}`}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  {!a.active ? <span className="text-slate-400">Paused</span>
                    : a.pendingDueDate ? <span className="text-amber-400 font-semibold">Due {formatDay(a.pendingDueDate)}</span>
                    : a.nextDueDate ? <span className="text-slate-300">Next {formatDay(a.nextDueDate)}</span>
                    : <span className="text-emerald-400">Done</span>}
                </td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap">
                  <button onClick={() => setAssignmentActive(a.id, !a.active)} aria-label={a.active ? 'Pause' : 'Resume'} className="p-1.5 text-slate-400 hover:text-white">
                    {a.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </button>
                  <button onClick={() => window.confirm('Remove this schedule?') && deleteAssignment(a.id)} aria-label="Remove schedule" className="p-1.5 text-slate-400 hover:text-red-400">
                    <Trash2 className="h-4 w-4" />
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


import React, { useState } from 'react';
import { Trophy } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Client } from '../../types';
import { formatDay, localDateStr } from '../../utils/dates';

export const ClientProgress: React.FC<{ client: Client }> = ({ client }) => {
  const { metrics, personalRecords, addMetricEntry } = useApp();
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [waist, setWaist] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const history = [...metrics].sort((a, b) => b.date.localeCompare(a.date));
  const change = client.currentWeightKg - client.startingWeightKg;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const weightKg = parseFloat(weight);
    if (!weightKg) return;
    setSaving(true);
    const ok = await addMetricEntry({
      clientId: client.id,
      date: localDateStr(),
      weightKg,
      bodyFatPercentage: bodyFat ? parseFloat(bodyFat) : undefined,
      waistCm: waist ? parseFloat(waist) : undefined,
      notes: notes || undefined,
    });
    setSaving(false);
    if (ok) {
      setWeight('');
      setBodyFat('');
      setWaist('');
      setNotes('');
    }
  };

  const field = 'w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500';

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start [&>*]:min-w-0">
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-2.5">
          <Tile label="Current" value={`${client.currentWeightKg} kg`} />
          <Tile label="Change" value={`${change > 0 ? '+' : ''}${change.toFixed(1)} kg`} />
          <Tile label="Goal" value={`${client.targetWeightKg} kg`} />
        </div>

        <form onSubmit={submit} className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3">
          <h2 className="text-sm font-bold text-white">Check in</h2>
          <div className="grid grid-cols-3 gap-2">
            <label className="text-[11px] text-slate-400">Weight (kg)
              <input className={field} inputMode="decimal" value={weight} onChange={e => setWeight(e.target.value)} required />
            </label>
            <label className="text-[11px] text-slate-400">Body fat %
              <input className={field} inputMode="decimal" value={bodyFat} onChange={e => setBodyFat(e.target.value)} />
            </label>
            <label className="text-[11px] text-slate-400">Waist (cm)
              <input className={field} inputMode="decimal" value={waist} onChange={e => setWaist(e.target.value)} />
            </label>
          </div>
          <textarea className={field} rows={2} placeholder="How are you feeling? (optional)" value={notes} onChange={e => setNotes(e.target.value)} />
          <button type="submit" disabled={saving || !weight} className="w-full rounded-xl bg-emerald-500 disabled:opacity-50 text-slate-950 font-bold text-sm py-2.5">
            {saving ? 'Saving…' : 'Submit check-in'}
          </button>
        </form>
      </div>

      <div className="space-y-5">
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Personal records</h2>
          <div className="rounded-2xl bg-slate-900 border border-slate-800 divide-y divide-slate-800">
            {personalRecords.length === 0 && <p className="p-4 text-sm text-slate-400">Beat a previous best in a workout and it shows up here.</p>}
            {personalRecords.slice(0, 10).map(pr => (
              <div key={pr.id} className="p-3.5 flex items-center gap-3">
                <Trophy className="h-4 w-4 text-amber-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{pr.exerciseName}</p>
                  <p className="text-xs text-slate-400">{pr.weightKg} kg × {pr.reps} · est. 1RM {pr.estimated1RmKg} kg</p>
                </div>
                <span className="text-[11px] text-slate-400 shrink-0">{formatDay(pr.date)}</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Check-in history</h2>
          <div className="rounded-2xl bg-slate-900 border border-slate-800 divide-y divide-slate-800">
            {history.length === 0 && <p className="p-4 text-sm text-slate-400">No check-ins yet.</p>}
            {history.map(m => (
              <div key={m.id} className="p-3.5 flex items-center justify-between gap-3">
                <span className="text-sm text-slate-300">{formatDay(m.date)}</span>
                <span className="text-sm font-bold text-white">
                  {m.weightKg} kg{m.bodyFatPercentage ? <span className="text-slate-400 font-normal"> · {m.bodyFatPercentage}%</span> : null}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

const Tile: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-2xl bg-slate-900 border border-slate-800 p-3">
    <p className="text-base sm:text-xl font-extrabold text-white whitespace-nowrap">{value}</p>
    <p className="text-[11px] text-slate-400">{label}</p>
  </div>
);

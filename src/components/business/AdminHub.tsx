import React, { useCallback, useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { adminApi, AdminCoach } from '../../services/apiClient';
import { formatDay } from '../../utils/dates';
import { formatMoney } from '../../utils/money';

type Summary = Awaited<ReturnType<typeof adminApi.summary>>;
type AdminPayment = Awaited<ReturnType<typeof adminApi.payments>>[number];

const card = 'rounded-2xl bg-slate-900 border border-slate-800';

/** Platform admin: every coach on the marketplace, suspensions and platform-wide payments. */
export const AdminHub: React.FC = () => {
  const { showToast } = useApp();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [coaches, setCoaches] = useState<AdminCoach[]>([]);
  const [payments, setPayments] = useState<AdminPayment[]>([]);

  const load = useCallback(async () => {
    try {
      const [s, c, p] = await Promise.all([adminApi.summary(), adminApi.coaches(), adminApi.payments()]);
      setSummary(s);
      setCoaches(c);
      setPayments(p);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not load admin data');
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (c: AdminCoach) => {
    const verb = c.active ? 'Suspend' : 'Reactivate';
    if (!window.confirm(`${verb} ${c.name}? ${c.active ? 'They will be signed out and their clients will not be able to pay them.' : ''}`)) return;
    try {
      await adminApi.setCoachActive(c.id, !c.active);
      showToast(`${c.name} ${c.active ? 'suspended' : 'reactivated'}.`);
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update coach');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-400" /><h2 className="text-lg font-extrabold text-white">Platform admin</h2></div>
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            ['Coaches', String(summary.coaches)],
            ['Clients', String(summary.clients)],
            ['Volume, last 30 days', formatMoney(summary.volume30d, summary.currency)],
            [`Platform fees (${summary.platformFeePercent}%)`, formatMoney(summary.platformFees30d, summary.currency)],
          ].map(([label, value]) => (
            <div key={label} className={`${card} p-3.5 min-w-0`}>
              <p className="text-[11px] font-semibold text-slate-400 truncate">{label}</p>
              <p className="text-lg sm:text-2xl font-extrabold text-white whitespace-nowrap">{value}</p>
            </div>
          ))}
        </div>
      )}

      <section className={`${card} overflow-x-auto`}>
        <h3 className="px-4 py-3 text-sm font-bold text-white border-b border-slate-800">Coaches</h3>
        <table className="w-full text-sm">
          <thead><tr className="text-[11px] uppercase tracking-wider text-slate-400 text-left">
            <th className="px-4 py-2 font-bold">Coach</th><th className="px-4 py-2 font-bold">Clients</th><th className="px-4 py-2 font-bold">Volume (30 d)</th>
            <th className="px-4 py-2 font-bold">Payouts</th><th className="px-4 py-2 font-bold">Joined</th><th className="px-4 py-2" />
          </tr></thead>
          <tbody>
            {coaches.map(c => (
              <tr key={c.id} className="border-t border-slate-800">
                <td className="px-4 py-2.5">
                  <p className="font-semibold text-white">{c.name}{c.isAdmin && <span className="ml-1.5 text-[10px] font-bold text-emerald-400">ADMIN</span>}</p>
                  <p className="text-xs text-slate-400">{c.email}</p>
                </td>
                <td className="px-4 py-2.5 text-slate-300">{c.clients}</td>
                <td className="px-4 py-2.5 text-slate-300 whitespace-nowrap">{formatMoney(c.volume30d)}</td>
                <td className="px-4 py-2.5">{c.payoutReady ? <span className="text-emerald-400 font-semibold">Connected</span> : <span className="text-slate-400">Not set up</span>}</td>
                <td className="px-4 py-2.5 text-slate-300 whitespace-nowrap">{c.joinedAt ? formatDay(c.joinedAt.slice(0, 10)) : '—'}</td>
                <td className="px-4 py-2.5 text-right">
                  {!c.isAdmin && (
                    <button onClick={() => toggle(c)} className={`text-xs font-semibold ${c.active ? 'text-red-400' : 'text-emerald-400'}`}>
                      {c.active ? 'Suspend' : 'Reactivate'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={`${card} overflow-x-auto`}>
        <h3 className="px-4 py-3 text-sm font-bold text-white border-b border-slate-800">Recent payments</h3>
        <table className="w-full text-sm">
          <thead><tr className="text-[11px] uppercase tracking-wider text-slate-400 text-left">
            <th className="px-4 py-2 font-bold">Date</th><th className="px-4 py-2 font-bold">Coach</th><th className="px-4 py-2 font-bold">Amount</th>
            <th className="px-4 py-2 font-bold">Method</th><th className="px-4 py-2 font-bold">Status</th><th className="px-4 py-2 font-bold">Reference</th>
          </tr></thead>
          <tbody>
            {payments.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">No payments yet.</td></tr>}
            {payments.map(p => (
              <tr key={p.id} className="border-t border-slate-800">
                <td className="px-4 py-2.5 text-slate-300 whitespace-nowrap">{formatDay((p.paidAt ?? p.createdAt).slice(0, 10))}</td>
                <td className="px-4 py-2.5 text-white">{p.coachName}</td>
                <td className="px-4 py-2.5 text-white font-semibold whitespace-nowrap">{formatMoney(p.amount, p.currency)}</td>
                <td className="px-4 py-2.5 text-slate-300 capitalize">{p.channel.replace('_', ' ') || '—'}</td>
                <td className={`px-4 py-2.5 font-semibold capitalize ${p.status === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>{p.status}</td>
                <td className="px-4 py-2.5 text-slate-400 font-mono text-xs">{p.reference}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
};

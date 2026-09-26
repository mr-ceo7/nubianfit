import React, { useCallback, useEffect, useState } from 'react';
import { CreditCard } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { billingApi } from '../../services/apiClient';
import { formatDay } from '../../utils/dates';
import { formatMoney } from '../../utils/money';

type Billing = Awaited<ReturnType<typeof billingApi.mine>>;

/** Client's plan, open payment links and payment history. */
export const ClientBilling: React.FC = () => {
  const { showToast } = useApp();
  const [data, setData] = useState<Billing | null>(null);

  const load = useCallback(() => {
    billingApi.mine().then(setData).catch(() => setData(null));
  }, []);
  useEffect(load, [load]);

  if (!data || (data.subscriptions.length === 0 && data.paymentRequests.length === 0 && data.payments.length === 0)) return null;
  const title = (id: string) => data.packages[id]?.title ?? 'Coaching';

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      showToast(msg);
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Something went wrong');
    }
  };

  return (
    <section className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-4">
      <div className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-emerald-400" /><h2 className="text-sm font-bold text-white">Plan & billing</h2></div>

      {data.paymentRequests.map(r => (
        <div key={r.id} className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{r.purpose === 'renewal' ? 'Renewal due' : 'Payment requested'} · {title(r.packageId)}</p>
            <p className="text-xs text-slate-300">{formatMoney(r.amount, r.currency)}</p>
          </div>
          <a href={r.url} className="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 text-xs font-bold">Pay now</a>
        </div>
      ))}

      {data.subscriptions.map(s => {
        const live = s.status === 'active' || s.status === 'past_due';
        return (
          <div key={s.id} className="text-sm space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-white">{title(s.packageId)}</span>
              <span className={`text-xs font-semibold ${s.status === 'active' ? 'text-emerald-400' : s.status === 'past_due' ? 'text-amber-400' : 'text-slate-400'}`}>
                {s.status === 'past_due' ? 'Payment due' : s.status === 'active' ? 'Active' : s.status === 'completed' ? 'Finished' : 'Cancelled'}
              </span>
            </div>
            {live && (
              <p className="text-xs text-slate-400">
                {s.cancelAtPeriodEnd || data.packages[s.packageId]?.billing === 'one_time'
                  ? `Ends ${formatDay(s.currentPeriodEnd)}`
                  : s.autoRenew ? `Renews ${formatDay(s.currentPeriodEnd)} · ${s.cardLabel}` : `Next payment due ${formatDay(s.currentPeriodEnd)}`}
              </p>
            )}
            {live && data.packages[s.packageId]?.billing === 'recurring' && (
              s.cancelAtPeriodEnd
                ? <button onClick={() => act(() => billingApi.resumeSubscription(s.id), 'Your plan will renew.')} className="text-xs font-semibold text-emerald-400">Keep my plan</button>
                : <button onClick={() => window.confirm(`Cancel ${title(s.packageId)}? You keep access until ${formatDay(s.currentPeriodEnd)}.`) && act(() => billingApi.cancelSubscription(s.id), 'Plan cancelled at period end.')}
                    className="text-xs font-semibold text-red-400">Cancel plan</button>
            )}
          </div>
        );
      })}

      {data.payments.length > 0 && (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Payments</p>
          <ul className="divide-y divide-slate-800 text-sm">
            {data.payments.slice(0, 6).map(p => (
              <li key={p.id} className="py-1.5 flex justify-between gap-2">
                <span className="text-slate-300">{formatDay((p.paidAt ?? p.createdAt).slice(0, 10))} · {title(p.packageId)}</span>
                <span className="text-white font-semibold whitespace-nowrap">{formatMoney(p.amount, p.currency)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

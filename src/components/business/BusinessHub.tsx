import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Copy, Landmark, Pencil, Plus, Send, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useEngagement } from '../../context/EngagementContext';
import { billingApi } from '../../services/apiClient';
import { BusinessAnalytics, Package, Payment, PaymentRequest, PayoutAccount, Subscription } from '../../types';
import { formatDay } from '../../utils/dates';
import { describeBilling, formatMoney } from '../../utils/money';
import { RevenueChart } from './RevenueChart';

type Section = 'overview' | 'packages' | 'clients' | 'payments' | 'payouts';

const field = 'w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500';
const card = 'rounded-2xl bg-slate-900 border border-slate-800';

interface BusinessData {
  analytics: BusinessAnalytics | null;
  account: PayoutAccount | null;
  packages: Package[];
  requests: PaymentRequest[];
  subscriptions: Subscription[];
  payments: Payment[];
}

/** Coach's business: analytics, packages, payment links, subscriptions, payments and payouts. */
export const BusinessHub: React.FC = () => {
  const { showToast } = useApp();
  const [section, setSection] = useState<Section>('overview');
  const [data, setData] = useState<BusinessData>({ analytics: null, account: null, packages: [], requests: [], subscriptions: [], payments: [] });
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const [analytics, account, packages, requests, subscriptions, payments] = await Promise.all([
        billingApi.analytics(), billingApi.payoutAccount(), billingApi.packages(), billingApi.paymentRequests(),
        billingApi.subscriptions(), billingApi.payments(),
      ]);
      setData({ analytics, account, packages, requests, subscriptions, payments });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not load business data');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { reload(); }, [reload]);

  const run = async <T,>(action: () => Promise<T>, success?: string): Promise<T | null> => {
    try {
      const result = await action();
      if (success) showToast(success);
      await reload();
      return result;
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Something went wrong');
      return null;
    }
  };

  const tabs: [Section, string][] = [['overview', 'Overview'], ['packages', 'Packages'], ['clients', 'Clients & links'], ['payments', 'Payments'], ['payouts', 'Payouts']];

  return (
    <div className="space-y-5">
      <div className="flex overflow-x-auto rounded-xl bg-slate-900 border border-slate-800 p-1 text-sm w-fit max-w-full">
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setSection(id)} aria-pressed={section === id}
            className={`px-3 sm:px-4 py-1.5 rounded-lg font-bold whitespace-nowrap ${section === id ? 'bg-emerald-500 text-slate-950' : 'text-slate-300'}`}>
            {label}
          </button>
        ))}
      </div>

      {!loading && !data.account && section !== 'payouts' && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
          <p className="flex-1 text-sm text-slate-100">Connect a payout account so clients can pay you. Payments settle directly to your bank via Paystack.</p>
          <button onClick={() => setSection('payouts')} className="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 text-xs font-bold">Set up</button>
        </div>
      )}

      {loading ? <p className="text-sm text-slate-400">Loading…</p> : (
        <>
          {section === 'overview' && data.analytics && <Overview a={data.analytics} />}
          {section === 'packages' && <Packages packages={data.packages} run={run} />}
          {section === 'clients' && <ClientsAndLinks data={data} run={run} />}
          {section === 'payments' && <Payments payments={data.payments} packages={data.packages} />}
          {section === 'payouts' && <Payouts account={data.account} run={run} />}
        </>
      )}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; hint?: string; tone?: 'up' | 'down' | 'warn' }> = ({ label, value, hint, tone }) => (
  <div className={`${card} p-3.5 min-w-0`}>
    <p className="text-[11px] font-semibold text-slate-400 truncate">{label}</p>
    <p className="text-lg sm:text-2xl font-extrabold text-white whitespace-nowrap">{value}</p>
    {hint && <p className={`text-[11px] truncate ${tone === 'up' ? 'text-emerald-400' : tone === 'down' || tone === 'warn' ? 'text-amber-400' : 'text-slate-400'}`}>{hint}</p>}
  </div>
);

const Overview: React.FC<{ a: BusinessAnalytics }> = ({ a }) => {
  const delta = a.revenuePrev30d ? Math.round(((a.revenue30d - a.revenuePrev30d) / a.revenuePrev30d) * 100) : null;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Revenue, last 30 days" value={formatMoney(a.revenue30d)}
          hint={delta === null ? undefined : `${delta >= 0 ? '+' : ''}${delta}% vs previous 30 days`} tone={delta !== null && delta < 0 ? 'down' : 'up'} />
        <Stat label="Monthly recurring revenue" value={formatMoney(a.mrr)} hint={`${a.activeSubscriptions} active subscription${a.activeSubscriptions === 1 ? '' : 's'}`} />
        <Stat label="Past due" value={String(a.pastDueSubscriptions)} hint={a.pastDueSubscriptions ? 'Renewal links sent' : 'All paid up'} tone={a.pastDueSubscriptions ? 'warn' : undefined} />
        <Stat label="Unpaid links" value={String(a.pendingRequests)} hint={`${a.cancelled30d} cancelled in 30 days`} />
      </div>
      <section className={`${card} p-4 sm:p-5`}>
        <h3 className="text-sm font-bold text-white">Revenue by month</h3>
        <p className="text-xs text-slate-400 mb-3">Successful payments, before Paystack fees.</p>
        <RevenueChart data={a.revenueByMonth} currency="KES" />
      </section>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Active clients" value={`${a.activeClients} / ${a.totalClients}`} />
        <Stat label="Average compliance" value={`${a.avgCompliance}%`} />
        <Stat label="Workouts completed" value={String(a.workoutsCompleted30d)} hint="Last 30 days" />
        <Stat label="Check-ins submitted" value={String(a.checkinsSubmitted30d)} hint="Last 30 days" />
      </div>
    </div>
  );
};

type Run = <T,>(action: () => Promise<T>, success?: string) => Promise<T | null>;
type PackageDraft = Omit<Package, 'id' | 'createdAt'> & { id?: string; currency?: string };

const Packages: React.FC<{ packages: Package[]; run: Run }> = ({ packages, run }) => {
  const { programs } = useApp();
  const { autoflows, forms } = useEngagement();
  const [draft, setDraft] = useState<PackageDraft | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const { id, ...body } = draft;
    const clean = {
      ...body,
      currency: (body.currency || 'KES').toUpperCase(),
      interval: body.billing === 'recurring' ? body.interval ?? 'monthly' : null,
      durationWeeks: body.billing === 'one_time' ? body.durationWeeks ?? 12 : null,
      programId: body.programId || null, autoflowId: body.autoflowId || null, onboardingFormId: body.onboardingFormId || null,
    };
    const ok = await run(() => (id ? billingApi.updatePackage(id, clean) : billingApi.createPackage(clean)), 'Package saved.');
    if (ok) setDraft(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setDraft({ title: '', description: '', price: 5000, currency: 'KES', billing: 'recurring', interval: 'monthly', durationWeeks: null, active: true })}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-bold">
          <Plus className="h-4 w-4" /> New package
        </button>
      </div>
      {packages.length === 0 && <p className="rounded-3xl border border-dashed border-slate-800 p-10 text-center text-sm text-slate-300">Create your first coaching package.</p>}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {packages.map(p => (
          <article key={p.id} className={`${card} p-4 flex flex-col gap-1.5 min-w-0 ${p.active ? '' : 'opacity-60'}`}>
            <div className="flex items-start gap-2">
              <h3 className="flex-1 text-sm font-bold text-white line-clamp-2">{p.title}</h3>
              <button onClick={() => setDraft({ ...p })} aria-label={`Edit ${p.title}`} className="p-1 text-slate-400 hover:text-white"><Pencil className="h-3.5 w-3.5" /></button>
            </div>
            <p className="text-lg font-extrabold text-white">{formatMoney(p.price, p.currency)}</p>
            <p className="text-xs text-slate-400">{describeBilling(p)}</p>
            {!p.active && <p className="text-xs font-semibold text-amber-400">Archived</p>}
          </article>
        ))}
      </div>

      {draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setDraft(null)}>
          <form role="dialog" aria-modal="true" aria-label={draft.id ? 'Edit package' : 'New package'} onSubmit={save} onClick={e => e.stopPropagation()}
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-slate-900 border border-slate-800 p-5 space-y-3">
            <h3 className="text-sm font-bold text-white">{draft.id ? 'Edit package' : 'New package'}</h3>
            <label className="block text-xs font-semibold text-slate-300">Name
              <input required value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Monthly Coaching" className={`${field} mt-1`} />
            </label>
            <label className="block text-xs font-semibold text-slate-300">What's included
              <textarea rows={2} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })}
                className="mt-1 w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white" />
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <label className="text-xs font-semibold text-slate-300">Price
                <input required type="number" min={1} step="any" value={draft.price} onChange={e => setDraft({ ...draft, price: Number(e.target.value) })} className={`${field} mt-1`} />
              </label>
              <label className="text-xs font-semibold text-slate-300">Currency
                <select value={draft.currency || 'KES'} onChange={e => setDraft({ ...draft, currency: e.target.value })} className={`${field} mt-1`}>
                  <option value="KES">KES (KSh)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </label>
              <label className="col-span-2 sm:col-span-1 text-xs font-semibold text-slate-300">Billing
                <select value={draft.billing} onChange={e => setDraft({ ...draft, billing: e.target.value as Package['billing'] })} className={`${field} mt-1`}>
                  <option value="recurring">Recurring</option>
                  <option value="one_time">One-time</option>
                </select>
              </label>
            </div>
            {draft.billing === 'recurring' ? (
              <label className="block text-xs font-semibold text-slate-300">Renews every
                <select value={draft.interval ?? 'monthly'} onChange={e => setDraft({ ...draft, interval: e.target.value as Package['interval'] })} className={`${field} mt-1`}>
                  <option value="monthly">Month</option><option value="quarterly">3 months</option><option value="yearly">Year</option>
                </select>
                <span className="block mt-1 text-[11px] font-normal text-slate-400">Cards renew automatically. M-Pesa payers get a renewal link by email.</span>
              </label>
            ) : (
              <label className="block text-xs font-semibold text-slate-300">Access length (weeks)
                <input type="number" min={1} max={104} value={draft.durationWeeks ?? 12} onChange={e => setDraft({ ...draft, durationWeeks: Number(e.target.value) })} className={`${field} mt-1`} />
              </label>
            )}
            <p className="pt-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">When a client first pays</p>
            <label className="block text-xs font-semibold text-slate-300">Assign program
              <select value={draft.programId ?? ''} onChange={e => setDraft({ ...draft, programId: e.target.value || null })} className={`${field} mt-1`}>
                <option value="">None</option>{programs.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-300">Start autoflow
              <select value={draft.autoflowId ?? ''} onChange={e => setDraft({ ...draft, autoflowId: e.target.value || null })} className={`${field} mt-1`}>
                <option value="">None</option>{autoflows.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-300">Onboarding questionnaire
              <select value={draft.onboardingFormId ?? ''} onChange={e => setDraft({ ...draft, onboardingFormId: e.target.value || null })} className={`${field} mt-1`}>
                <option value="">None</option>{forms.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
              </select>
            </label>
            {draft.id && (
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input type="checkbox" className="accent-emerald-500" checked={draft.active} onChange={e => setDraft({ ...draft, active: e.target.checked })} />
                Available for new payment links
              </label>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setDraft(null)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-100 text-sm font-semibold">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-bold">Save package</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

const STATUS_STYLE: Record<string, string> = {
  active: 'text-emerald-400', paid: 'text-emerald-400', success: 'text-emerald-400',
  past_due: 'text-amber-400', pending: 'text-amber-400', failed: 'text-red-400',
  cancelled: 'text-slate-400', completed: 'text-slate-400',
};
const STATUS_LABEL: Record<string, string> = { past_due: 'Past due', one_time: 'One-time' };
const Status: React.FC<{ value: string }> = ({ value }) => (
  <span className={`font-semibold capitalize ${STATUS_STYLE[value] ?? 'text-slate-300'}`}>{STATUS_LABEL[value] ?? value}</span>
);

const ClientsAndLinks: React.FC<{ data: BusinessData; run: Run }> = ({ data, run }) => {
  const { clients, showToast } = useApp();
  const activePackages = data.packages.filter(p => p.active);
  const [clientId, setClientId] = useState('');
  const [packageId, setPackageId] = useState('');
  const chosenClient = clientId || clients[0]?.id || '';
  const chosenPackage = packageId || activePackages[0]?.id || '';
  const name = (id: string) => clients.find(c => c.id === id)?.name ?? 'Client';
  const pkg = (id: string) => data.packages.find(p => p.id === id)?.title ?? 'Package';

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      showToast('Payment link copied.');
    } catch {
      window.prompt('Copy this payment link:', url);
    }
  };

  return (
    <div className="space-y-5">
      <form onSubmit={async e => { e.preventDefault(); await run(() => billingApi.sendPaymentLink(chosenClient, chosenPackage), 'Payment link sent.'); }}
        className={`${card} p-4 grid grid-cols-2 lg:grid-cols-[1fr_1fr_auto] gap-2 items-end`}>
        <label className="text-xs font-semibold text-slate-300">Client
          <select value={chosenClient} onChange={e => setClientId(e.target.value)} className={`${field} mt-1`}>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.email ? '' : ' (no email)'}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-300">Package
          <select value={chosenPackage} onChange={e => setPackageId(e.target.value)} className={`${field} mt-1`}>
            {activePackages.length === 0 && <option value="">Create a package first</option>}
            {activePackages.map(p => <option key={p.id} value={p.id}>{p.title} · {formatMoney(p.price, p.currency)}</option>)}
          </select>
        </label>
        <button type="submit" disabled={!chosenClient || !chosenPackage || !data.account}
          className="col-span-2 lg:col-span-1 h-9 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-sm font-bold inline-flex items-center justify-center gap-1.5">
          <Send className="h-4 w-4" /> Send payment link
        </button>
      </form>

      <section className={`${card} overflow-x-auto`}>
        <h3 className="px-4 py-3 text-sm font-bold text-white border-b border-slate-800">Subscriptions</h3>
        <table className="w-full text-sm">
          <thead><tr className="text-[11px] uppercase tracking-wider text-slate-400 text-left">
            <th className="px-4 py-2 font-bold">Client</th><th className="px-4 py-2 font-bold">Package</th><th className="px-4 py-2 font-bold">Status</th>
            <th className="px-4 py-2 font-bold">Paid until</th><th className="px-4 py-2 font-bold">Renewal</th><th className="px-4 py-2" />
          </tr></thead>
          <tbody>
            {data.subscriptions.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">No subscriptions yet.</td></tr>}
            {data.subscriptions.map(s => (
              <tr key={s.id} className="border-t border-slate-800">
                <td className="px-4 py-2.5 font-semibold text-white whitespace-nowrap">{name(s.clientId)}</td>
                <td className="px-4 py-2.5 text-slate-300">{pkg(s.packageId)}</td>
                <td className="px-4 py-2.5"><Status value={s.status} /></td>
                <td className="px-4 py-2.5 text-slate-300 whitespace-nowrap">{formatDay(s.currentPeriodEnd)}</td>
                <td className="px-4 py-2.5 text-slate-300 whitespace-nowrap">
                  {s.status !== 'active' && s.status !== 'past_due' ? '—' : s.cancelAtPeriodEnd ? 'Ends at period end' : s.autoRenew ? `Auto · ${s.cardLabel}` : 'Link by email'}
                </td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap">
                  {(s.status === 'active' || s.status === 'past_due') && (s.cancelAtPeriodEnd
                    ? <button onClick={() => run(() => billingApi.resumeSubscription(s.id), 'Renewal resumed.')} className="text-xs font-semibold text-emerald-400">Resume</button>
                    : <button onClick={() => window.confirm('Stop renewing? Access continues until the paid period ends.') && run(() => billingApi.cancelSubscription(s.id), 'Renewal stopped.')}
                        className="text-xs font-semibold text-red-400">Cancel</button>)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={`${card} overflow-x-auto`}>
        <h3 className="px-4 py-3 text-sm font-bold text-white border-b border-slate-800">Payment links</h3>
        <table className="w-full text-sm">
          <thead><tr className="text-[11px] uppercase tracking-wider text-slate-400 text-left">
            <th className="px-4 py-2 font-bold">Client</th><th className="px-4 py-2 font-bold">Package</th><th className="px-4 py-2 font-bold">Amount</th>
            <th className="px-4 py-2 font-bold">Status</th><th className="px-4 py-2 font-bold">Sent</th><th className="px-4 py-2" />
          </tr></thead>
          <tbody>
            {data.requests.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">No payment links sent yet.</td></tr>}
            {data.requests.map(r => (
              <tr key={r.id} className="border-t border-slate-800">
                <td className="px-4 py-2.5 font-semibold text-white whitespace-nowrap">{name(r.clientId)}</td>
                <td className="px-4 py-2.5 text-slate-300">{pkg(r.packageId)}{r.purpose === 'renewal' && <span className="ml-1 text-[11px] text-slate-400">(renewal)</span>}</td>
                <td className="px-4 py-2.5 text-slate-300 whitespace-nowrap">{formatMoney(r.amount, r.currency)}</td>
                <td className="px-4 py-2.5"><Status value={r.status} /></td>
                <td className="px-4 py-2.5 text-slate-300 whitespace-nowrap">{formatDay(r.createdAt.slice(0, 10))}</td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap">
                  {r.status === 'pending' && (
                    <>
                      <button onClick={() => copy(r.url)} aria-label="Copy payment link" className="p-1.5 text-slate-400 hover:text-white"><Copy className="h-4 w-4" /></button>
                      <button onClick={() => window.confirm('Cancel this payment link?') && run(() => billingApi.cancelPaymentLink(r.id), 'Link cancelled.')}
                        aria-label="Cancel payment link" className="p-1.5 text-slate-400 hover:text-red-400"><X className="h-4 w-4" /></button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
};

const Payments: React.FC<{ payments: Payment[]; packages: Package[] }> = ({ payments, packages }) => {
  const { clients } = useApp();
  const total = payments.filter(p => p.status === 'success').reduce((s, p) => s + p.amount, 0);
  const fees = payments.filter(p => p.status === 'success').reduce((s, p) => s + p.fees, 0);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 max-w-md">
        <Stat label="Collected (all time)" value={formatMoney(total)} />
        <Stat label="Paystack fees" value={formatMoney(fees)} hint="Deducted from your payouts" />
      </div>
      <section className={`${card} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead><tr className="text-[11px] uppercase tracking-wider text-slate-400 text-left">
            <th className="px-4 py-2 font-bold">Date</th><th className="px-4 py-2 font-bold">Client</th><th className="px-4 py-2 font-bold">Package</th>
            <th className="px-4 py-2 font-bold">Amount</th><th className="px-4 py-2 font-bold">Method</th><th className="px-4 py-2 font-bold">Status</th>
          </tr></thead>
          <tbody>
            {payments.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">No payments yet.</td></tr>}
            {payments.map(p => (
              <tr key={p.id} className="border-t border-slate-800">
                <td className="px-4 py-2.5 text-slate-300 whitespace-nowrap">{formatDay((p.paidAt ?? p.createdAt).slice(0, 10))}</td>
                <td className="px-4 py-2.5 font-semibold text-white whitespace-nowrap">{clients.find(c => c.id === p.clientId)?.name ?? 'Former client'}</td>
                <td className="px-4 py-2.5 text-slate-300">{packages.find(x => x.id === p.packageId)?.title ?? 'Package'}</td>
                <td className="px-4 py-2.5 text-white font-semibold whitespace-nowrap">{formatMoney(p.amount, p.currency)}</td>
                <td className="px-4 py-2.5 text-slate-300 capitalize">{p.channel.replace('_', ' ') || '—'}</td>
                <td className="px-4 py-2.5" title={p.failureReason}><Status value={p.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
};

const Payouts: React.FC<{ account: PayoutAccount | null; run: Run }> = ({ account, run }) => {
  const [banks, setBanks] = useState<{ name: string; code: string }[] | null>(null);
  const [bankError, setBankError] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState(account?.businessName ?? '');
  const [bankCode, setBankCode] = useState(account?.bankCode ?? '');
  const [accountNumber, setAccountNumber] = useState('');

  useEffect(() => {
    billingApi.banks().then(setBanks).catch(err => setBankError(err instanceof Error ? err.message : 'Could not load banks'));
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:items-start">
      <section className={`${card} p-4 space-y-2`}>
        <div className="flex items-center gap-2"><Landmark className="h-5 w-5 text-emerald-400" /><h3 className="text-sm font-bold text-white">Payout account</h3></div>
        {account ? (
          <dl className="text-sm space-y-1">
            <div className="flex justify-between gap-3"><dt className="text-slate-400">Business name</dt><dd className="text-white font-semibold">{account.businessName}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-400">Settles to</dt><dd className="text-white">{account.bankName} •••• {account.accountLast4}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-400">Paystack subaccount</dt><dd className="text-white font-mono text-xs">{account.subaccountCode}</dd></div>
          </dl>
        ) : <p className="text-sm text-slate-400">Not connected yet.</p>}
        <p className="text-xs text-slate-400">Client payments are split at checkout: your share settles straight to this account on Paystack's schedule. Paystack's transaction fee comes out of your share.</p>
      </section>

      <form
        onSubmit={async e => { e.preventDefault(); const ok = await run(() => billingApi.setPayoutAccount({ businessName, bankCode, accountNumber }), 'Payout account saved.'); if (ok) setAccountNumber(''); }}
        className={`${card} p-4 space-y-3`}
      >
        <h3 className="text-sm font-bold text-white">{account ? 'Update payout details' : 'Connect payouts'}</h3>
        {bankError && <p role="alert" className="text-xs text-amber-400">{bankError}</p>}
        <label className="block text-xs font-semibold text-slate-300">Business or account name
          <input required minLength={2} value={businessName} onChange={e => setBusinessName(e.target.value)} className={`${field} mt-1`} />
        </label>
        <label className="block text-xs font-semibold text-slate-300">Bank
          <select required value={bankCode} onChange={e => setBankCode(e.target.value)} disabled={!banks} className={`${field} mt-1`}>
            <option value="">{banks ? 'Choose…' : 'Loading…'}</option>
            {banks?.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
          </select>
        </label>
        <label className="block text-xs font-semibold text-slate-300">Account number
          <input required inputMode="numeric" value={accountNumber} onChange={e => setAccountNumber(e.target.value.replace(/\s/g, ''))}
            placeholder={account ? `•••• ${account.accountLast4}` : ''} autoComplete="off" className={`${field} mt-1`} />
        </label>
        <button type="submit" disabled={!banks || !bankCode || !accountNumber}
          className="w-full h-10 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-sm font-bold">
          {account ? 'Update account' : 'Connect account'}
        </button>
      </form>
    </div>
  );
};

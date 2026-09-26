import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Lock, XCircle } from 'lucide-react';
import { payApi } from '../../services/apiClient';
import { PublicPaymentRequest } from '../../types';
import { describeBilling, formatMoney } from '../../utils/money';
import { AuthShell, primaryButtonClass } from '../auth/AuthShell';
import { portalHref } from '../../config/portal';

/**
 * Public pay page (client portal, ?pay=<token>). Works without signing in. Paystack sends the
 * client back here with ?reference=…; we then confirm the payment with the server.
 */
export const PayPage: React.FC<{ token: string }> = ({ token }) => {
  const [request, setRequest] = useState<PublicPaymentRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<'success' | 'failed' | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get('reference') || params.get('trxref');
    (async () => {
      try {
        if (reference) {
          setBusy(true);
          const res = await payApi.verify(token, reference);
          setResult(res.status === 'success' ? 'success' : 'failed');
          if (res.status !== 'success' && res.failureReason) setError(res.failureReason);
          setBusy(false);
        }
        setRequest(await payApi.view(token));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'This payment link could not be loaded.');
        setBusy(false);
      }
    })();
  }, [token]);

  const checkout = async () => {
    setBusy(true);
    setError(null);
    try {
      const { authorizationUrl } = await payApi.checkout(token);
      window.location.assign(authorizationUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the payment.');
      setBusy(false);
    }
  };

  const paid = result === 'success' || request?.status === 'paid';

  return (
    <AuthShell
      title={paid ? 'Payment received' : request ? (request.purpose === 'renewal' ? 'Renew your coaching' : 'Complete your payment') : 'Payment'}
      subtitle={request ? `${request.coachName} · ${request.packageTitle}` : ''}
      footer={<a href={portalHref('client')} className="text-emerald-400 font-semibold">Open the NubianFit app</a>}
    >
      {!request && !error && <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>}
      {request && (
        <div className="space-y-4">
          {paid ? (
            <div className="flex flex-col items-center text-center gap-2 py-2">
              <CheckCircle2 className="h-10 w-10 text-emerald-400" />
              <p className="text-sm text-slate-100">Thanks{request.clientFirstName ? `, ${request.clientFirstName}` : ''}! Your coach has been notified. Sign in to the app to get started.</p>
            </div>
          ) : request.status === 'cancelled' ? (
            <p className="text-sm text-slate-300">This payment link was cancelled. Ask your coach for a new one.</p>
          ) : (
            <>
              <div className="rounded-xl bg-slate-950 border border-slate-800 p-4">
                <p className="text-3xl font-extrabold text-white">{formatMoney(request.amount, request.currency)}</p>
                <p className="text-xs text-slate-400">{describeBilling(request)}</p>
                {request.packageDescription && <p className="mt-2 text-sm text-slate-300">{request.packageDescription}</p>}
              </div>
              {result === 'failed' && (
                <p role="alert" className="flex items-center gap-2 text-sm text-red-400"><XCircle className="h-4 w-4" /> The payment didn't go through. You can try again.</p>
              )}
              {!request.paymentsEnabled && <p className="text-sm text-amber-400">Your coach can't accept payments right now. Please contact them.</p>}
              <button onClick={checkout} disabled={busy || !request.paymentsEnabled} className={`${primaryButtonClass} inline-flex items-center justify-center gap-2`}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                Pay {formatMoney(request.amount, request.currency)}
              </button>
              <p className="text-[11px] text-center text-slate-400">Secure checkout by Paystack · Card or M-Pesa</p>
            </>
          )}
        </div>
      )}
      {error && <p role="alert" className="mt-3 text-xs text-red-400">{error}</p>}
    </AuthShell>
  );
};

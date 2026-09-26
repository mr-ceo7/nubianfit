import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AuthShell, FieldLabel, FormError, inputClass, primaryButtonClass } from './AuthShell';

/** Clients sign in with a 6-digit code emailed to the address their coach registered. */
export const ClientLogin: React.FC = () => {
  const { requestCode, verifyCode } = useAuth();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setError(null);
    setSubmitting(true);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const sendCode = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      await requestCode(email);
      setStep('code');
    });
  };

  const submitCode = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      await verifyCode(email, code);
    });
  };

  return (
    <AuthShell
      title={step === 'email' ? 'Sign in to your training' : 'Check your email'}
      subtitle={
        step === 'email'
          ? 'Use the email address your coach has on file.'
          : `If ${email} is registered with a coach, we've sent it a 6-digit code.`
      }
    >
      {step === 'email' ? (
        <form onSubmit={sendCode} className="space-y-4">
          <div>
            <FieldLabel htmlFor="client-email">Email</FieldLabel>
            <input id="client-email" type="email" className={inputClass} value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <FormError message={error} />
          <button type="submit" className={primaryButtonClass} disabled={submitting}>
            {submitting ? 'Sending…' : 'Email me a code'}
          </button>
        </form>
      ) : (
        <form onSubmit={submitCode} className="space-y-4">
          <div>
            <FieldLabel htmlFor="client-code">Login code</FieldLabel>
            <input
              id="client-code"
              className={`${inputClass} tracking-[0.5em] text-center text-lg font-bold`}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              minLength={6}
              autoFocus
            />
          </div>
          <FormError message={error} />
          <button type="submit" className={primaryButtonClass} disabled={submitting || code.length !== 6}>
            {submitting ? 'Checking…' : 'Sign in'}
          </button>
          <button
            type="button"
            className="w-full text-xs text-slate-400 hover:text-white"
            onClick={() => { setStep('email'); setCode(''); setError(null); }}
          >
            Use a different email
          </button>
        </form>
      )}
    </AuthShell>
  );
};

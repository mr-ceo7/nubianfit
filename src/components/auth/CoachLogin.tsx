import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { portalHref } from '../../config/portal';
import { AuthShell, FieldLabel, FormError, inputClass, primaryButtonClass } from './AuthShell';

type Mode = 'login' | 'register';

export const CoachLogin: React.FC = () => {
  const { login, registerCoach } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await registerCoach({ email, password, fullName, inviteCode });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  return (
    <AuthShell
      title={mode === 'login' ? 'Coach sign in' : 'Create your coach account'}
      subtitle={mode === 'login' ? 'Manage your clients, programs and check-ins.' : 'You need an invite code from NubianFit.'}
      footer={
        <>
          Training with a coach? <a href={portalHref('client')} className="text-emerald-400 font-semibold">Open the client app</a>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'register' && (
          <div>
            <FieldLabel htmlFor="coach-name">Full name</FieldLabel>
            <input id="coach-name" className={inputClass} value={fullName} onChange={e => setFullName(e.target.value)} required autoComplete="name" />
          </div>
        )}
        <div>
          <FieldLabel htmlFor="coach-email">Email</FieldLabel>
          <input id="coach-email" type="email" className={inputClass} value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
        </div>
        <div>
          <FieldLabel htmlFor="coach-password">Password</FieldLabel>
          <input
            id="coach-password"
            type="password"
            className={inputClass}
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={mode === 'register' ? 8 : undefined}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </div>
        {mode === 'register' && (
          <div>
            <FieldLabel htmlFor="coach-invite">Invite code</FieldLabel>
            <input id="coach-invite" className={inputClass} value={inviteCode} onChange={e => setInviteCode(e.target.value)} required autoComplete="off" />
          </div>
        )}
        <FormError message={error} />
        <button type="submit" className={primaryButtonClass} disabled={submitting}>
          {submitting ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
      </form>
      <p className="text-xs text-slate-400 text-center mt-4">
        {mode === 'login' ? (
          <>New coach? <button type="button" onClick={() => switchMode('register')} className="text-emerald-400 font-semibold">Create an account</button></>
        ) : (
          <>Already registered? <button type="button" onClick={() => switchMode('login')} className="text-emerald-400 font-semibold">Sign in</button></>
        )}
      </p>
    </AuthShell>
  );
};

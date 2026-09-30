import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { portalHref } from '../../config/portal';
import { AuthShell, FieldLabel, FormError, inputClass, primaryButtonClass } from './AuthShell';

export const CoachLogin: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed. Please verify your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Coach sign in"
      subtitle="Private coach and administrative portal."
      footer={
        <p>
          Training as an athlete?{' '}
          <a href={portalHref('client')} className="text-emerald-400 font-semibold hover:underline">
            Open the Athlete App
          </a>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <FieldLabel htmlFor="coach-email">Email</FieldLabel>
          <input
            id="coach-email"
            type="email"
            className={inputClass}
            placeholder="coach@nubianfit.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div>
          <FieldLabel htmlFor="coach-password">Password</FieldLabel>
          <input
            id="coach-password"
            type="password"
            className={inputClass}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        <FormError message={error} />
        <button type="submit" className={primaryButtonClass} disabled={submitting}>
          {submitting ? 'Please wait…' : 'Sign in'}
        </button>
      </form>
    </AuthShell>
  );
};

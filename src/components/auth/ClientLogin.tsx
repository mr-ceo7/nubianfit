import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AuthShell, FieldLabel, FormError, inputClass, primaryButtonClass } from './AuthShell';
import { GoogleAuth } from './GoogleAuth';

type ClientAuthMode = 'signin' | 'join';

export const ClientLogin: React.FC = () => {
  const { requestCode, verifyCode, registerClient } = useAuth();
  const [mode, setMode] = useState<ClientAuthMode>(() => {
    try {
      return new URLSearchParams(window.location.search).get('mode') === 'join' ? 'join' : 'signin';
    } catch {
      return 'signin';
    }
  });
  const [step, setStep] = useState<'email' | 'code'>('email');

  // Sign-in states
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');

  // Join/Registration states
  const [fullName, setFullName] = useState('');
  const [goal, setGoal] = useState('Strength & Strategy');
  const [experienceLevel, setExperienceLevel] = useState('Intermediate');
  const [startingWeight, setStartingWeight] = useState('');

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

  const handleSendCode = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      await requestCode(email);
      setStep('code');
    });
  };

  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      await verifyCode(email, code);
    });
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      await registerClient({
        email,
        fullName,
        goal,
        experienceLevel,
        startingWeightKg: startingWeight ? parseFloat(startingWeight) : undefined,
      });
    });
  };

  return (
    <AuthShell
      title={
        mode === 'join'
          ? 'Join NubianFit'
          : step === 'email'
          ? 'Athlete sign in'
          : 'Check your email'
      }
      subtitle={
        mode === 'join'
          ? 'Create your athlete profile to start dedicated coaching.'
          : step === 'email'
          ? 'Access your daily workouts, habit targets, and coach thread.'
          : `We sent a 6-digit verification code to ${email}.`
      }
      footer={
        <div className="space-y-2">
          {mode === 'signin' ? (
            <p>
              New athlete?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('join');
                  setStep('email');
                  setError(null);
                }}
                className="text-emerald-400 font-semibold hover:underline"
              >
                Join NubianFit
              </button>
            </p>
          ) : (
            <p>
              Already training with us?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setStep('email');
                  setError(null);
                }}
                className="text-emerald-400 font-semibold hover:underline"
              >
                Sign in
              </button>
            </p>
          )}
        </div>
      }
    >
      {/* Google Quick One Tap & One-Click Sign In */}
      <div className="mb-5">
        <GoogleAuth
          onError={setError}
          promptOneTap={true}
          text={mode === 'join' ? 'signup_with' : 'continue_with'}
        />
        <div className="relative my-4 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800" />
          </div>
          <span className="relative bg-slate-900 px-3 text-[10px] font-mono tracking-widest uppercase text-slate-500">
            or continue with email
          </span>
        </div>
      </div>

      {mode === 'signin' ? (
        step === 'email' ? (
          <form onSubmit={handleSendCode} className="space-y-4">
            <div>
              <FieldLabel htmlFor="client-email">Email</FieldLabel>
              <input
                id="client-email"
                type="email"
                className={inputClass}
                placeholder="athlete@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <FormError message={error} />
            <button type="submit" className={primaryButtonClass} disabled={submitting}>
              {submitting ? 'Sending…' : 'Email me a code'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div>
              <FieldLabel htmlFor="client-code">Login code</FieldLabel>
              <input
                id="client-code"
                className={`${inputClass} tracking-[0.5em] text-center text-lg font-bold font-mono`}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                minLength={6}
                autoFocus
              />
            </div>
            <FormError message={error} />
            <button
              type="submit"
              className={primaryButtonClass}
              disabled={submitting || code.length !== 6}
            >
              {submitting ? 'Checking…' : 'Sign in'}
            </button>
            <button
              type="button"
              className="w-full text-xs text-slate-400 hover:text-white transition-colors"
              onClick={() => {
                setStep('email');
                setCode('');
                setError(null);
              }}
            >
              Use a different email
            </button>
          </form>
        )
      ) : (
        /* Join / Self-serve Registration */
        <form onSubmit={handleJoin} className="space-y-3.5">
          <div>
            <FieldLabel htmlFor="join-name">Full name</FieldLabel>
            <input
              id="join-name"
              type="text"
              className={inputClass}
              placeholder="Marcus Vance"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>
          <div>
            <FieldLabel htmlFor="join-email">Email address</FieldLabel>
            <input
              id="join-email"
              type="email"
              className={inputClass}
              placeholder="marcus@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <FieldLabel htmlFor="join-goal">Primary goal</FieldLabel>
              <select
                id="join-goal"
                className={inputClass}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
              >
                <option value="Strength & Strategy">Strength</option>
                <option value="Hypertrophy">Hypertrophy</option>
                <option value="Fat Loss">Fat Loss</option>
                <option value="Performance">Conditioning</option>
              </select>
            </div>
            <div>
              <FieldLabel htmlFor="join-exp">Experience</FieldLabel>
              <select
                id="join-exp"
                className={inputClass}
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value)}
              >
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
              </select>
            </div>
          </div>
          <div>
            <FieldLabel htmlFor="join-weight">Starting weight (kg, optional)</FieldLabel>
            <input
              id="join-weight"
              type="number"
              step="0.1"
              min="30"
              max="300"
              className={inputClass}
              placeholder="82.5"
              value={startingWeight}
              onChange={(e) => setStartingWeight(e.target.value)}
            />
          </div>
          <FormError message={error} />
          <button type="submit" className={primaryButtonClass} disabled={submitting}>
            {submitting ? 'Creating profile…' : 'Start Training'}
          </button>
        </form>
      )}
    </AuthShell>
  );
};

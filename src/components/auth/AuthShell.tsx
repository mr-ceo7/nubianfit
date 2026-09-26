import React from 'react';
import { NubianFitLogo } from '../common/NubianFitLogo';
import { useAuth } from '../../context/AuthContext';

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/** Centered card layout shared by the coach and client sign-in screens. */
export const AuthShell: React.FC<AuthShellProps> = ({ title, subtitle, children, footer }) => (
  <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4 py-10">
    <div className="w-full max-w-sm">
      <div className="flex items-center gap-2.5 mb-8 justify-center">
        <NubianFitLogo className="h-10 w-10" />
        <span className="font-logo text-xl tracking-wide">
          <span className="text-logo-nubian">NUBIAN</span>
          <span className="text-logo-fit">FIT</span>
        </span>
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h1 className="text-lg font-bold text-white">{title}</h1>
        <p className="text-sm text-slate-400 mt-1 mb-5">{subtitle}</p>
        {children}
      </div>
      {footer && <div className="mt-5 text-center text-xs text-slate-400">{footer}</div>}
      {import.meta.env.DEV && <DevLoginButtons />}
    </div>
  </div>
);

export const inputClass =
  'w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition-colors';

export const primaryButtonClass =
  'w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed text-slate-950 font-bold text-sm py-2.5 transition-colors';

export const FieldLabel: React.FC<{ htmlFor: string; children: React.ReactNode }> = ({ htmlFor, children }) => (
  <label htmlFor={htmlFor} className="block text-xs font-semibold text-slate-300 mb-1.5">
    {children}
  </label>
);

export const FormError: React.FC<{ message: string | null }> = ({ message }) =>
  message ? (
    <p role="alert" className="text-xs text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2">
      {message}
    </p>
  ) : null;

/** Local development only (stripped from production builds): skip the login forms. */
const DevLoginButtons: React.FC = () => {
  const { devLogin } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const go = (role: 'coach' | 'client') =>
    devLogin(role).catch(err => setError(err instanceof Error ? err.message : 'Demo login failed'));

  return (
    <div className="mt-5 rounded-xl border border-dashed border-amber-500/60 p-3 text-center">
      <p className="text-[11px] font-bold uppercase tracking-wider text-amber-400 mb-2">Dev only · demo accounts</p>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => go('coach')} className="rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white py-2">
          Sign in as coach
        </button>
        <button onClick={() => go('client')} className="rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white py-2">
          Sign in as client
        </button>
      </div>
      {error && <p className="mt-2 text-[11px] text-red-400">{error}</p>}
    </div>
  );
};

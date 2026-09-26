import React, { useState } from 'react';
import { LogOut, Moon, Sun } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../services/apiClient';
import { Client } from '../../types';
import { ClientAvatar } from '../common/ClientAvatar';

export const ClientProfile: React.FC<{ client: Client }> = ({ client }) => {
  const { theme, toggleTheme, showToast } = useApp();
  const { user, logout, refreshUser } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const hasPassword = user?.hasPassword;

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await authApi.changePassword(newPassword, hasPassword ? currentPassword : undefined);
      await refreshUser();
      showToast('Password saved. You can now sign in with it.');
      setNewPassword('');
      setCurrentPassword('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save password.');
    } finally {
      setSaving(false);
    }
  };

  const field = 'w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500';

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:items-start [&>*]:min-w-0">
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <ClientAvatar client={client} className="h-14 w-14 rounded-2xl" />
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-white truncate">{client.name}</h1>
            <p className="text-sm text-slate-400 truncate">{client.email}</p>
          </div>
        </div>

        <dl className="rounded-2xl bg-slate-900 border border-slate-800 divide-y divide-slate-800 text-sm">
          <Row label="Goal" value={client.goal} />
          <Row label="Program" value={client.currentProgramName || 'Not assigned yet'} />
          <Row label="Coaching since" value={client.startDate || '—'} />
        </dl>
      </div>

      <div className="space-y-5">
        <form onSubmit={savePassword} className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3">
          <h2 className="text-sm font-bold text-white">{hasPassword ? 'Change password' : 'Set a password (optional)'}</h2>
          <p className="text-xs text-slate-400">You can always sign in with an emailed code instead.</p>
          {hasPassword && (
            <input type="password" className={field} placeholder="Current password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} autoComplete="current-password" required />
          )}
          <input type="password" className={field} placeholder="New password (8+ characters)" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={8} autoComplete="new-password" required />
          <button type="submit" disabled={saving} className="w-full rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm py-2.5">
            {saving ? 'Saving…' : 'Save password'}
          </button>
        </form>

        <div className="grid grid-cols-2 gap-3">
          <button onClick={toggleTheme} className="rounded-2xl bg-slate-900 border border-slate-800 p-3.5 flex items-center justify-center gap-2 text-sm font-semibold text-white">
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          <button onClick={logout} className="rounded-2xl bg-slate-900 border border-slate-800 p-3.5 flex items-center justify-center gap-2 text-sm font-semibold text-red-400">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="p-3.5 flex justify-between gap-4">
    <dt className="text-slate-400">{label}</dt>
    <dd className="text-white font-medium text-right truncate">{value}</dd>
  </div>
);

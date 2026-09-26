import React, { useState } from 'react';
import { useEngagement } from '../../context/EngagementContext';

/** Push and email preferences (clients: Profile tab; everyone: the bell's settings link). */
export const NotificationSettings: React.FC = () => {
  const { pushAvailable, pushEnabled, setPushEnabled, emailDigest, setEmailDigest } = useEngagement();
  const [busy, setBusy] = useState(false);
  return (
    <section className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3">
      <h2 className="text-sm font-bold text-white">Notifications</h2>
      <Toggle
        label="Push notifications on this device"
        hint={pushAvailable ? 'Messages, check-ins and reminders, even when the app is closed.' : 'Install the app (Add to Home Screen) to enable push.'}
        checked={pushEnabled}
        disabled={!pushAvailable || busy}
        onChange={async on => { setBusy(true); await setPushEnabled(on); setBusy(false); }}
      />
      <Toggle
        label="Email me what I missed"
        hint="A summary email when you have unread updates."
        checked={emailDigest}
        onChange={setEmailDigest}
      />
    </section>
  );
};

const Toggle: React.FC<{ label: string; hint: string; checked: boolean; disabled?: boolean; onChange: (on: boolean) => void }> = ({
  label, hint, checked, disabled, onChange,
}) => (
  <label className={`flex items-start gap-3 ${disabled ? 'opacity-60' : ''}`}>
    <span className="flex-1 min-w-0">
      <span className="block text-sm font-semibold text-white">{label}</span>
      <span className="block text-xs text-slate-400">{hint}</span>
    </span>
    <input
      type="checkbox"
      role="switch"
      checked={checked}
      disabled={disabled}
      onChange={e => onChange(e.target.checked)}
      className="mt-1 h-5 w-9 appearance-none rounded-full bg-slate-700 checked:bg-emerald-500 relative cursor-pointer transition-colors before:content-[''] before:absolute before:top-0.5 before:left-0.5 before:h-4 before:w-4 before:rounded-full before:bg-[#ffffff] before:transition-transform checked:before:translate-x-4 disabled:cursor-not-allowed"
    />
  </label>
);

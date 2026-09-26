import React, { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, Settings, X } from 'lucide-react';
import { NotificationSettings } from './NotificationSettings';
import { useEngagement } from '../../context/EngagementContext';
import { AppNotification } from '../../types';
import { timeAgo } from '../../utils/dates';

/** Header bell with unread badge and a dropdown of recent notifications. */
export const NotificationBell: React.FC<{ onNavigate: (link: AppNotification['link']) => void }> = ({ onNavigate }) => {
  const { notifications, unreadCount, markNotificationsRead } = useEngagement();
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openItem = (n: AppNotification) => {
    if (!n.readAt) markNotificationsRead([n.id]);
    setOpen(false);
    onNavigate(n.link);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div role="dialog" aria-label="Notifications" className="absolute right-0 top-11 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <span className="text-sm font-bold text-white">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={() => markNotificationsRead()} className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-96 overflow-y-auto divide-y divide-slate-800">
            {notifications.length === 0 && <li className="p-6 text-center text-sm text-slate-400">You're all caught up.</li>}
            {notifications.slice(0, 30).map(n => (
              <li key={n.id}>
                <button onClick={() => openItem(n)} className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-slate-800/60 ${n.readAt ? '' : 'bg-emerald-500/5'}`}>
                  <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${n.readAt ? 'bg-transparent' : 'bg-emerald-500'}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-white">{n.title}</span>
                    {n.body && <span className="block text-xs text-slate-400 line-clamp-2">{n.body}</span>}
                    <span className="block text-[10px] text-slate-400 mt-0.5">{timeAgo(n.createdAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button onClick={() => { setOpen(false); setSettingsOpen(true); }} className="w-full px-4 py-2.5 border-t border-slate-800 flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white">
            <Settings className="h-3.5 w-3.5" /> Notification settings
          </button>
        </div>
      )}

      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setSettingsOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Notification settings" onClick={e => e.stopPropagation()} className="relative w-full max-w-sm">
            <button onClick={() => setSettingsOpen(false)} aria-label="Close" className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-400 hover:text-white">
              <X className="h-4 w-4" />
            </button>
            <NotificationSettings />
          </div>
        </div>
      )}
    </div>
  );
};

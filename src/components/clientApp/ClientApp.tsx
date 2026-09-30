import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Apple, CalendarDays, Home, LogOut, MessageSquare, TrendingUp, User } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { ClientAvatar } from '../common/ClientAvatar';
import { NubianFitBrand } from '../common/NubianFitBrand';
import { WorkoutLoggerModal } from '../programs/WorkoutLoggerModal';
import { ChatThread } from '../messenger/ChatThread';
import { ClientToday } from './ClientToday';
import { ClientWorkouts } from './ClientWorkouts';
import { ClientProgress } from './ClientProgress';
import { ClientProfile } from './ClientProfile';
import { ClientNutrition } from './ClientNutrition';
import { NotificationBell } from '../engagement/NotificationBell';
import { consumeDeepLink } from '../../utils/deepLink';
import { AppNotification } from '../../types';

const CommunityView = lazy(() => import('../engagement/CommunityView').then(m => ({ default: m.CommunityView })));

/** Where a notification's link.tab should take a client. */
const CLIENT_TAB_FOR: Record<string, ClientTab> = { chat: 'chat', messenger: 'chat', community: 'chat', today: 'today', progress: 'progress', nutrition: 'nutrition', workouts: 'workouts', profile: 'profile' };
import { Toast } from '../common/Toast';

type ClientTab = 'today' | 'workouts' | 'nutrition' | 'progress' | 'chat' | 'profile';

const TABS: { id: ClientTab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'today', label: 'Today', icon: Home },
  { id: 'workouts', label: 'Workouts', icon: CalendarDays },
  { id: 'nutrition', label: 'Nutrition', icon: Apple },
  { id: 'progress', label: 'Progress', icon: TrendingUp },
  { id: 'chat', label: 'Coach', icon: MessageSquare },
];
/** Desktop sidebar also lists the profile; on phones it's the header avatar. */
const SIDEBAR_TABS = [...TABS, { id: 'profile' as ClientTab, label: 'Profile', icon: User }];

/** The client (athlete) portal served at app.<domain>. */
export const ClientApp: React.FC = () => {
  const { clients, messages, isLoading, loadError, refreshData } = useApp();
  const [tab, setTab] = useState<ClientTab>('today');
  const [chatView, setChatView] = useState<'coach' | 'groups'>('coach');
  const [groupId, setGroupId] = useState<string | null>(null);

  const navigate = (link: AppNotification['link']) => {
    const target = link.tab ? CLIENT_TAB_FOR[link.tab] : undefined;
    if (!target) return;
    if (target === 'chat') {
      setChatView(link.tab === 'community' || link.groupId ? 'groups' : 'coach');
      if (link.groupId) setGroupId(link.groupId);
    }
    setTab(target);
  };

  useEffect(() => {
    const link = consumeDeepLink();
    if (link) navigate(link);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const me = clients[0];
  const unread = messages.filter(m => m.sender === 'coach' && !m.isRead).length;

  if (!me) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3 p-6 text-center">
        <NubianFitBrand size="lg" />
        {loadError ? (
          <>
            <p className="text-sm text-slate-300">{loadError}</p>
            <button onClick={refreshData} className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 text-sm font-bold">Try again</button>
          </>
        ) : (
          <p className="text-sm text-slate-400">{isLoading ? 'Loading your training…' : 'No coaching profile found.'}</p>
        )}
      </div>
    );
  }

  const titles: Record<ClientTab, string> = {
    today: 'Today',
    workouts: 'Workouts',
    nutrition: 'Nutrition',
    progress: 'Progress',
    chat: 'Messages & community',
    profile: 'Profile',
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased md:flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-60 lg:w-64 shrink-0 flex-col h-screen sticky top-0 border-r border-slate-800 bg-slate-900/60">
        <div className="h-16 px-5 flex items-center gap-2 border-b border-slate-800">
          <Brand />
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {SIDEBAR_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              aria-current={tab === id ? 'page' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                tab === id ? 'bg-emerald-500/15 text-emerald-400' : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="flex-1 text-left">{label}</span>
              {id === 'chat' && unread > 0 && (
                <span className="px-1.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-bold">{unread}</span>
              )}
            </button>
          ))}
        </nav>
        <SidebarUser name={me.name} avatar={me.avatar} />
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile header */}
        <header className="md:hidden sticky top-0 z-20 bg-slate-950/90 backdrop-blur border-b border-slate-800">
          <div className="px-4 h-14 flex items-center gap-2">
            <Brand size="sm" />
            <div className="ml-auto"><NotificationBell onNavigate={navigate} /></div>
            <button onClick={() => setTab('profile')} aria-label="Profile" className="rounded-xl">
              <ClientAvatar client={me} className="h-8 w-8 rounded-xl" />
            </button>
          </div>
        </header>
        {/* Desktop header */}
        <header className="hidden md:flex h-16 items-center px-8 border-b border-slate-800">
          <h1 className="text-lg font-bold text-white">{titles[tab]}</h1>
          <div className="ml-auto"><NotificationBell onNavigate={navigate} /></div>
        </header>

        <main className={`w-full max-w-6xl mx-auto ${tab === 'chat' ? 'md:px-8 md:py-6' : 'px-4 md:px-8 py-5 md:py-8'} pb-28 md:pb-8`}>
          {tab === 'today' && (
            <ClientToday client={me} onOpenWorkouts={() => setTab('workouts')} onOpenChat={() => setTab('chat')} onOpenNutrition={() => setTab('nutrition')} />
          )}
          {tab === 'workouts' && <ClientWorkouts />}
          {tab === 'nutrition' && <ClientNutrition clientId={me.id} />}
          {tab === 'progress' && <ClientProgress client={me} />}
          {tab === 'chat' && (
            <div className="space-y-3">
              <div className="px-4 md:px-0 pt-3 md:pt-0">
                <div className="inline-grid grid-cols-2 rounded-xl bg-slate-900 border border-slate-800 p-1 text-sm">
                  {(['coach', 'groups'] as const).map(v => (
                    <button key={v} onClick={() => setChatView(v)} aria-pressed={chatView === v}
                      className={`px-4 py-1.5 rounded-lg font-bold ${chatView === v ? 'bg-emerald-500 text-slate-950' : 'text-slate-300'}`}>
                      {v === 'coach' ? 'Coach' : 'Groups'}
                    </button>
                  ))}
                </div>
              </div>
              {chatView === 'coach' ? (
                <div className="h-[calc(100dvh-56px-88px-56px)] md:h-[calc(100vh-64px-48px-56px)] flex flex-col md:rounded-3xl md:border md:border-slate-800 md:bg-slate-900/60 md:overflow-hidden">
                  <ChatThread clientId={me.id} viewer="client" placeholder="Message your coach…" />
                </div>
              ) : (
                <Suspense fallback={<p className="p-4 text-sm text-slate-400">Loading…</p>}>
                  <CommunityView initialGroupId={groupId} />
                </Suspense>
              )}
            </div>
          )}
          {tab === 'profile' && <ClientProfile client={me} />}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-slate-950/95 backdrop-blur border-t border-slate-800 pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              aria-current={tab === id ? 'page' : undefined}
              className={`relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold ${tab === id ? 'text-emerald-400' : 'text-slate-400'}`}
            >
              <Icon className="h-5 w-5" />
              {label}
              {id === 'chat' && unread > 0 && (
                <span className="absolute top-1.5 left-1/2 ml-2 px-1.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-bold">{unread}</span>
              )}
            </button>
          ))}
        </div>
      </nav>

      <WorkoutLoggerModal />
      <Toast />
    </div>
  );
};

const Brand: React.FC<{ size?: 'sm' | 'md' }> = ({ size = 'md' }) => (
  <NubianFitBrand size={size} />
);

const SidebarUser: React.FC<{ name: string; avatar: string }> = ({ name, avatar }) => {
  const { user, logout } = useAuth();
  return (
    <div className="p-3 border-t border-slate-800 flex items-center gap-3">
      <ClientAvatar client={{ name, avatar }} className="h-10 w-10 rounded-xl" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-white truncate">{name}</p>
        <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
      </div>
      <button onClick={logout} title="Sign out" aria-label="Sign out" className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800">
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
};
